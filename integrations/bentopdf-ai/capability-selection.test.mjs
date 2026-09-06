import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { CAPABILITIES } from './capability-registry.js';
import { selectCapabilities, auditSelection } from './capability-selection.js';
import { buildPlanV2Prompt, readPlanV2, assessPlan, compilePlanV2 } from './planner-v2.js';
import { WORKFLOW_TEMPLATES, getTemplatePlan } from './workflow-templates.js';
const fixtures = JSON.parse(readFileSync(new URL('./selection-fixtures.json', import.meta.url),'utf8'));
for (const [i,f] of fixtures.entries()) test(`selection fixture ${i+1}: ${f.mode}`,()=>{
  const selected=selectCapabilities(f.request);
  assert.equal(selected.mode,f.mode);
  for(const op of f.expected) assert.ok(selected.operationIds.includes(op),`Missing ${op}`);
  if(f.mode==='shortlist') assert.deepEqual(new Set(selected.operationIds),new Set(f.expected));
});
test('positive requests expose omissions and out-of-selection additions',()=>{
  const selection=selectCapabilities('Merge and compress PDFs.');
  assert.deepEqual(auditSelection({steps:[{operation:'merge'}]},selection).missing,['compress']);
  assert.deepEqual(auditSelection({steps:[{operation:'merge'},{operation:'compress'},{operation:'rotate'}]},selection).outside,['rotate']);
});
test('negation fallback does not require a negated operation',()=>{
  const selection=selectCapabilities("Don't rotate. Compress instead.");
  assert.deepEqual(selection.expectedOperations,[]);
  assert.equal(auditSelection({steps:[{operation:'compress'}]},selection).ok,true);
});
test('explicit full-details retry expands once, retaining positive omission checks',()=>{
  const selection=selectCapabilities('Merge and compress.',{forceFull:true});
  assert.equal(selection.mode,'full');assert.equal(selection.operationIds.length,16);
  assert.deepEqual(selection.expectedOperations,['merge','compress']);
});
test('compact prompt includes every operation name, not every parameter schema',()=>{
  const prompt=buildPlanV2Prompt(['merge']);
  for(const id of Object.keys(CAPABILITIES)) assert.ok(prompt.includes(id));
  assert.ok(!prompt.includes('tileGapX'));assert.ok(prompt.includes('retainPageLabels'));
  assert.ok(prompt.includes('"operation":"merge"'));
  assert.ok(prompt.length<buildPlanV2Prompt().length);
  assert.ok(!prompt.includes('userPassword'));
});
test('invalid selections are rejected, and unknown operations still fail validation',()=>{
  for(const selection of [[],['repair'],['merge','merge'],['__proto__']]) assert.throws(()=>buildPlanV2Prompt(selection));
  assert.throws(()=>readPlanV2({version:2,steps:[{operation:'repair',parameters:{}}],unhandled:[]}));
});
test('four fresh secret-free local templates use the same v2 validation',()=>{
  assert.equal(WORKFLOW_TEMPLATES.length,4);
  for(const template of WORKFLOW_TEMPLATES){const p=getTemplatePlan(template.id);assert.doesNotThrow(()=>assessPlan(p));assert.ok(!JSON.stringify(p).includes('Password'));}
  const first=getTemplatePlan('rotate-compress');first.steps[0].parameters.angle=90;
  assert.equal(getTemplatePlan('rotate-compress').steps[0].parameters.angle,null);
  assert.throws(()=>getTemplatePlan('__proto__'));
});
test('templates keep local clarification and password gates',()=>{
  assert.equal(assessPlan(getTemplatePlan('rotate-compress')).status,'needs_clarification');
  assert.equal(assessPlan(getTemplatePlan('watermark-compress')).status,'needs_clarification');
  assert.throws(()=>compilePlanV2(getTemplatePlan('merge-protect')),/required/);
  assert.equal(compilePlanV2(getTemplatePlan('merge-number-compress')).nodes.length,5);
});

test('full-details retry does not permit extra operations on clear positive requests',()=>{
  const s=selectCapabilities('Merge PDFs.',{forceFull:true});
  assert.deepEqual(auditSelection({steps:[{operation:'merge'},{operation:'compress'}]},s).unexpected,['compress']);
});
