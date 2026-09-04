import assert from "node:assert/strict";
import {
  parseWorkflowPlanContent,
  validateWorkflowPlan,
  workflowPlanToSerialized,
} from "./workflow-plan.js";

const valid = {
  version: 1,
  steps: [
    { type: "MergeNode", controls: { retainPageLabels: false } },
    {
      type: "CompressNode",
      controls: { compressionLevel: "balanced", removeMetadata: true },
    },
  ],
  download: { filename: "combined.pdf" },
};

const workflow = workflowPlanToSerialized(valid, {
  request: "Merge and compress my PDFs.",
});
assert.deepEqual(
  workflow.nodes.map((node) => node.type),
  ["PDFInputNode", "MergeNode", "CompressNode", "DownloadNode"],
);
assert.equal(workflow.connections.length, 3);
assert.ok(
  workflow.connections.every(
    (connection) =>
      connection.sourceOutput === "pdf" && connection.targetInput === "pdf",
  ),
);
assert.equal(workflow.nodes[1].controls.retainPageLabels, "false");
assert.equal(workflow.nodes[2].controls.removeMetadata, "true");

assert.deepEqual(
  parseWorkflowPlanContent(
    '```json\n{"version":1,"steps":[],"download":{"filename":"output"}}\n```',
  ),
  {
    version: 1,
    steps: [],
    download: { filename: "output" },
  },
);

assert.throws(
  () => validateWorkflowPlan({ ...valid, extra: true }, { request: "merge" }),
  /not allowed/,
);
assert.throws(
  () =>
    validateWorkflowPlan({
      version: 1,
      steps: [{ type: "RepairNode", controls: {} }],
      download: { filename: "x" },
    }),
  /not allowed/,
);
assert.throws(
  () =>
    validateWorkflowPlan(
      {
        version: 1,
        steps: [{ type: "RotateNode", controls: { angle: 90 } }],
        download: { filename: "x" },
      },
      { request: "Fix the orientation." },
    ),
  /explicitly supplies/,
);
assert.doesNotThrow(() =>
  validateWorkflowPlan(
    {
      version: 1,
      steps: [{ type: "RotateNode", controls: { angle: 270 } }],
      download: { filename: "x" },
    },
    { request: "Rotate 90 degrees counter-clockwise." },
  ),
);
assert.throws(
  () =>
    validateWorkflowPlan({
      version: 1,
      steps: [{ type: "CompressNode", controls: { imageQuality: 101 } }],
      download: { filename: "x" },
    }),
  /between 1 and 100/,
);
assert.throws(
  () =>
    validateWorkflowPlan({
      version: 1,
      steps: [],
      download: { filename: "../output.pdf" },
    }),
  /not a path/,
);
assert.throws(
  () =>
    validateWorkflowPlan({
      version: 1,
      steps: [{ type: "EncryptNode", controls: {} }],
      download: { filename: "secure" },
    }),
  /userPassword is required/,
);
assert.throws(
  () =>
    validateWorkflowPlan(
      {
        version: 1,
        steps: [{ type: "OCRNode", controls: { language: "fra" } }],
        download: { filename: "ocr" },
      },
      { languageCodes: new Set(["eng"]) },
    ),
  /unavailable language code/,
);

console.log("BentoPDF AI workflow plan tests passed");
