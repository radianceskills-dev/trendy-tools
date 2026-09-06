import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preflightWorkflow, replaceWorkflowSafely, assertReplaceable, isSensitiveControl } from './safe-workflow.js';
const socket = {}, makeData = () => ({version:1,nodes:[{id:'a',type:'input',position:{x:0,y:0},controls:{}},{id:'b',type:'output',position:{x:0,y:1},controls:{filename:'output'}}],connections:[{id:'c',source:'a',sourceOutput:'pdf',target:'b',targetInput:'pdf'}]});
let uid = 0;
const factory = type => type === 'missing' ? null : ({ id:`n${++uid}`,nodeType:type,inputs:type==='input'?{}:{pdf:{socket}},outputs:type==='output'?{}:{pdf:{socket}},controls:type==='output'?{filename:{value:''}}:{},sanitizeControlValue:(_k,v)=>v });
const connection = (a,output,b,input) => ({id:`c${++uid}`,source:a.id,sourceOutput:output,target:b.id,targetInput:input});
function harness(failAt) {
  const old=factory('old'), nodes=[old],connections=[],views=new Map([[old.id,{position:{x:13,y:17}}]]);
  let failed=false;
  const failure = stage => {if(stage===failAt && !failed){failed=true;throw new Error('injected');}};
  const editor={ getNodes:()=>[...nodes],getConnections:()=>[...connections],
    async addNode(n){failure('add');nodes.push(n);return true;},
    async removeNode(id){failure('remove');nodes.splice(nodes.findIndex(n=>n.id===id),1);return true;},
    async addConnection(c){failure('connect');connections.push(c);return true;},
    async removeConnection(id){connections.splice(connections.findIndex(c=>c.id===id),1);return true;},
  };
  const area={nodeViews:views,async translate(id,p){failure('translate');views.set(id,{position:p});}};
  return {editor,area,old};
}
test('preflight validates types, controls and sockets before any canvas mutation',()=>{for (const mutate of [d=>d.nodes[1].type='missing',d=>d.nodes[1].controls.wrong=true,d=>d.nodes[1].controls.filename=5,d=>d.connections[0].sourceOutput='wrong',d=>d.nodes[1].id='a',d=>d.connections[0].target='a',d=>d.nodes[1].position.x=Infinity]){const d=makeData();mutate(d);assert.throws(()=>preflightWorkflow(d,factory,connection));}});
test('success removes old graph and installs staged graph',async()=>{const h=harness();await replaceWorkflowSafely(makeData(),h.editor,h.area,factory,connection);assert.equal(h.editor.getNodes().length,2);assert.equal(h.editor.getConnections().length,1);assert.ok(!h.editor.getNodes().includes(h.old));});
for(const stage of ['add','translate','connect','remove']) test(`rollback preserves exact old objects on ${stage} failure`,async()=>{const h=harness(stage);await assert.rejects(()=>replaceWorkflowSafely(makeData(),h.editor,h.area,factory,connection),/restored/);assert.deepEqual(h.editor.getNodes(),[h.old]);assert.deepEqual(h.area.nodeViews.get(h.old.id).position,{x:13,y:17});assert.equal(h.editor.getConnections().length,0);});
test('attached files, certificates, unknown input state and active execution block replacement',()=>{for(const props of [{hasFile:()=>true},{hasCertFile:()=>true},{getFileCount:()=>2},{category:'Input'},{execStatus:'running'}]){const h=harness();Object.assign(h.old,props);assert.throws(()=>assertReplaceable(h.editor));}});
test('empty PDF input is replaceable',()=>{const h=harness();Object.assign(h.old,{category:'Input',hasFile:()=>false});assert.doesNotThrow(()=>assertReplaceable(h.editor));});
test('sensitive controls filter covers user/owner/certificate passwords',()=>{for(const key of ['userPassword','ownerPassword','password','certificatePassword','apiKey','secret'])assert.ok(isSensitiveControl(key));assert.ok(!isSensitiveControl('filename'));});
test('recovery failure is explicit, not reported as a successful rollback',async()=>{const h=harness();h.editor.addConnection=async()=>{throw Error('fail');};h.editor.removeNode=async()=>{throw Error('fail');};await assert.rejects(()=>replaceWorkflowSafely(makeData(),h.editor,h.area,factory,connection),/recovery failed/);});
