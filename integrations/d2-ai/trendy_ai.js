const STORAGE_KEY = "trendytools.ai.v1";
const PROVIDERS = {
  openrouter: { label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  bai: { label: "B.AI", endpoint: "https://api.b.ai/v1/chat/completions" },
  opencode: { label: "OpenCode Zen", endpoint: "https://opencode.ai/zen/v1/chat/completions" },
};

const SYSTEM_PROMPT = `You create complete new diagrams using valid D2 source code. Return only D2 source: no Markdown fences, JSON, explanations, or introductory text.

CORE D2 SYNTAX
- Object: id: Human-readable label
- Container: id: Human-readable label { ... }
- Reference nested objects with dot paths: frontend.browser -> backend.api
- Connection: A -> B: label
- Other valid connections: A -- B, A <- B, A <-> B
- Direction: direction: right | left | up | down
- Quote labels or keys containing punctuation or reserved words.
- Put each declaration on its own line. Semicolons may separate declarations on one line.

VALID CONTAINER EXAMPLE
frontend: Frontend {
  browser: Browser
  mobile: Mobile app
}
backend: Backend {
  api: API service
  database: Database
}
frontend.browser -> backend.api: HTTPS request
backend.api -> backend.database: Query

VALID REUSABLE CLASS EXAMPLE
classes: {
  service: {
    shape: rectangle
    style: {
      fill: "#E8F0FE"
      stroke: "#2563EB"
      stroke-width: 2
    }
  }
}
api: API service {
  class: service
}
database: Database {
  class: service
}
api -> database: Query

VALID SEQUENCE DIAGRAM EXAMPLE
login: Login sequence {
  shape: sequence_diagram
  browser: Browser
  auth: Authentication service
  database: Database
  browser -> auth: Submit credentials
  auth -> database: Find user
  database -> auth: User record
  auth -> browser: Return session
}

VALID SQL TABLE EXAMPLE
users: Users {
  shape: sql_table
  id: int { constraint: primary_key }
  email: varchar { constraint: unique }
}

VALID UML CLASS EXAMPLE
user: User {
  shape: class
  +name: string
  +login(): bool
}

GENERATION RULES
1. Translate the request into D2 syntax only; never use Mermaid, PlantUML, Graphviz, or pseudocode syntax.
2. Do not use unsupported wrapper/directive keywords such as group, graph, flowchart, subgraph, end, classDef, @startuml, participant, package, or skinparam.
3. Use containers instead of group/subgraph/package concepts.
4. Define reusable styling only inside a top-level classes: { ... } block and apply it with class: class_name.
5. Keep braces balanced. Every opened { must have one matching }.
6. Use dot-qualified references when connecting objects inside different containers.
7. Use sequence_diagram only for chronological interactions, sql_table only for database tables, and class only for UML classes.
8. Prefer simple identifiers using lowercase letters, numbers, and underscores. Put readable wording in labels.
9. Do not include external URLs, remote icons, images, links, imports, or executable content.
10. Prefer a clear, compact diagram under 300 lines.`;

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
