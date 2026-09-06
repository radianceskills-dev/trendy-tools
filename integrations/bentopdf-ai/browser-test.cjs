const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.resolve(process.argv[2] || ".");
const executablePath = process.argv[3];
if (!executablePath)
  throw new Error("Chrome/Chromium executable path is required.");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://127.0.0.1").pathname,
  );
  let relative = pathname.replace(/^\/+/, "");
  let filePath = path.resolve(root, relative);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (
    (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    response.writeHead(404).end("Not found");
    return;
  }
  if (
    pathname.startsWith("/tools/bentopdf/") ||
    pathname === "/tools/bentopdf"
  ) {
    response.setHeader(
      "Content-Security-Policy",
      "connect-src 'self' https://openrouter.ai https://api.b.ai https://opencode.ai",
    );
  }
  response.setHeader(
    "Content-Type",
    mimeTypes[path.extname(filePath)] || "application/octet-stream",
  );
  response.setHeader("Cache-Control", "no-store");
  fs.createReadStream(filePath).pipe(response);
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function configuredPage(browser, pageUrl, responseContent, provider = "openrouter", httpStatus = 200) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
    locale: "en-US",
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(pageUrl).origin) return route.continue();
    // Page-level mock below handles the one authorized provider route. Never fall through externally.
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  let providerRequest;
  let requestCount = 0;
  const requests = [];
  const endpoints = {openrouter:"https://openrouter.ai/api/v1/chat/completions",bai:"https://api.b.ai/v1/chat/completions",opencode:"https://opencode.ai/zen/v1/chat/completions"};

  await page.addInitScript((providerId) => {
    localStorage.setItem(
      "trendytools.ai.v1",
      JSON.stringify({
        version: 1,
        provider: providerId,
        providerLabel: "OpenRouter",
        apiKey: "mock-key",
        model: "mock-model",
        endpoint: "https://untrusted.example.invalid/chat/completions",
      }),
    );
  }, provider);

  await page.route(
    endpoints[provider],
    async (route) => {
      requestCount++;
      providerRequest = route.request().postDataJSON();
      requests.push(providerRequest);
      await route.fulfill({
        status: httpStatus,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: typeof responseContent === 'function' ? responseContent(requestCount) : responseContent } }],
        }),
      });
    },
  );

  const response = await page.goto(pageUrl, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(
    response?.status(),
    200,
    `Expected 200 for ${pageUrl}, got ${response?.status()}`,
  );
  await page
    .locator("#trendy-ai-workflow-button")
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelector("#trendy-ai-workflow-button")?.dataset
        .initialized === "true",
  );
  return { context, page, providerRequest: () => providerRequest, requestCount: () => requestCount, requests };
}

(async () => {
  const port = await listen();
  const pageUrl = `http://127.0.0.1:${port}/tools/bentopdf/pdf-workflow.html`;
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });

  try {
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
    locale: "en-US",
      });
      await context.route('**/*', route => new URL(route.request().url()).origin === `http://127.0.0.1:${port}` ? route.continue() : route.abort('blockedbyclient'));
      const page = await context.newPage();
      const response = await page.goto(
        `http://127.0.0.1:${port}/tools/bentopdf/`,
        {
          waitUntil: "domcontentloaded",
        },
      );
      assert.equal(
        response?.status(),
        200,
        `Expected 200 for BentoPDF homepage, got ${response?.status()}`,
      );
      await page
        .locator("#trendy-bentopdf-workflow-first")
        .waitFor({ state: "visible" });
      assert.match(
        (await page.locator("#trendy-bentopdf-workflow-first").textContent()) ||
          "",
        /AI-powered.*PDF Workflow Builder/s,
      );
      assert.equal(
        await page
          .locator("#trendy-bentopdf-workflow-first a")
          .getAttribute("href"),
        "./pdf-workflow.html",
      );
      await page.waitForFunction(
        () => document.querySelectorAll(".tool-card").length > 0,
      );
      const firstTool = page
        .locator(".category-group")
        .first()
        .locator(".tool-card")
        .first();
      assert.equal(
        await firstTool.locator("h3").textContent(),
        "PDF Workflow Builder",
      );
      assert.equal(await firstTool.locator("p").count(), 0);
      assert.match((await firstTool.textContent()) || "", /AI-powered/);
      for (const selector of [
        "#donation-ribbon",
        "#features-section",
        "#security-compliance-section",
        "#faq-accordion",
        "#testimonials-section",
      ]) {
        assert.equal(await page.locator(selector).count(), 0);
      }
      await context.close();
    }

    const validPlan = JSON.stringify({
      version: 2,
      steps: [
        { operation: 'merge', parameters: { retainPageLabels: false } },
        { operation: 'page_numbers', parameters: { position: 'bottom-center', fontSize: 12, numberFormat: 'page_x_of_y', color: '#000000' } },
        { operation: 'compress', parameters: { algorithm: 'condense', compressionLevel: 'balanced' } },
      ],
      filename: 'final-report.pdf', unhandled: [],
    });

    {
      const { context, page, providerRequest } = await configuredPage(
        browser,
        pageUrl,
        validPlan,
      );
      await page.locator("#trendy-ai-workflow-button").click();
      assert.equal(
        await page.locator("#trendy-ai-workflow-provider").textContent(),
        "OpenRouter",
      );
      await page
        .locator("#trendy-ai-workflow-prompt")
        .fill(
          "Merge my PDFs, add page numbers at the bottom center, compress them, and download as final-report.pdf.",
        );
      await page.locator("#trendy-ai-workflow-create").click();
      await page.locator('#trendy-review-confirm').check();
      assert.equal(await page.locator('#node-count').textContent(), '0 nodes');
      await page.locator('#trendy-ai-workflow-apply').click();
      await page.waitForFunction(
        () => document.querySelector("#node-count")?.textContent === "5 nodes",
      );
      assert.equal(await page.locator("#node-count").textContent(), "5 nodes");
      assert.match(
        (await page.locator("#status-text").textContent()) || "",
        /Review it.*press Run/,
      );
      const requestBody = providerRequest();
      assert.equal(requestBody.model, "mock-model");
      assert.equal(requestBody.messages[1].role, "user");
      assert.ok(!JSON.stringify(requestBody).includes("data:application/pdf"));
      assert.equal(
        await page
          .locator("#loader-modal")
          .evaluate((element) => element.classList.contains("hidden")),
        true,
      );
      await context.close();
    }

    const invalidRotationPlan = JSON.stringify({version: 2, steps: [{operation: 'rotate', parameters: {angle: 90}}], unhandled: []});

    {
      const { context, page } = await configuredPage(
        browser,
        pageUrl,
        invalidRotationPlan,
      );
      await page.locator("#trendy-ai-workflow-button").click();
      await page
        .locator("#trendy-ai-workflow-prompt")
        .fill("Fix the document orientation.");
      await page.locator("#trendy-ai-workflow-create").click();
      await page.locator('#trendy-choice-0-angle').waitFor({state:'visible'});
      assert.equal(await page.locator('#node-count').textContent(), '0 nodes');
      await page.locator('#trendy-choice-0-angle').selectOption('270');
      await page.locator('#trendy-review-confirm').check();
      await page.locator('#trendy-ai-workflow-apply').click();
      await page.locator('#trendy-review-confirm').check();
      await page.locator('#trendy-ai-workflow-apply').click();
      await page.waitForFunction(() => document.querySelector('#node-count')?.textContent === '3 nodes');
      await context.close();
    }

    // The other providers use only their fixed, mocked endpoints.
    for (const provider of ['bai','opencode']) {
      const h = await configuredPage(browser,pageUrl,validPlan,provider);
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Merge PDFs, add page numbers and compress.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(() => document.querySelector('#node-count')?.textContent === '5 nodes');
      assert.equal(h.requestCount(),1);
      await h.context.close();
    }

    // Exercise every remaining processing node's actual constructor/controls, not its PDF engine.
    {
      const contractPlan = {version:2,unhandled:[],steps:[
        {operation:'split',parameters:{pages:'1'}},
        {operation:'delete_pages',parameters:{pages:'2'}},
        {operation:'watermark',parameters:{text:'TEST'}},
        {operation:'header_footer',parameters:{headerLeft:'Test'}},
        {operation:'ocr',parameters:{language:'eng'}},
        {operation:'sanitize',parameters:{}},
        {operation:'flatten',parameters:{}},
        {operation:'edit_metadata',parameters:{title:'Test'}},
        {operation:'encrypt',parameters:{}},
      ]};
      const h = await configuredPage(browser,pageUrl,JSON.stringify(contractPlan));
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Select pages, delete page 2, watermark, add header, OCR, sanitize, flatten, set metadata and encrypt.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-secret-8-userPassword').fill('LOCAL_ONLY_TEST_PASSWORD');
      await h.page.locator('#trendy-secret-8-ownerPassword').fill('LOCAL_ONLY_OWNER_PASSWORD');
      assert.equal(await h.page.locator('#trendy-secret-8-userPassword').getAttribute('type'),'password');
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(() => document.querySelector('#node-count')?.textContent === '11 nodes');
      assert.equal(h.requestCount(),1);
      assert.ok(!JSON.stringify(h.providerRequest()).includes('LOCAL_ONLY'));
      const downloadPromise = h.page.waitForEvent('download');
      await h.page.locator('#export-btn').click();
      const download = await downloadPromise;
      const exported = fs.readFileSync(await download.path(),'utf8');
      assert.ok(!exported.includes('LOCAL_ONLY'));
      assert.ok(!exported.includes('userPassword'));
      assert.ok(!exported.includes('ownerPassword'));
      const exportedData = JSON.parse(exported);
      assert.equal(exportedData.version,1);
      assert.equal(exportedData.nodes.length,11);
      await h.page.locator('#save-btn').click();
      await h.page.locator('#save-template-name').fill('Secret-free test');
      await h.page.locator('#save-template-confirm').click();
      await h.page.waitForFunction(() => localStorage.getItem('bento-pdf-workflow-templates')?.includes('Secret-free test'));
      const stored = await h.page.evaluate(() => localStorage.getItem('bento-pdf-workflow-templates'));
      assert.ok(!stored.includes('LOCAL_ONLY'));
      assert.ok(!stored.includes('userPassword'));
      await h.page.locator('#alert-ok').click();
      await h.page.locator('#alert-modal').waitFor({state:'hidden'});
      // Legacy template imports must not rehydrate passwords either.
      const encryptNode = exportedData.nodes.find(n => n.type === 'EncryptNode');
      encryptNode.controls.userPassword = 'LEGACY_IMPORTED_SECRET';
      exportedData.nodes = [exportedData.nodes[0], encryptNode, exportedData.nodes.at(-1)];
      exportedData.nodes.forEach((n,i) => { n.position = {x:50,y:20 + 190*i}; });
      exportedData.connections = exportedData.nodes.slice(0,-1).map((n,i) => ({id:`legacy-${i}`,source:n.id,sourceOutput:'pdf',target:exportedData.nodes[i+1].id,targetInput:'pdf'}));
      const [chooser] = await Promise.all([h.page.waitForEvent('filechooser'), h.page.locator('#import-btn').click()]);
      await chooser.setFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportedData))});
      await h.page.waitForFunction(() => document.querySelector('#node-count')?.textContent === '3 nodes');
      const encryptLabel = JSON.parse(fs.readFileSync(path.join(root,'.build-cache/bentopdf/public/locales/en/tools.json'),'utf8')).encryptPdf.name;
      await h.page.locator('#rete-container').getByText(encryptLabel,{exact:true}).click();
      await h.page.locator('#settings-content input[type=password]').first().waitFor({state:'visible'});
      assert.equal(await h.page.locator('#settings-content input[type=password]').count(),2);
      for(const input of await h.page.locator('#settings-content input[type=password]').all()) assert.equal(await input.inputValue(),'');
      const nextDownload = h.page.waitForEvent('download');
      await h.page.locator('#export-btn').click();
      assert.ok(!fs.readFileSync(await (await nextDownload).path(),'utf8').includes('LEGACY_IMPORTED_SECRET'));
      await h.context.close();
    }

    // Missing values stay local and never use upstream destructive defaults.
    {
      const h = await configuredPage(browser,pageUrl,JSON.stringify({version:2,steps:[{operation:'delete_pages',parameters:{}}],unhandled:[]}));
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Delete some pages.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-choice-0-pages').fill('2-4');
      assert.equal(await h.page.locator('#node-count').textContent(),'0 nodes');
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(() => document.querySelector('#node-count')?.textContent === '3 nodes');
      assert.equal(h.requestCount(),1);
      await h.context.close();
    }
    for (const [content,statusCode] of [['not JSON',200],[validPlan,429]]) {
      const h = await configuredPage(browser,pageUrl,content,'openrouter',statusCode);
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Merge PDFs.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.waitForFunction(() => document.querySelector('#trendy-ai-workflow-status')?.dataset.type === 'error');
      assert.equal(await h.page.locator('#node-count').textContent(),'0 nodes');
      assert.equal(h.requestCount(),1);
      await h.context.close();
    }
    // Local templates work with NO provider configuration or outbound requests.
    for (const id of ['merge-number-compress','rotate-compress','watermark-compress','merge-protect']) {
      const context = await browser.newContext({viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'block'});
      let externalRequests=0;
      await context.route('**/*', route => {
        if(new URL(route.request().url()).origin===new URL(pageUrl).origin) return route.continue();
        externalRequests++; return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#trendy-ai-workflow-button')?.dataset.initialized==='true');
      await page.locator('#trendy-ai-workflow-button').click();
      assert.equal(await page.locator('#trendy-ai-workflow-create').isDisabled(),true);
      await page.locator('#trendy-workflow-template').selectOption(id);
      await page.locator('#trendy-workflow-template-preview').click();
      const box=await page.locator('.trendy-ai-workflow-card').boundingBox();
      assert.ok(box.x>=0 && box.x+box.width<=391, 'Mobile modal overflows viewport');
      if(id==='rotate-compress' || id==='watermark-compress') {
        if(id==='rotate-compress') await page.locator('#trendy-choice-0-angle').selectOption('180');
        else await page.locator('#trendy-choice-0-text').fill('LOCAL WATERMARK');
        await page.locator('#trendy-review-confirm').check();
        await page.locator('#trendy-ai-workflow-apply').click();
      }
      if(id==='merge-protect') await page.locator('#trendy-secret-1-userPassword').fill('LOCAL-TEMPLATE-ONLY');
      assert.equal(await page.locator('#node-count').textContent(),'0 nodes');
      await page.locator('#trendy-review-confirm').check();
      await page.locator('#trendy-ai-workflow-apply').click();
      const expected=id==='merge-number-compress'?'5 nodes':'4 nodes';
      await page.waitForFunction(n=>document.querySelector('#node-count')?.textContent===n,expected);
      assert.match(await page.locator('#status-text').textContent(),/^Template workflow created/);
      assert.equal(externalRequests,0,'Templates must not contact providers or external assets');
      await context.close();
    }

    // Omission guard blocks loading; only an explicit retry makes the second request.
    {
      const short={version:2,steps:[{operation:'merge',parameters:{}}],unhandled:[]};
      const complete={version:2,steps:[...short.steps,{operation:'compress',parameters:{}}],unhandled:[]};
      const h=await configuredPage(browser,pageUrl,n=>JSON.stringify(n===1?short:complete));
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Merge PDFs and compress.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-ai-retry-full').waitFor({state:'visible'});
      assert.equal(h.requestCount(),1);
      assert.equal(await h.page.locator('#node-count').textContent(),'0 nodes');
      assert.equal(await h.page.locator('#trendy-ai-workflow-apply').isVisible(),false);
      assert.ok(!h.requests[0].messages[0].content.includes('tileGapX'));
      await h.page.locator('#trendy-ai-retry-full').click();
      await h.page.locator('#trendy-review-confirm').check();
      assert.equal(h.requestCount(),2);
      assert.ok(h.requests[1].messages[0].content.includes('tileGapX'));
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(()=>document.querySelector('#node-count')?.textContent==='4 nodes');
      await h.context.close();
    }

    // Attached files prevent AI replacement even after a reviewed proposal.
    {
      const h=await configuredPage(browser,pageUrl,JSON.stringify({version:2,steps:[{operation:'merge',parameters:{}}],unhandled:[]}));
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-prompt').fill('Merge PDFs.');
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(()=>document.querySelector('#node-count')?.textContent==='3 nodes');
      const locale=JSON.parse(fs.readFileSync(path.join(root,'.build-cache/bentopdf/public/locales/en/tools.json'),'utf8'));
      await h.page.locator('#rete-container').getByText(locale.pdfWorkflow.specialNodes.pdfInput.name,{exact:true}).click();
      const {PDFDocument}=require(path.join(root,'.build-cache/bentopdf/node_modules/pdf-lib'));
      const pdf=await PDFDocument.create();pdf.addPage();
      await h.page.locator('#settings-content input[type=file]').setInputFiles({name:'synthetic-attached.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
      await h.page.locator('#settings-content').getByText('synthetic-attached.pdf',{exact:true}).waitFor({state:'visible'});
      await h.page.locator('#trendy-ai-workflow-button').click();
      await h.page.locator('#trendy-ai-workflow-create').click();
      await h.page.locator('#trendy-review-confirm').check();
      await h.page.locator('#trendy-ai-workflow-apply').click();
      await h.page.waitForFunction(()=>document.querySelector('#trendy-ai-workflow-status')?.textContent?.includes('attached files'));
      assert.equal(await h.page.locator('#node-count').textContent(),'3 nodes');
      await h.page.keyboard.press('Escape');
      assert.equal(await h.page.locator('#settings-content').getByText('synthetic-attached.pdf',{exact:true}).count(),1);
      await h.context.close();
    }

    console.log("BentoPDF AI mocked browser tests passed: review, clarification, all 13 processing constructors, 3 providers, secret persistence, errors, offline mobile templates, explicit fallback, attached files");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
