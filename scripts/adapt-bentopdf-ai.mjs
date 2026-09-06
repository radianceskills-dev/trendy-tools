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

for (const file of ["planner-v2.js", "safe-workflow.js"]) {
  await copyFile(resolve(integrationRoot, file), resolve(sourceRoot, "src/js/workflow", file));
}
await copyFile(
  resolve(integrationRoot, "capability-registry.js"),
  resolve(sourceRoot, "src/js/workflow/capability-registry.js"),
);
await copyFile(
  resolve(integrationRoot, "workflow-plan.js"),
  resolve(sourceRoot, "src/js/workflow/workflow-plan.js"),
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
serialization = "import { replaceWorkflowSafely, isSensitiveControl } from './safe-workflow.js';\n" + serialization;
serialization = replaceOnce(serialization, "if (control && 'value' in control) {\n        controls[key]", "if (control && 'value' in control && !isSensitiveControl(key)) {\n        controls[key]", "secret export");
serialization = replaceOnce(serialization, "const control = node.controls[key];", "if (isSensitiveControl(key)) continue;\n      const control = node.controls[key];", "secret import");
const wrapper = `export async function loadSerializedWorkflow(
  data: SerializedWorkflow,
  editor: NodeEditor<ClassicScheme>,
  area: AreaPlugin<ClassicScheme, AreaExtra>
): Promise<void> {
  await replaceWorkflowSafely(data, editor, area, createNodeByType,
    (source: ClassicScheme['Node'], output: string, target: ClassicScheme['Node'], input: string) => new ClassicPreset.Connection(source, output, target, input));
}

`;

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
logic = replaceOnce(logic, "key === 'password' || key === 'ownerPassword'", "key === 'password' || key === 'ownerPassword' || key === 'userPassword'", "password mask");
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
