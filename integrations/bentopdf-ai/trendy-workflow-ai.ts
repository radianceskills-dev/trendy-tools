import type { WorkflowEditor } from "./editor";
import type { SerializedWorkflow } from "./types";
import { loadSerializedWorkflow } from "./serialization";
import { getAvailableTesseractLanguageEntries } from "../utils/tesseract-language-availability.js";
import {
  buildPlanV2Prompt,
  parseWorkflowPlanContent,
  readPlanV2,
  assessPlan,
  compilePlanV2,
  guardPrompt,
} from "./planner-v2.js";

const STORAGE_KEY = "trendytools.ai.v1";
const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
  bai: {
    label: "B.AI",
    endpoint: "https://api.b.ai/v1/chat/completions",
  },
  opencode: {
    label: "OpenCode Zen",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
  },
} as const;

type ProviderId = keyof typeof PROVIDERS;
interface AISettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

let controller: AbortController | undefined;

function readSettings(): AISettings | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "null",
    ) as Partial<AISettings> | null;
    if (!value || !value.provider || !(value.provider in PROVIDERS))
      return null;
    if (typeof value.apiKey !== "string" || !value.apiKey.trim()) return null;
    if (typeof value.model !== "string" || !value.model.trim()) return null;
    return {
      provider: value.provider,
      apiKey: value.apiKey.trim(),
      model: value.model.trim(),
    };
  } catch {
    return null;
  }
}

function extractContent(payload: unknown): string {
  const content = (
    payload as { choices?: { message?: { content?: unknown } }[] }
  )?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        )
          return part.text;
        return "";
      })
      .join("");
  }
  return "";
}

function providerError(payload: unknown, status: number): string {
  const message = (payload as { error?: { message?: unknown } })?.error
    ?.message;
  return typeof message === "string" && message.trim()
    ? message
    : `Provider request failed (${status}).`;
}

import { selectCapabilities, auditSelection } from "./capability-selection.js";
import { WORKFLOW_TEMPLATES, getTemplatePlan } from "./workflow-templates.js";
import { CAPABILITIES } from "./capability-registry.js";
import { assertReplaceable } from "./safe-workflow.js";

export function initializeTrendyWorkflowAI(workflowEditor: WorkflowEditor): void {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const openButton = byId<HTMLButtonElement>('trendy-ai-workflow-button');
  const modal = byId<HTMLDivElement>('trendy-ai-workflow-modal');
  const prompt = byId<HTMLTextAreaElement>('trendy-ai-workflow-prompt');
  const createButton = byId<HTMLButtonElement>('trendy-ai-workflow-create');
  const badge = byId<HTMLSpanElement>('trendy-ai-workflow-provider');
  const status = byId<HTMLParagraphElement>('trendy-ai-workflow-status');
  const review = byId<HTMLDivElement>('trendy-ai-workflow-review');
  const applyButton = byId<HTMLButtonElement>('trendy-ai-workflow-apply');
  const templateSelect = byId<HTMLSelectElement>('trendy-workflow-template');
  const templateButton = byId<HTMLButtonElement>('trendy-workflow-template-preview');
  const fullCatalog = byId<HTMLInputElement>('trendy-ai-full-catalog');
  const retryFull = byId<HTMLButtonElement>('trendy-ai-retry-full');
  const selectionStatus = byId<HTMLParagraphElement>('trendy-ai-selection-status');
  if (!openButton || !modal || !prompt || !createButton || !badge || !status || !review || !applyButton || !templateSelect || !templateButton || !fullCatalog || !retryFull || !selectionStatus) return;
  if (openButton.dataset.initialized === 'true') return;
  openButton.dataset.initialized = 'true';
  const languageCodes = new Set(getAvailableTesseractLanguageEntries().map(([code]) => code));
  let draft: ReturnType<typeof readPlanV2> | null = null;
  let confirmedRotations: number[] = [];
  let activeSelection: ReturnType<typeof selectCapabilities> | null = null;
  let planOrigin: 'ai' | 'template' = 'ai';
  for (const template of WORKFLOW_TEMPLATES) {
    const option = document.createElement('option'); option.value = template.id; option.textContent = template.label; templateSelect.appendChild(option);
  }
  let epoch = 0, busy = false, applying = false;
  let previousFocus: HTMLElement | null = null;
  const inerted: HTMLElement[] = [];
  const closeButtons = Array.from(modal.querySelectorAll<HTMLButtonElement>('[data-trendy-ai-close]'));
  function setStatus(message: string, type = '') { status!.textContent = message; status!.dataset.type = type; }
  function updateState() {
    const settings = readSettings();
    badge!.textContent = settings ? PROVIDERS[settings.provider].label : 'Not configured';
    badge!.dataset.ready = String(Boolean(settings));
    createButton!.disabled = busy || !settings || !prompt!.value.trim();
    createButton!.textContent = busy ? 'Creating…' : 'Create proposal';
    templateButton!.disabled = busy || applying;
    retryFull!.disabled = busy || applying;
    if (!settings && !busy && !draft) setStatus('AI is not configured. Templates still work without a provider.', 'warning');
  }
  function discardDraft() { activeSelection = null; selectionStatus!.textContent = ''; retryFull!.classList.add('hidden'); draft = null; confirmedRotations = []; review!.replaceChildren(); review!.classList.add('hidden'); applyButton!.classList.add('hidden'); }
  function closeModal() {
    if (applying) return;
    epoch++; controller?.abort(); controller = undefined; busy = false;
    discardDraft();
    modal!.classList.add('hidden'); modal!.setAttribute('aria-hidden','true');
    inerted.splice(0).forEach(el => { el.inert = false; });
    previousFocus?.focus(); updateState();
  }
  function append(parent: HTMLElement, tag: string, content: string) {
    const el = document.createElement(tag); el.textContent = content; parent.appendChild(el); return el;
  }
  function renderReview() {
    if (!draft) return;
    const assessed = assessPlan(draft, { languageCodes, confirmedRotations });
    review!.replaceChildren(); review!.classList.remove('hidden');
    applyButton!.classList.add('hidden'); retryFull!.classList.add('hidden');
    const coverage = auditSelection(draft, activeSelection);
    if (!coverage.ok) {
      append(review!, 'h3', 'Proposal needs correction');
      for (const id of coverage.missing) append(review!, 'p', `Likely requested operation omitted: ${CAPABILITIES[id as keyof typeof CAPABILITIES].label}`);
      for (const id of coverage.outside) append(review!, 'p', `Operation needs full details: ${CAPABILITIES[id as keyof typeof CAPABILITIES].label}`);
      for (const id of coverage.unexpected) append(review!, 'p', `Unexpected operation proposed: ${CAPABILITIES[id as keyof typeof CAPABILITIES].label}`);
      append(review!, 'p', 'No workflow was loaded. Revise your description or explicitly retry with full capability details.');
      if (activeSelection?.mode === 'shortlist') retryFull!.classList.remove('hidden');
      setStatus('The proposal did not cover the selected capabilities. Nothing was loaded.', 'warning');
      return;
    }
    if (planOrigin === 'template') append(review!, 'p', 'Reviewed local template. No prompt or file was sent to an AI provider.');
    append(review!, 'h3', 'Review the proposal');
    append(review!, 'p', 'Check every requested operation and its order. A valid plan can still misunderstand your description.');
    for (const [i, step] of assessed.steps.entries()) {
      const cap = CAPABILITIES[step.operation as keyof typeof CAPABILITIES];
      append(review!, 'h4', `${i + 1}. ${cap.label}`);
      append(review!, 'pre', step.operation === 'encrypt' ? 'Password: entered locally below' : JSON.stringify(step.parameters, null, 2));
      if (step.operation === 'watermark' && !('position' in step.parameters)) append(review!, 'p', 'Default watermark position: center');
    }
    append(review!, 'p', `Download name: ${assessed.plan.filename} (PDF or ZIP as appropriate)`);
    for (const warning of assessed.warnings) append(review!, 'p', warning).className = 'trendy-ai-warning';
    if (assessed.status === 'unsupported') {
      append(review!, 'p', 'Cannot load this proposal. Revise your description; no requested part will be silently discarded.');
      for (const item of assessed.plan.unhandled) append(review!, 'p', item);
      if (activeSelection?.mode === 'shortlist') retryFull!.classList.remove('hidden');
      applyButton!.classList.add('hidden'); return;
    }
    for (const q of assessed.questions) {
      const label = document.createElement('label');
      label.textContent = q.label;
      const cap = CAPABILITIES[draft.steps[q.step].operation as keyof typeof CAPABILITIES];
      const fallback = (cap.defaults as Record<string, unknown>)[q.key];
      const field = q.choices ? document.createElement('select') : document.createElement('input');
      field.id = `trendy-choice-${q.step}-${q.key}`;
      if (q.choices) {
        const select = field as HTMLSelectElement;
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose…'; select.appendChild(empty);
        for (const value of q.choices) { const option = document.createElement('option'); option.value = String(value); option.textContent = `${value}° clockwise`; select.appendChild(option); }
      } else {
        const input = field as HTMLInputElement;
        input.type = typeof fallback === 'number' ? 'number' : 'text';
        input.placeholder = typeof fallback === 'boolean' ? 'true or false' : q.key === 'pages' ? 'e.g. 2-5,8' : q.key;
        input.maxLength = 1000;
      }
      field.dataset.step = String(q.step); field.dataset.key = q.key;
      field.dataset.kind = q.choices || typeof fallback === 'number' ? 'number' : typeof fallback === 'boolean' ? 'boolean' : 'string';
      label.htmlFor = field.id; label.appendChild(field); review!.appendChild(label);
    }
    if (!assessed.questions.length) {
      for (const [i, step] of draft.steps.entries()) if (step.operation === 'encrypt') {
        for (const key of ['userPassword', 'ownerPassword']) {
          const label = document.createElement('label'); label.textContent = key === 'userPassword' ? 'PDF password (local only, required)' : 'Owner password (local only, optional)';
          const input = document.createElement('input'); input.type = 'password'; input.id = `trendy-secret-${i}-${key}`;
          input.autocomplete = 'new-password'; input.maxLength = 128; label.htmlFor = input.id;
          label.appendChild(input); review!.appendChild(label);
        }
      }
    }
    const label = document.createElement('label');
    const acknowledge = document.createElement('input'); acknowledge.type = 'checkbox'; acknowledge.id = 'trendy-review-confirm';
    label.append(acknowledge, document.createTextNode(' I checked the operations, order, settings and warnings.'));
    review!.appendChild(label);
    applyButton!.textContent = assessed.questions.length ? 'Review answers' : 'Load reviewed workflow';
    applyButton!.classList.remove('hidden'); applyButton!.disabled = false;
    setStatus(assessed.questions.length ? 'Resolve the choices below. No additional AI call is needed.' : 'Proposal ready for your review. Nothing has run.');
  }
  async function createProposal() {
    if (busy || applying) return;
    const settings = readSettings(), request = prompt!.value.trim();
    if (!settings || !request) { updateState(); return; }
    try { guardPrompt(request); } catch (error) { setStatus((error as Error).message,'error'); return; }
    discardDraft(); planOrigin = 'ai';
    activeSelection = selectCapabilities(request, { forceFull: fullCatalog!.checked });
    selectionStatus!.textContent = activeSelection.mode === 'shortlist'
      ? `${activeSelection.operationIds.length} of ${Object.keys(CAPABILITIES).length} capability details selected locally; all operation names remain visible to AI.`
      : `Full capability details: ${activeSelection.reasons.join('; ')}.`;
    const systemPrompt = buildPlanV2Prompt(activeSelection.operationIds);
    const ticket = ++epoch;
    const currentController = new AbortController(); controller = currentController;
    busy = true; updateState(); setStatus('Creating a proposal…');
    const timer = setTimeout(() => currentController.abort(), 60000);
    try {
      const response = await fetch(PROVIDERS[settings.provider].endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model, temperature: 0.1, messages: [{role:'system',content:systemPrompt},{role:'user',content:request}] }),
        signal: currentController.signal,
      });
      if (!response.ok) throw new Error(`Provider request failed (${response.status}). Check your model, credentials or rate limit.`);
      const payload: unknown = await response.json();
      if (ticket !== epoch || currentController.signal.aborted) return;
      draft = readPlanV2(parseWorkflowPlanContent(extractContent(payload)));
      renderReview();
    } catch (error) {
      if (ticket === epoch) { discardDraft(); setStatus(currentController.signal.aborted ? 'Generation cancelled or timed out. Your canvas was not changed.' : (error as Error).message, 'error'); }
    } finally {
      clearTimeout(timer);
      if (ticket === epoch) { controller = undefined; busy = false; updateState(); }
    }
  }
  async function applyProposal() {
    if (!draft || busy || applying) return;
    if (!byId<HTMLInputElement>('trendy-review-confirm')?.checked) { setStatus('Confirm that you reviewed the proposal first.', 'warning'); return; }
    try {
      if (!auditSelection(draft, activeSelection).ok) throw new Error('Resolve the capability coverage warning first.');
      const choices = Array.from(review!.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-step]'));
      if (choices.length) {
        const updated = readPlanV2(draft); const nextConfirmed = [...confirmedRotations];
        for (const field of choices) {
          if (!field.value.trim()) throw new Error('Complete every missing choice.');
          const i = Number(field.dataset.step), key = field.dataset.key!;
          let value: string | number | boolean = field.value;
          if (field.dataset.kind === 'number') value = Number(field.value);
          if (field.dataset.kind === 'boolean') { if (!['true','false'].includes(field.value)) throw new Error('Enter true or false.'); value = field.value === 'true'; }
          updated.steps[i].parameters[key] = value;
          if (updated.steps[i].operation === 'rotate' && key === 'angle') nextConfirmed.push(i);
        }
        assessPlan(updated, { languageCodes, confirmedRotations: nextConfirmed });
        draft = updated; confirmedRotations = nextConfirmed; renderReview(); return;
      }
      const localSecrets: Record<number, Record<string, string>> = {};
      for (const [i, step] of draft.steps.entries()) if (step.operation === 'encrypt') {
        localSecrets[i] = { userPassword: byId<HTMLInputElement>(`trendy-secret-${i}-userPassword`)!.value, ownerPassword: byId<HTMLInputElement>(`trendy-secret-${i}-ownerPassword`)!.value };
      }
      const serialized = compilePlanV2(draft, { languageCodes, confirmedRotations, localSecrets }) as SerializedWorkflow;
      assertReplaceable(workflowEditor.editor);
      if (byId<HTMLButtonElement>('run-btn')?.disabled) throw new Error('Wait for the current workflow to finish.');
      if (workflowEditor.editor.getNodes().length && !confirm('Replace the existing workflow with this reviewed proposal?')) return;
      applying = true; applyButton!.disabled = true; createButton!.disabled = true;
      await loadSerializedWorkflow(serialized, workflowEditor.editor, workflowEditor.area);
      workflowEditor.engine.reset();
      byId('settings-sidebar')?.classList.add('hidden');
      const statusText = byId('status-text'); if (statusText) statusText.textContent = `${planOrigin === 'template' ? 'Template' : 'AI'} workflow created. Review it, upload PDFs, then press Run.`;
      applying = false; closeModal();
    } catch (error) { setStatus((error as Error).message,'error'); }
    finally { applying = false; applyButton!.disabled = false; updateState(); }
  }
  openButton.addEventListener('click', () => {
    previousFocus = document.activeElement as HTMLElement;
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    // Keep background controls and their keyboard shortcuts out of the focus order.
    let ancestor: HTMLElement = modal;
    while (ancestor.parentElement) {
      for (const sibling of Array.from(ancestor.parentElement.children)) if (sibling instanceof HTMLElement && sibling !== ancestor && !sibling.inert) { sibling.inert = true; inerted.push(sibling); }
      ancestor = ancestor.parentElement; if (ancestor === document.body) break;
    }
    updateState(); prompt.focus();
  });
  closeButtons.forEach(button => button.addEventListener('click',closeModal));
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  modal.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void createProposal(); }
    if (event.key === 'Tab') {
      const fields = Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, select, a[href]')).filter(el => el.getClientRects().length);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  prompt.addEventListener('input', () => { epoch++; controller?.abort(); busy = false; discardDraft(); updateState(); });
  templateButton.addEventListener('click', () => {
    if (busy || applying) return;
    epoch++; controller?.abort(); discardDraft(); planOrigin = 'template';
    try { draft = readPlanV2(getTemplatePlan(templateSelect.value)); selectionStatus.textContent = 'Template mode — zero AI requests.'; renderReview(); }
    catch (error) { discardDraft(); setStatus((error as Error).message, 'error'); }
  });
  fullCatalog.addEventListener('change', () => { epoch++; controller?.abort(); busy = false; discardDraft(); updateState(); });
  retryFull.addEventListener('click', () => { fullCatalog.checked = true; void createProposal(); });
  createButton.addEventListener('click', () => void createProposal());
  applyButton.addEventListener('click', () => void applyProposal());
  window.addEventListener('storage', event => { if(event.key === STORAGE_KEY) { epoch++; controller?.abort(); busy=false; discardDraft(); updateState(); } });
  window.addEventListener('focus',updateState); updateState();
}
