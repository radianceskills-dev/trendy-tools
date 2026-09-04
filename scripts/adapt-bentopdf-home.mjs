import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve(process.argv[2] ?? ".");
const integrationRoot = resolve(
  process.argv[3] ?? "integrations/bentopdf-home",
);

function replaceOnce(source, from, to, file) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(
      `${file}: expected exactly one integration anchor, found ${count}`,
    );
  }
  return source.replace(from, to);
}

function replaceRange(source, start, end, replacement, file) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`${file}: homepage integration range anchor changed`);
  }
  if (source.indexOf(start, startIndex + start.length) >= 0) {
    throw new Error(`${file}: homepage integration start anchor is ambiguous`);
  }
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

const homeContent = (
  await readFile(resolve(integrationRoot, "home-content.html"), "utf8")
).trim();

const indexPath = resolve(sourceRoot, "index.html");
let index = await readFile(indexPath, "utf8");
index = replaceRange(
  index,
  "    <!-- Donation Ribbon -->",
  '    <div id="app" class="min-h-screen container mx-auto p-4 md:p-8">',
  "",
  "index.html",
);
index = replaceRange(
  index,
  '      <section id="hero-section"',
  '      <div id="grid-view">',
  `${homeContent}\n\n`,
  "index.html",
);
index = replaceRange(
  index,
  '      <div class="section-divider hide-section mb-20 mt-10"></div>',
  '      <div id="signature-ghost" class="hidden"></div>',
  "",
  "index.html",
);
await writeFile(indexPath, index);

const mainPath = resolve(sourceRoot, "src/js/main.ts");
let main = await readFile(mainPath, "utf8");
const subtitleBlock = `\n        if (tool.subtitle) {\n          const toolSubtitle = document.createElement('p');\n          toolSubtitle.className = 'text-xs text-gray-400 mt-1 px-2';\n          toolSubtitle.textContent = toolKey\n            ? t(\`${"${toolKey}"}.subtitle\`)\n            : tool.subtitle;\n          toolCard.appendChild(toolSubtitle);\n        }\n`;
main = replaceOnce(main, subtitleBlock, "\n", "src/js/main.ts");
const cardAppendAnchor = "        toolCard.append(icon, toolName);";
const workflowBadge = `        toolCard.append(icon, toolName);\n\n        if (tool.name === 'PDF Workflow Builder') {\n          const aiBadge = document.createElement('span');\n          aiBadge.className =\n            'mt-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300';\n          aiBadge.textContent = 'AI-powered';\n          toolCard.appendChild(aiBadge);\n        }`;
main = replaceOnce(main, cardAppendAnchor, workflowBadge, "src/js/main.ts");
await writeFile(mainPath, main);

const toolsPath = resolve(sourceRoot, "src/js/config/tools.ts");
let tools = await readFile(toolsPath, "utf8");
const editTool = `      {\n        href: import.meta.env.BASE_URL + 'edit-pdf-text.html',\n        name: 'Edit PDF Text',\n        icon: 'ph-cursor-text',\n        subtitle:\n          'Click any paragraph and edit it in place with live reflow, fonts, and styling.',\n      },\n`;
const workflowTool = `      {\n        href: import.meta.env.BASE_URL + 'pdf-workflow.html',\n        name: 'PDF Workflow Builder',\n        icon: 'ph-tree-structure',\n        subtitle:\n          'Build custom PDF processing pipelines with a visual node editor.',\n      },\n`;
tools = replaceOnce(
  tools,
  `${editTool}${workflowTool}`,
  `${workflowTool}${editTool}`,
  "src/js/config/tools.ts",
);
await writeFile(toolsPath, tools);

console.log(
  "Simplified BentoPDF homepage and prioritized the AI workflow builder",
);
