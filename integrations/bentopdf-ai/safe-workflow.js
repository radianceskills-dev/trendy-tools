export const isSensitiveControl = (key) => /password|passphrase|api.?key|secret|token/i.test(key);

export function preflightWorkflow(data, createNode, createConnection) {
  if (data?.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.connections)) throw new Error('Invalid compiled workflow.');
  if (data.nodes.length < 2 || data.nodes.length > 14 || data.connections.length !== data.nodes.length - 1) throw new Error('Expected a linear workflow with at most 12 processing steps.');
  const byId = new Map();
  const nodes = data.nodes.map(saved => {
    if (typeof saved.id !== 'string' || byId.has(saved.id)) throw new Error('Duplicate or invalid node ID.');
    const node = createNode(saved.type);
    if (!node) throw new Error(`Unavailable node type: ${saved.type}`);
    if (!Number.isFinite(saved.position?.x) || !Number.isFinite(saved.position?.y)) throw new Error('Invalid position.');
    for (const [key, value] of Object.entries(saved.controls || {})) {
      const control = node.controls[key];
      if (!control || !('value' in control) || typeof control.value !== typeof value || node.sanitizeControlValue(key, value) !== value) throw new Error(`Unsupported control: ${saved.type}.${key}`);
      control.value = value;
    }
    byId.set(saved.id, node);
    return { node, position: saved.position };
  });
  const ids = new Set();
  const connections = data.connections.map((saved, i) => {
    if (typeof saved.id !== 'string' || ids.has(saved.id) || saved.source !== data.nodes[i].id || saved.target !== data.nodes[i + 1].id) throw new Error('Invalid linear connection.');
    ids.add(saved.id);
    const source = byId.get(saved.source), target = byId.get(saved.target);
    if (!source?.outputs[saved.sourceOutput] || !target?.inputs[saved.targetInput]) throw new Error('Missing socket.');
    if (source.outputs[saved.sourceOutput].socket !== target.inputs[saved.targetInput].socket) throw new Error('Incompatible sockets.');
    return createConnection(source, saved.sourceOutput, target, saved.targetInput);
  });
  return { nodes, connections };
}

export function assertReplaceable(editor) {
  for (const node of editor.getNodes()) {
    if (node.execStatus === 'running') throw new Error('Wait for the running workflow.');
    if (node.hasFile?.() || node.hasCertFile?.() || node.hasCert?.() || node.getFileCount?.() > 0) throw new Error('This workflow has attached files. Keep it, or explicitly clear it before loading an AI workflow.');
    if (node.category === 'Input' && typeof node.hasFile !== 'function' && typeof node.getFileCount !== 'function') throw new Error('Explicitly clear the existing input workflow before replacing it.');
  }
}

export async function replaceWorkflowSafely(data, editor, area, createNode, createConnection) {
  assertReplaceable(editor);
  const staged = preflightWorkflow(data, createNode, createConnection);
  const oldNodes = editor.getNodes().map(node => ({ node, position: { ...(area.nodeViews.get(node.id)?.position || { x: 0, y: 0 }) } }));
  const oldConnections = [...editor.getConnections()];
  const must = async (result) => { if (await result === false) throw new Error('Editor rejected the change.'); };
  try {
    // Stage additions first, retaining all original object references until success.
    for (const { node, position } of staged.nodes) { await must(editor.addNode(node)); await area.translate(node.id, position); }
    for (const conn of staged.connections) await must(editor.addConnection(conn));
    for (const conn of oldConnections) await must(editor.removeConnection(conn.id));
    for (const { node } of oldNodes) await must(editor.removeNode(node.id));
  } catch {
    try {
      for (const conn of staged.connections) if (editor.getConnections().some(c => c.id === conn.id)) await must(editor.removeConnection(conn.id));
      for (const { node } of staged.nodes) if (editor.getNodes().some(n => n.id === node.id)) await must(editor.removeNode(node.id));
      for (const { node, position } of oldNodes) {
        if (!editor.getNodes().some(n => n.id === node.id)) await must(editor.addNode(node));
        await area.translate(node.id, position);
      }
      for (const conn of oldConnections) if (!editor.getConnections().some(c => c.id === conn.id)) await must(editor.addConnection(conn));
    } catch { throw new Error('Replacement and recovery failed. Do not run this canvas; reload or recover a saved workflow.'); }
    throw new Error('Replacement failed; your previous workflow was restored.');
  }
}
