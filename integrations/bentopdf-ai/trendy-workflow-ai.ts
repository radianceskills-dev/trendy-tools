import type { WorkflowEditor } from "./editor";
import type { SerializedWorkflow } from "./types";
import { loadSerializedWorkflow } from "./serialization";
import { getAvailableTesseractLanguageEntries } from "../utils/tesseract-language-availability.js";
import {
  buildWorkflowSystemPrompt,
  parseWorkflowPlanContent,
  workflowPlanToSerialized,
} from "./trendy-ai-plan.js";

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

export function initializeTrendyWorkflowAI(
  workflowEditor: WorkflowEditor,
): void {
  const openButton = document.getElementById(
    "trendy-ai-workflow-button",
  ) as HTMLButtonElement | null;
  const modal = document.getElementById("trendy-ai-workflow-modal");
  const prompt = document.getElementById(
    "trendy-ai-workflow-prompt",
  ) as HTMLTextAreaElement | null;
  const createButton = document.getElementById(
    "trendy-ai-workflow-create",
  ) as HTMLButtonElement | null;
  const closeButtons = Array.from(
    document.querySelectorAll<HTMLElement>("[data-trendy-ai-close]"),
  );
  const providerBadge = document.getElementById("trendy-ai-workflow-provider");
  const status = document.getElementById("trendy-ai-workflow-status");

  if (
    !openButton ||
    !modal ||
    !prompt ||
    !createButton ||
    !providerBadge ||
    !status
  )
    return;
  if (openButton.dataset.initialized === "true") return;
  openButton.dataset.initialized = "true";

  const languageCodes = new Set(
    getAvailableTesseractLanguageEntries().map(([code]) => code),
  );

  function setStatus(message: string, type = "") {
    status!.textContent = message;
    status!.dataset.type = type;
  }

  function settingsState(): AISettings | null {
    const settings = readSettings();
    providerBadge!.textContent = settings
      ? PROVIDERS[settings.provider].label
      : "Not configured";
    providerBadge!.dataset.ready = String(Boolean(settings));
    return settings;
  }

  function updateState() {
    const settings = settingsState();
    createButton!.disabled = !settings || !prompt!.value.trim();
    if (!settings)
      setStatus(
        "Configure an AI provider on the Trendy Tools dashboard first.",
        "warning",
      );
    else if (status!.dataset.type === "warning")
      setStatus("Describe the PDF workflow you want to create.");
  }

  function setBusy(busy: boolean) {
    prompt!.disabled = busy;
    createButton!.disabled = busy;
    createButton!.dataset.busy = String(busy);
    createButton!.textContent = busy ? "Creating…" : "Create workflow";
  }

  function openModal() {
    modal!.classList.remove("hidden");
    modal!.setAttribute("aria-hidden", "false");
    updateState();
    setTimeout(() => prompt!.focus(), 0);
  }

  function closeModal() {
    controller?.abort();
    modal!.classList.add("hidden");
    modal!.setAttribute("aria-hidden", "true");
  }

  async function createWorkflow() {
    const settings = readSettings();
    const request = prompt!.value.trim();
    if (!settings || !request) {
      updateState();
      return;
    }

    controller = new AbortController();
    setBusy(true);
    setStatus(
      `Creating a constrained plan with ${PROVIDERS[settings.provider].label}…`,
    );

    try {
      const response = await fetch(PROVIDERS[settings.provider].endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: buildWorkflowSystemPrompt() },
            { role: "user", content: request },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      let payload: unknown = {};
      try {
        payload = await response.json();
      } catch {
        // A useful HTTP status error is shown below if the body is not JSON.
      }
      if (!response.ok)
        throw new Error(providerError(payload, response.status));

      const rawPlan = parseWorkflowPlanContent(extractContent(payload));
      const serialized = workflowPlanToSerialized(rawPlan, {
        request,
        languageCodes,
      }) as SerializedWorkflow;

      if (
        workflowEditor.editor.getNodes().length > 0 &&
        !confirm("Replace the current workflow with this AI-created workflow?")
      ) {
        setStatus("Creation cancelled; the current workflow was not changed.");
        return;
      }

      await loadSerializedWorkflow(
        serialized,
        workflowEditor.editor,
        workflowEditor.area,
      );
      const statusText = document.getElementById("status-text");
      if (statusText) {
        statusText.textContent =
          "AI workflow created. Review it, upload PDFs, then press Run.";
      }
      setStatus("Workflow created for review. It has not been run.", "success");
      setTimeout(closeModal, 700);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Generation cancelled.");
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Could not create the workflow.";
        setStatus(message, "error");
      }
    } finally {
      controller = undefined;
      setBusy(false);
      updateState();
    }
  }

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((button) =>
    button.addEventListener("click", closeModal),
  );
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  prompt.addEventListener("input", updateState);
  prompt.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void createWorkflow();
    }
  });
  createButton.addEventListener("click", () => void createWorkflow());
  window.addEventListener("focus", updateState);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) updateState();
  });
  updateState();
}
