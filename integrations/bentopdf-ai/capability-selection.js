import { CAPABILITIES, text } from './capability-registry.js';
const enabled = () => Object.keys(CAPABILITIES).filter(id => CAPABILITIES[id].enabled);
const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
const escaped = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hasPhrase = (s, phrase) => new RegExp(`(?:^|[^a-z])${escaped(phrase)}(?:$|[^a-z])`, 'i').test(s);
const phrases = id => [id.replace(/_/g,' '), ...CAPABILITIES[id].aliases];
const flexiblePatterns = {
  reverse_pages: /\breverse\b(?:\s+[a-z0-9]+){0,3}\s+pages?(?:\s+order)?\b/i,
  remove_annotations: /\b(?:remove|strip|delete|clear)\b(?:\s+[a-z0-9]+){0,3}\s+annotations?\b/i,
  add_blank_page: /\b(?:add|insert)\b(?:\s+[a-z0-9]+){0,4}\s+blank\s+pages?\b/i,
};
const matches = (s, id) => phrases(id).some(alias => hasPhrase(s,alias)) || flexiblePatterns[id]?.test(s) === true;

/** English lexical hints are an optimization, never evidence of semantic completeness. */
export function selectCapabilities(request, options = {}) {
  text(request, 'request', {min:1,max:4000});
  const all = enabled();
  // Quoted strings are data (watermark text, titles, filenames), not operation hints.
  const normalized = normalize(request).replace(/"[^"]*"|“[^”]*”/g, 'quoted value');
  const detected = all.filter(id => matches(normalized,id));
  const reasons = [];
  if (!detected.length) reasons.push('No strong operation match');
  if (/[^\u0000-\u007f]/.test(normalized)) reasons.push('Non-English or mixed-language text');
  if (/\b(?:not|no|never|without|avoid|except|only|don\x27t|do not)\b/.test(normalized)) reasons.push('Negation or restrictive wording needs wider context');
  if (/\b(?:redact|redaction|translate|sign|signature|convert|booklet|decrypt|safe to share)\b/.test(normalized)) reasons.push('Potentially unsupported or ambiguous operation');
  if (detected.includes('watermark') && detected.includes('rotate')) reasons.push('Watermark angle may be mistaken for page rotation');
  if (detected.includes('sanitize') && detected.includes('edit_metadata')) reasons.push('Metadata removal is not metadata editing');
  if (detected.length > 6 || normalized.split(' ').length > 50) reasons.push('Complex request');
  const clauses = normalized.split(/[,;.!?]|\b(?:and|then|also|next)\b/).map(s=>s.trim()).filter(Boolean);
  const parameterOrOutput = /^(?:at|in|on|with|using|as|named|called|filename|download|save|output|bottom|top|center|font|color|opacity|resolution|quality|dpi|all pages|quoted value|\d)\b/;
  if (clauses.some(clause => /[a-z]/.test(clause) && !detected.some(id=>matches(clause,id)) && !parameterOrOutput.test(clause))) reasons.push('Some clauses have no known operation match');
  const uncertain = reasons.length > 0;
  const full = options.forceFull === true || uncertain;
  return {
    mode: full ? 'full' : 'shortlist',
    operationIds: full ? all : detected,
    // Only high-confidence positive wording participates in the omission guard.
    expectedOperations: uncertain ? [] : detected,
    detectedOperations: detected,
    reasons: options.forceFull === true ? [...reasons, 'Full details requested by user'] : reasons,
  };
}

export function auditSelection(plan, selection) {
  if (!selection) return {ok:true,missing:[],outside:[],unexpected:[]};
  const proposed = new Set(plan.steps.map(step => step.operation));
  const missing = selection.expectedOperations.filter(id=>!proposed.has(id));
  const outside = [...proposed].filter(id=>!selection.operationIds.includes(id));
  const unexpected = selection.expectedOperations.length ? [...proposed].filter(id=>!selection.expectedOperations.includes(id) && !outside.includes(id)) : [];
  return {ok:!missing.length && !outside.length && !unexpected.length,missing,outside,unexpected};
}
