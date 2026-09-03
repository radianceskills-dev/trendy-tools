const STORAGE_KEY = "trendytools.ai.v1";
const PROVIDERS = {
  openrouter: { label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  bai: { label: "B.AI", endpoint: "https://api.b.ai/v1/chat/completions" },
  opencode: { label: "OpenCode Zen", endpoint: "https://opencode.ai/zen/v1/chat/completions" },
};

const SYSTEM_PROMPT = `You create new diagrams using valid D2 source code.

D2 capabilities you may use:
- Shapes and human-readable labels
- Directed and undirected connections
- Nested containers for systems, teams, stages, or boundaries
- Layout direction
- Shape types and style properties
- Reusable classes
- Sequence diagrams for chronological interactions
- SQL tables for data models
- Class shapes for software models

Rules:
1. Return D2 source only. Do not use Markdown fences, JSON, prose, or explanations.
2. Create a complete new diagram from the user's request.
3. Use simple stable identifiers and clear labels.
4. Prefer a clean, readable structure over decorative complexity.
5. Use containers where they clarify ownership or stages.
6. Do not include external URLs, remote icons, images, links, imports, or executable content.
7. Keep the diagram under 300 lines unless the request clearly requires more.`;

let controller;

function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value || !PROVIDERS[value.provider]) return null;
    if (typeof value.apiKey !== "string" || !value.apiKey.trim()) return null;
    if (typeof value.model !== "string" || !value.model.trim()) return null;
    return value;
  } catch {
    return null;
  }
}

function extractContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  return "";
}

function cleanD2Source(content) {
  const fenced = content.match(/```(?:d2)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : content).trim();
  if (!source) throw new Error("The AI returned an empty diagram.");
  if (source.length > 50000) throw new Error("The generated diagram is too large.");
  return source;
}

function applySource(Editor, source) {
  const editor = Editor.getEditor();
  if (!editor) {
    Editor.setScript(source);
    return;
  }
  const model = editor.getModel();
  editor.pushUndoStop();
  editor.executeEdits("trendy-ai-create", [{ range: model.getFullModelRange(), text: source, forceMoveMarkers: true }]);
  editor.pushUndoStop();
  editor.focus();
}

function init(Editor) {
  const panel = document.getElementById("ai-create-panel");
  if (!panel) return;
  const prompt = document.getElementById("ai-create-prompt");
  const generate = document.getElementById("ai-create-generate");
  const badge = document.getElementById("ai-create-provider");
  const status = document.getElementById("ai-create-status");

  function setStatus(message, type = "") {
    status.textContent = message;
    status.dataset.type = type;
  }

  function updateState() {
    const settings = readSettings();
    const ready = Boolean(settings);
    badge.textContent = ready ? PROVIDERS[settings.provider].label : "Not configured";
    badge.dataset.ready = String(ready);
    generate.disabled = !ready || !prompt.value.trim();
    if (!ready) setStatus("Configure AI on the dashboard first.", "warning");
    else if (status.dataset.type === "warning") setStatus("Describe a new diagram.");
  }

  function setBusy(busy) {
    prompt.disabled = busy;
    generate.disabled = busy;
    generate.dataset.busy = String(busy);
    generate.textContent = busy ? "Creating…" : "Create diagram";
  }

  async function createDiagram() {
    const settings = readSettings();
    const request = prompt.value.trim();
    if (!settings || !request) { updateState(); return; }

    const current = Editor.getScript().trim();
    if (current && current !== "x -> y" && !confirm("Replace the current diagram with a new AI-generated diagram?")) return;

    const provider = PROVIDERS[settings.provider];
    controller = new AbortController();
    setBusy(true);
    setStatus(`Creating with ${provider.label}…`);

    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${settings.apiKey.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model.trim(),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: request },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      let payload = {};
      try { payload = await response.json(); } catch {}
      if (!response.ok) throw new Error(payload?.error?.message || `Provider request failed (${response.status}).`);

      const source = cleanD2Source(extractContent(payload));
      applySource(Editor, source);
      await Editor.compile();
      const hasErrors = document.getElementById("editor-errors").style.display !== "none";
      setStatus(hasErrors ? "Created, but D2 found syntax errors." : `Created with ${provider.label}.`, hasErrors ? "error" : "success");
    } catch (error) {
      if (error.name === "AbortError") setStatus("Generation cancelled.");
      else setStatus(error.message || "Could not create the diagram.", "error");
    } finally {
      controller = undefined;
      setBusy(false);
      updateState();
    }
  }

  prompt.addEventListener("input", updateState);
  prompt.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      createDiagram();
    }
  });
  generate.addEventListener("click", createDiagram);
  window.addEventListener("focus", updateState);
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) updateState(); });
  updateState();
}

export default { init };
