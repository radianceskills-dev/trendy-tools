import { PHASE1_NODE_TYPES, normalizeControls, fail, object, exactKeys, text } from "./capability-registry.js";
export { PHASE1_NODE_TYPES } from "./capability-registry.js";
const NODE_TYPE_SET = new Set(PHASE1_NODE_TYPES);
const MAX_STEPS = 12;
function normalizeFilename(value) {
  const filename = text(value, "plan.download.filename", {
    min: 1,
    max: 120,
    trim: true,
  });
  if (filename === "." || filename === ".." || /[\\/]/.test(filename)) {
    fail("plan.download.filename must be a file name, not a path.");
  }
  return filename;
}

export function validateWorkflowPlan(rawPlan, context = {}) {
  const plan = object(rawPlan, "plan");
  exactKeys(plan, ["version", "steps", "download"], "plan");
  if (plan.version !== 1) fail("plan.version must be 1.");
  if (!Array.isArray(plan.steps)) fail("plan.steps must be an array.");
  if (plan.steps.length > MAX_STEPS)
    fail(`plan.steps may contain at most ${MAX_STEPS} processing nodes.`);

  const steps = plan.steps.map((rawStep, index) => {
    const path = `plan.steps[${index}]`;
    const step = object(rawStep, path);
    exactKeys(step, ["type", "controls"], path);
    if (typeof step.type !== "string" || !NODE_TYPE_SET.has(step.type)) {
      fail(`${path}.type is not allowed in Phase 1.`);
    }
    if (!Object.prototype.hasOwnProperty.call(step, "controls"))
      fail(`${path}.controls is required.`);
    return {
      type: step.type,
      controls: normalizeControls(
        step.type,
        step.controls,
        context,
        `${path}.controls`,
      ),
    };
  });

  const download = object(plan.download, "plan.download");
  exactKeys(download, ["filename"], "plan.download");
  if (!Object.prototype.hasOwnProperty.call(download, "filename"))
    fail("plan.download.filename is required.");

  return {
    version: 1,
    steps,
    download: { filename: normalizeFilename(download.filename) },
  };
}

export function createSerializedWorkflow(validatedPlan) {
  const chain = [
    { type: "PDFInputNode", controls: {} },
    ...validatedPlan.steps,
    {
      type: "DownloadNode",
      controls: { filename: validatedPlan.download.filename },
    },
  ];

  const nodes = chain.map((node, index) => ({
    id: `ai-node-${String(index + 1).padStart(2, "0")}-${node.type.toLowerCase()}`,
    type: node.type,
    position: { x: 160, y: 80 + index * 190 },
    controls: node.controls,
  }));

  const connections = nodes.slice(0, -1).map((node, index) => ({
    id: `ai-connection-${String(index + 1).padStart(2, "0")}`,
    source: node.id,
    sourceOutput: "pdf",
    target: nodes[index + 1].id,
    targetInput: "pdf",
  }));

  return { version: 1, nodes, connections };
}

export function workflowPlanToSerialized(rawPlan, context = {}) {
  return createSerializedWorkflow(validateWorkflowPlan(rawPlan, context));
}

export function parseWorkflowPlanContent(content) {
  if (typeof content !== "string")
    fail("The AI response did not contain text.");
  if (content.length > 30000) fail("The AI response is too large.");
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start)
    fail("The AI response did not contain a JSON object.");
  const json = candidate.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch {
    fail("The AI returned invalid JSON.");
  }
}

export { buildLegacySystemPrompt as buildWorkflowSystemPrompt } from "./capability-registry.js";
