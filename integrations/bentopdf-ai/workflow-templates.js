const templates = [
  {id:'merge-number-compress',label:'Merge → page numbers → compress',steps:[['merge',{}],['page_numbers',{}],['compress',{}]]},
  {id:'rotate-compress',label:'Rotate → compress',steps:[['rotate',{angle:null}],['compress',{}]]},
  {id:'watermark-compress',label:'Watermark → compress',steps:[['watermark',{text:null}],['compress',{}]]},
  {id:'merge-protect',label:'Merge → local password protection',steps:[['merge',{}],['encrypt',{}]]},
];
export const WORKFLOW_TEMPLATES = Object.freeze(templates.map(({id,label})=>Object.freeze({id,label})));
export function getTemplatePlan(id) {
  const template = templates.find(t=>t.id===id);
  if (!template) throw new Error('Unknown workflow template.');
  // Return fresh state; user answers and passwords never mutate the catalog.
  return {version:2,steps:template.steps.map(([operation,parameters])=>({operation,parameters:{...parameters}})),unhandled:[]};
}
