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

async function configuredPage(browser, pageUrl, responseContent) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  let providerRequest;

  await page.addInitScript(() => {
    localStorage.setItem(
      "trendytools.ai.v1",
      JSON.stringify({
        version: 1,
        provider: "openrouter",
        providerLabel: "OpenRouter",
        apiKey: "mock-key",
        model: "mock-model",
        endpoint: "https://untrusted.example.invalid/chat/completions",
      }),
    );
  });

  await page.route(
    "https://openrouter.ai/api/v1/chat/completions",
    async (route) => {
      providerRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: responseContent } }],
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
  return { context, page, providerRequest: () => providerRequest };
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
      });
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
      version: 1,
      steps: [
        { type: "MergeNode", controls: { retainPageLabels: false } },
        {
          type: "PageNumbersNode",
          controls: {
            position: "bottom-center",
            fontSize: 12,
            numberFormat: "page_x_of_y",
            color: "#000000",
          },
        },
        {
          type: "CompressNode",
          controls: { algorithm: "condense", compressionLevel: "balanced" },
        },
      ],
      download: { filename: "final-report.pdf" },
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

    const invalidRotationPlan = JSON.stringify({
      version: 1,
      steps: [{ type: "RotateNode", controls: { angle: 90 } }],
      download: { filename: "fixed.pdf" },
    });

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
      await page.waitForFunction(
        () =>
          document.querySelector("#trendy-ai-workflow-status")?.dataset.type ===
          "error",
      );
      assert.match(
        (await page.locator("#trendy-ai-workflow-status").textContent()) || "",
        /explicitly supplies/,
      );
      assert.equal(await page.locator("#node-count").textContent(), "0 nodes");
      await context.close();
    }

    console.log("BentoPDF AI mocked browser tests passed");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
