export const PHASE1_NODE_TYPES = Object.freeze([
  "MergeNode",
  "SplitNode",
  "RotateNode",
  "DeletePagesNode",
  "PageNumbersNode",
  "WatermarkNode",
  "HeaderFooterNode",
  "CompressNode",
  "OCRNode",
  "EncryptNode",
  "SanitizeNode",
  "FlattenNode",
  "EditMetadataNode",
]);

const NODE_TYPE_SET = new Set(PHASE1_NODE_TYPES);
const MAX_STEPS = 12;
const PAGE_SPEC = /^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const OCR_LANGUAGE = /^[a-z0-9_]+(?:\+[a-z0-9_]+)*$/;

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value, path) {
  if (!isPlainObject(value)) fail(`${path} must be an object.`);
  return value;
}

function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${path}.${key} is not allowed.`);
  }
}

function text(value, path, { min = 0, max = 500, trim = false } = {}) {
  if (typeof value !== "string") fail(`${path} must be a string.`);
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max) {
    fail(`${path} must contain between ${min} and ${max} characters.`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    fail(`${path} contains unsupported control characters.`);
  }
  return result;
}

function number(value, path, min, max, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${path} must be a finite number.`);
  }
  if (integer && !Number.isInteger(value)) fail(`${path} must be an integer.`);
  if (value < min || value > max)
    fail(`${path} must be between ${min} and ${max}.`);
  return value;
}

function booleanString(value, path) {
  if (typeof value !== "boolean") fail(`${path} must be true or false.`);
  return value ? "true" : "false";
}

function yesNo(value, path) {
  if (typeof value !== "boolean") fail(`${path} must be true or false.`);
  return value ? "yes" : "no";
}

function oneOf(value, allowed, path) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`${path} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function color(value, path) {
  const result = text(value, path, { min: 7, max: 7, trim: true });
  if (!HEX_COLOR.test(result))
    fail(`${path} must be a six-digit hex color such as #000000.`);
  return result.toLowerCase();
}

function pageSpec(value, path, allowAll = false) {
  const result = text(value, path, {
    min: 1,
    max: 200,
    trim: true,
  }).toLowerCase();
  if (allowAll && result === "all") return result;
  if (!PAGE_SPEC.test(result))
    fail(`${path} must use page numbers/ranges such as "1-3, 5".`);
  for (const part of result.split(",")) {
    const [startText, endText] = part.split("-").map((item) => item.trim());
    const start = Number(startText);
    const end = endText ? Number(endText) : start;
    if (start < 1 || end < 1 || end < start || start > 100000 || end > 100000) {
      fail(`${path} contains an invalid page number or range.`);
    }
  }
  return result.replace(/\s+/g, "");
}

function rotationWasExplicit(request) {
  if (typeof request !== "string") return false;
  const angleOrDirection =
    "(?:90|180|270)(?:\\s*(?:°|degrees?))?|clockwise|counter(?:-|\\s)?clockwise|left|right";
  const rotateWord = "(?:rotate|rotation|turn)";
  return new RegExp(
    `${rotateWord}[^.!?\\n]{0,50}${angleOrDirection}|${angleOrDirection}[^.!?\\n]{0,30}${rotateWord}`,
    "i",
  ).test(request);
}

function normalizeControls(type, rawControls, context, path) {
  const controls = object(rawControls, path);
  const out = {};
  const allowed = CONTROL_KEYS[type];
  exactKeys(controls, allowed, path);

  const optional = (key, normalize) => {
    if (Object.prototype.hasOwnProperty.call(controls, key)) {
      out[key] = normalize(controls[key], `${path}.${key}`);
    }
  };

  switch (type) {
    case "MergeNode":
      optional("retainPageLabels", booleanString);
      break;
    case "SplitNode":
    case "DeletePagesNode":
      optional("pages", (value, valuePath) => pageSpec(value, valuePath));
      break;
    case "RotateNode":
      if (!rotationWasExplicit(context.request)) {
        fail(
          "RotateNode may only be used when the user explicitly supplies an angle or direction.",
        );
      }
      optional("angle", (value, valuePath) =>
        String(number(value, valuePath, 90, 270, true)),
      );
      if (
        !Object.prototype.hasOwnProperty.call(out, "angle") ||
        !["90", "180", "270"].includes(out.angle)
      ) {
        fail(`${path}.angle must be 90, 180, or 270.`);
      }
      break;
    case "PageNumbersNode":
      optional("position", (value, valuePath) =>
        oneOf(value, PAGE_NUMBER_POSITIONS, valuePath),
      );
      optional("fontSize", (value, valuePath) =>
        number(value, valuePath, 4, 72),
      );
      optional("numberFormat", (value, valuePath) =>
        oneOf(value, ["simple", "page_x_of_y"], valuePath),
      );
      optional("color", color);
      break;
    case "WatermarkNode":
      optional("text", (value, valuePath) =>
        text(value, valuePath, { min: 1, max: 200 }),
      );
      optional("fontSize", (value, valuePath) =>
        number(value, valuePath, 4, 240),
      );
      optional("color", color);
      optional("opacity", (value, valuePath) =>
        number(value, valuePath, 0, 100),
      );
      optional("angle", (value, valuePath) =>
        number(value, valuePath, -360, 360),
      );
      optional("position", (value, valuePath) =>
        oneOf(value, WATERMARK_POSITIONS, valuePath),
      );
      optional("tile", yesNo);
      optional("tileGapX", (value, valuePath) =>
        number(value, valuePath, 0, 500),
      );
      optional("tileGapY", (value, valuePath) =>
        number(value, valuePath, 0, 500),
      );
      optional("pages", (value, valuePath) => pageSpec(value, valuePath, true));
      optional("flatten", yesNo);
      break;
    case "HeaderFooterNode":
      for (const key of HEADER_FOOTER_TEXT_KEYS) {
        optional(key, (value, valuePath) =>
          text(value, valuePath, { max: 500 }),
        );
      }
      optional("fontSize", (value, valuePath) =>
        number(value, valuePath, 4, 72),
      );
      optional("color", color);
      break;
    case "CompressNode":
      optional("algorithm", (value, valuePath) =>
        oneOf(value, ["condense", "photon"], valuePath),
      );
      optional("compressionLevel", (value, valuePath) =>
        oneOf(value, ["light", "balanced", "aggressive", "extreme"], valuePath),
      );
      optional("imageQuality", (value, valuePath) =>
        number(value, valuePath, 1, 100),
      );
      optional("dpiTarget", (value, valuePath) =>
        number(value, valuePath, 36, 600),
      );
      optional("dpiThreshold", (value, valuePath) =>
        number(value, valuePath, 36, 1200),
      );
      for (const key of COMPRESS_BOOLEAN_KEYS) optional(key, booleanString);
      break;
    case "OCRNode":
      optional("language", (value, valuePath) => {
        const result = text(value, valuePath, {
          min: 3,
          max: 100,
          trim: true,
        }).toLowerCase();
        if (!OCR_LANGUAGE.test(result))
          fail(
            `${valuePath} must contain Tesseract language codes joined with +.`,
          );
        if (context.languageCodes instanceof Set) {
          for (const code of result.split("+")) {
            if (!context.languageCodes.has(code))
              fail(
                `${valuePath} contains unavailable language code "${code}".`,
              );
          }
        }
        return result;
      });
      optional("resolution", (value, valuePath) =>
        oneOf(value, ["2.0", "3.0", "4.0"], valuePath),
      );
      optional("binarize", booleanString);
      optional("whitelist", (value, valuePath) =>
        text(value, valuePath, { max: 300 }),
      );
      break;
    case "EncryptNode":
      optional("userPassword", (value, valuePath) =>
        text(value, valuePath, { min: 1, max: 128 }),
      );
      optional("ownerPassword", (value, valuePath) =>
        text(value, valuePath, { max: 128 }),
      );
      if (!Object.prototype.hasOwnProperty.call(out, "userPassword")) {
        fail(`${path}.userPassword is required for EncryptNode.`);
      }
      break;
    case "SanitizeNode":
      for (const key of SANITIZE_BOOLEAN_KEYS) optional(key, booleanString);
      break;
    case "EditMetadataNode":
      for (const key of METADATA_KEYS) {
        optional(key, (value, valuePath) =>
          text(value, valuePath, { max: key === "keywords" ? 1000 : 500 }),
        );
      }
      break;
    case "FlattenNode":
      break;
    default:
      fail(`${path} uses unsupported node type ${type}.`);
  }

  return out;
}

const PAGE_NUMBER_POSITIONS = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
];
const WATERMARK_POSITIONS = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
  "top",
  "bottom",
];
const HEADER_FOOTER_TEXT_KEYS = [
  "headerLeft",
  "headerCenter",
  "headerRight",
  "footerLeft",
  "footerCenter",
  "footerRight",
];
const COMPRESS_BOOLEAN_KEYS = [
  "removeMetadata",
  "subsetFonts",
  "convertToGrayscale",
  "removeThumbnails",
];
const SANITIZE_BOOLEAN_KEYS = [
  "flattenForms",
  "removeMetadata",
  "removeAnnotations",
  "removeJavascript",
  "removeEmbeddedFiles",
  "removeLayers",
  "removeLinks",
  "removeStructureTree",
  "removeMarkInfo",
  "removeFonts",
];
const METADATA_KEYS = [
  "title",
  "author",
  "subject",
  "keywords",
  "creator",
  "producer",
];

const CONTROL_KEYS = Object.freeze({
  MergeNode: ["retainPageLabels"],
  SplitNode: ["pages"],
  RotateNode: ["angle"],
  DeletePagesNode: ["pages"],
  PageNumbersNode: ["position", "fontSize", "numberFormat", "color"],
  WatermarkNode: [
    "text",
    "fontSize",
    "color",
    "opacity",
    "angle",
    "position",
    "tile",
    "tileGapX",
    "tileGapY",
    "pages",
    "flatten",
  ],
  HeaderFooterNode: [...HEADER_FOOTER_TEXT_KEYS, "fontSize", "color"],
  CompressNode: [
    "algorithm",
    "compressionLevel",
    "imageQuality",
    "dpiTarget",
    "dpiThreshold",
    ...COMPRESS_BOOLEAN_KEYS,
  ],
  OCRNode: ["language", "resolution", "binarize", "whitelist"],
  EncryptNode: ["userPassword", "ownerPassword"],
  SanitizeNode: [...SANITIZE_BOOLEAN_KEYS],
  FlattenNode: [],
  EditMetadataNode: [...METADATA_KEYS],
});

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

export function buildWorkflowSystemPrompt() {
  return `You create a new BentoPDF workflow plan. Return only one JSON object, without Markdown or explanation.

The exact top-level schema is:
{"version":1,"steps":[{"type":"CompressNode","controls":{"compressionLevel":"balanced"}}],"download":{"filename":"output"}}

Rules:
1. Top-level keys must be exactly version, steps, download. version must be 1.
2. steps is a linear ordered list of zero to 12 processing nodes. Each step must contain exactly type and controls.
3. Do not include PDFInputNode or DownloadNode in steps. The application adds exactly one of each.
4. Allowed step types only: ${PHASE1_NODE_TYPES.join(", ")}.
5. Use RotateNode only when the user explicitly states an angle or direction. Never infer rotation from phrases such as fix orientation.
6. Never add operations that the user did not request. Use {} for controls when defaults are suitable.
7. Never output Rete nodes, positions, IDs, sockets, or connections.
8. download.filename is a simple file name, never a path.
9. The workflow is created for review only; it is never executed automatically.

Allowed controls and value types:
- MergeNode: retainPageLabels boolean.
- SplitNode: pages string like "1-3,5".
- RotateNode: angle number, exactly 90, 180, or 270.
- DeletePagesNode: pages string like "1,4-6".
- PageNumbersNode: position one of ${PAGE_NUMBER_POSITIONS.join(", ")}; fontSize 4..72; numberFormat simple or page_x_of_y; color #RRGGBB.
- WatermarkNode: text; fontSize 4..240; color #RRGGBB; opacity 0..100; angle -360..360; position one of ${WATERMARK_POSITIONS.join(", ")}; tile boolean; tileGapX/tileGapY 0..500; pages "all" or ranges; flatten boolean.
- HeaderFooterNode: headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight strings; fontSize 4..72; color #RRGGBB. {page} and {total} placeholders are allowed.
- CompressNode: algorithm condense or photon; compressionLevel light, balanced, aggressive, or extreme; imageQuality 1..100; dpiTarget 36..600; dpiThreshold 36..1200; removeMetadata, subsetFonts, convertToGrayscale, removeThumbnails booleans.
- OCRNode: language Tesseract code(s) joined by +, normally eng; resolution "2.0", "3.0", or "4.0"; binarize boolean; whitelist string.
- EncryptNode: userPassword required string; ownerPassword optional string. Copy passwords exactly from the user request; never invent one.
- SanitizeNode: flattenForms, removeMetadata, removeAnnotations, removeJavascript, removeEmbeddedFiles, removeLayers, removeLinks, removeStructureTree, removeMarkInfo, removeFonts booleans.
- FlattenNode: no controls.
- EditMetadataNode: title, author, subject, keywords, creator, producer strings.

Before responding, verify that every key, node type, control, enum, boolean, number, page range, and filename follows this schema.`;
}
