import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve(process.argv[2] ?? ".");
const integrationRoot = resolve(process.argv[3] ?? "integrations/bentopdf-ai");

function replaceOnce(source, from, to, file) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(
      `${file}: expected exactly one integration anchor, found ${count}`,
    );
  }
  return source.replace(from, to);
}

await copyFile(
  resolve(integrationRoot, "workflow-plan.js"),
  resolve(sourceRoot, "src/js/workflow/trendy-ai-plan.js"),
);
await copyFile(
  resolve(integrationRoot, "trendy-workflow-ai.ts"),
  resolve(sourceRoot, "src/js/workflow/trendy-ai.ts"),
);
await copyFile(
  resolve(integrationRoot, "trendy-workflow-ai.css"),
  resolve(sourceRoot, "src/css/trendy-workflow-ai.css"),
);

const serializationPath = resolve(
  sourceRoot,
  "src/js/workflow/serialization.ts",
);
let serialization = await readFile(serializationPath, "utf8");
const serializationAnchor =
  "const TEMPLATES_KEY = 'bento-pdf-workflow-templates';";
const wrapper = `export async function loadSerializedWorkflow(\n  data: SerializedWorkflow,\n  editor: NodeEditor<ClassicScheme>,\n  area: AreaPlugin<ClassicScheme, AreaExtra>\n): Promise<void> {\n  await deserializeWorkflow(data, editor, area);\n}\n\n`;
serialization = replaceOnce(
  serialization,
  serializationAnchor,
  `${wrapper}${serializationAnchor}`,
  "src/js/workflow/serialization.ts",
);
await writeFile(serializationPath, serialization);

const logicPath = resolve(sourceRoot, "src/js/logic/pdf-workflow-page.ts");
let logic = await readFile(logicPath, "utf8");
const logicImportAnchor =
  "import type { WorkflowEditor } from '@/js/workflow/editor';";
logic = replaceOnce(
  logic,
  logicImportAnchor,
  `${logicImportAnchor}\nimport { initializeTrendyWorkflowAI } from '@/js/workflow/trendy-ai';`,
  "src/js/logic/pdf-workflow-page.ts",
);
const logicInitAnchor = "  const { editor, area, engine } = workflowEditor;";
logic = replaceOnce(
  logic,
  logicInitAnchor,
  `${logicInitAnchor}\n\n  initializeTrendyWorkflowAI(workflowEditor);`,
  "src/js/logic/pdf-workflow-page.ts",
);
await writeFile(logicPath, logic);

const toolbarButton = (
  await readFile(resolve(integrationRoot, "toolbar-button.html"), "utf8")
).trim();
const modal = (
  await readFile(resolve(integrationRoot, "modal.html"), "utf8")
).trim();
const pagePath = resolve(sourceRoot, "src/pages/pdf-workflow.html");
let page = await readFile(pagePath, "utf8");
const cssAnchor = '    <link href="/src/css/styles.css" rel="stylesheet" />';
page = replaceOnce(
  page,
  cssAnchor,
  `${cssAnchor}\n    <link href="/src/css/trendy-workflow-ai.css" rel="stylesheet" />`,
  "src/pages/pdf-workflow.html",
);
const buttonAnchor = '          <button\n            id="clear-btn"';
const indentedToolbarButton = toolbarButton
  .split("\n")
  .map((line) => `          ${line}`)
  .join("\n");
page = replaceOnce(
  page,
  buttonAnchor,
  `${indentedToolbarButton}\n          <button\n            id="clear-btn"`,
  "src/pages/pdf-workflow.html",
);
const modalAnchor = "    <!-- Loader Modal -->";
page = replaceOnce(
  page,
  modalAnchor,
  `${modal}\n\n${modalAnchor}`,
  "src/pages/pdf-workflow.html",
);
await writeFile(pagePath, page);

console.log("Added Trendy Tools create-with-AI integration to BentoPDF");
