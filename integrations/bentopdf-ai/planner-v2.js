import { CAPABILITIES, normalizeControls, object, exactKeys, text } from './capability-registry.js';
import { createSerializedWorkflow, parseWorkflowPlanContent } from './workflow-plan.js';
export { parseWorkflowPlanContent };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function guardPrompt(request) {
  text(request, 'request', { min: 1, max: 4000 });
  const scrubbed = request.replace(/password[ -]protect(?:ed|ion)?/gi, 'encrypt');
  // A best-effort warning, not a promise to detect all secrets in arbitrary prose.
  if (/(?:password|passphrase|api[ _-]?key|secret)\s*(?:is\b|[:=]|to\b|["'])|(?:password|passphrase)\s+\S+/i.test(scrubbed)) {
    throw new Error('Remove passwords and secrets from the description. Enter the PDF password locally after generation.');
  }
}

export function readPlanV2(raw) {
  const p = object(raw, 'plan');
  exactKeys(p, ['version', 'steps', 'filename', 'unhandled'], 'plan');
  if (p.version !== 2) throw new Error('Expected AI Plan v2. Please generate again.');
  if (!Array.isArray(p.steps) || p.steps.length > 12) throw new Error('Use at most 12 processing steps.');
  if (!Array.isArray(p.unhandled) || p.unhandled.length > 12) throw new Error('unhandled must be an array with at most 12 items.');
  const unhandled = p.unhandled.map(s => text(s, 'unhandled item', { min: 1, max: 500 }));
  const steps = p.steps.map((rawStep, i) => {
    const step = object(rawStep, `steps[${i}]`);
    exactKeys(step, ['operation', 'parameters'], `steps[${i}]`);
    if (typeof step.operation !== 'string' || (!own(CAPABILITIES, step.operation) || !CAPABILITIES[step.operation].enabled)) throw new Error(`Unsupported operation at step ${i + 1}.`);
    const parameters = object(step.parameters, `steps[${i}].parameters`);
    exactKeys(parameters, CAPABILITIES[step.operation].aiKeys, `steps[${i}].parameters`);
    return { operation: step.operation, parameters: { ...parameters } };
  });
  const filename = p.filename === undefined ? 'output' : text(p.filename, 'filename', { min: 1, max: 120, trim: true });
  if (filename === '.' || filename === '..' || /[\\/]/.test(filename)) throw new Error('filename must be a simple name, not a path.');
  return { version: 2, steps, filename, unhandled };
}

export function assessPlan(raw, context = {}) {
  const plan = readPlanV2(raw), questions = [], warnings = [];
  const steps = plan.steps.map((step, i) => {
    const cap = CAPABILITIES[step.operation];
    const parameters = { ...cap.defaults, ...step.parameters };
    const ask = (key, label, choices = null) => {
      if (!questions.some(q => q.step === i && q.key === key)) questions.push({ step: i, key, label, choices });
    };
    for (const key of cap.required) {
      if (!own(step.parameters, key) || step.parameters[key] == null || step.parameters[key] === '') {
        ask(key, `${cap.label}: ${key}`, key === 'angle' ? [90, 180, 270] : null);
        delete parameters[key];
      }
    }
    for (const [key, value] of Object.entries(step.parameters)) if (value === null) {
      ask(key, `${cap.label}: ${key}`, key === 'angle' && step.operation === 'rotate' ? [90, 180, 270] : null);
      delete parameters[key];
    }
    if (cap.atLeastOne && !cap.atLeastOne.some(k => typeof parameters[k] === 'string' && parameters[k].trim())) {
      const key = cap.atLeastOne[0];
      ask(key, `${cap.label}: specify ${key}, or revise your description for another field`);
    }
    if (step.operation === 'rotate' && !context.confirmedRotations?.includes(i)) ask('angle', 'Confirm clockwise rotation (270° = 90° counter-clockwise)', [90, 180, 270]);
    if (cap.warning) warnings.push(`${i + 1}. ${cap.warning}`);
    if (step.operation === 'encrypt' && i !== plan.steps.length - 1) throw new Error('Encryption must be the final processing step. Revise the order explicitly.');
    if (step.operation === 'encrypt') return { ...step, parameters: {}, controls: {} };
    const pending = questions.filter(q => q.step === i).map(q => q.key);
    // Check all supplied values, including a proposed rotation awaiting confirmation.
    const supplied = Object.fromEntries(Object.entries(parameters).filter(([, v]) => v !== null && v !== undefined));
    const controls = normalizeControls(cap.nodeType, step.operation === 'rotate' && !own(supplied, 'angle') ? { ...supplied, angle: 90 } : supplied,
      { ...context, request: 'Rotate 90 degrees clockwise.' }, `steps[${i}].parameters`);
    if (step.operation === 'rotate' && pending.includes('angle')) delete controls.angle;
    // Pin upstream's implicit watermark center rather than depending on its future constructor default.
    if (step.operation === 'watermark' && !own(supplied, 'position')) controls.position = 'center';
    return { ...step, parameters, controls };
  });
  return { plan, steps, questions, warnings, status: plan.unhandled.length || !steps.length ? 'unsupported' : questions.length ? 'needs_clarification' : 'ready' };
}

export function compilePlanV2(raw, context = {}) {
  const result = assessPlan(raw, context);
  if (result.status !== 'ready') throw new Error('Resolve all missing choices and unsupported requests before loading.');
  const steps = result.steps.map((step, i) => ({ type: CAPABILITIES[step.operation].nodeType,
    controls: step.operation === 'encrypt' ? normalizeControls('EncryptNode', context.localSecrets?.[i] || {}, {}, 'Local password') : step.controls }));
  return createSerializedWorkflow({ steps, download: { filename: result.plan.filename } });
}

export function buildPlanV2Prompt(operationIds = Object.keys(CAPABILITIES)) {
  if (!Array.isArray(operationIds) || !operationIds.length || new Set(operationIds).size !== operationIds.length || operationIds.some(id => !own(CAPABILITIES, id) || !CAPABILITIES[id].enabled)) throw new Error('Invalid capability selection.');
  const catalog = Object.entries(CAPABILITIES).filter(([,c]) => c.enabled).map(([id,c]) => `${id}: ${c.label}`).join('; ');
  const entries = operationIds.map(id => [id, CAPABILITIES[id]]).map(([id, c]) => `${id}: ${c.label}. Parameters: ${c.promptControls} Required: ${c.required.join(', ') || 'none'}.`);
  return `Translate the request into a PDF workflow proposal. Return ONE JSON object only.
Schema: {"version":2,"steps":[{"operation":"${operationIds[0]}","parameters":{}}],"unhandled":[]}
Optional filename is a simple name; omit unless requested. Maximum 12 steps in requested order.
Never invent or omit operations. Put unsupported or unclear request portions in unhandled (short strings).
Use null for missing required parameters. Do not invent page numbers, angles, watermark text, or passwords.
Never include input/download nodes, IDs, sockets or connections. The app adds them.
Encryption has NO AI parameters: passwords are entered locally. Encryption must be the last processing step.
Rotation affects ALL pages, not selected pages. Split selects pages into one PDF per input, not separate PDFs per page.
Metadata sets nonempty fields and does not erase them. Use unhandled for unsupported erasure.
Use {} for ordinary defaults. The user reviews, resolves missing choices and explicitly runs.
Catalog (names only): ${catalog}
Detailed parameters follow only for selected operations. If needed details are absent, name the missing capability in unhandled. Never omit part of the request or invent parameters.
${entries.join('\n')}`;
}
