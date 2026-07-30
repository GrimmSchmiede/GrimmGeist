import { AttachedFile, ChatMessage, ChatImage } from "./types";

interface GeminiContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export interface GeminiResult {
  text: string;
  promptTokens: number;
  candidatesTokens: number;
}

const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 40;

export class GeminiApiError extends Error {
  status?: number;
  /** Seconds to wait before retrying, present on HTTP 429 (rate limit / quota exceeded) responses. */
  retryAfterSeconds?: number;

  constructor(message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryDelaySeconds(errJson: unknown): number {
  const details = (errJson as { error?: { details?: Array<Record<string, unknown>> } })?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = detail?.retryDelay;
      if (typeof retryDelay === "string") {
        const seconds = parseFloat(retryDelay.replace(/s$/, ""));
        if (!Number.isNaN(seconds) && seconds > 0) return Math.ceil(seconds);
      }
    }
  }
  return DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS;
}

function messageToPromptText(text: string, files?: AttachedFile[]): string {
  if (!files || files.length === 0) return text;
  const fileBlocks = files
    .map((f) => `Datei: ${f.name}\n---\n${f.content}\n---`)
    .join("\n\n");
  return `${text}\n\n${fileBlocks}`;
}

/** Splits a "data:<mime>;base64,<data>" URL into its parts for the Gemini inlineData part shape. */
function dataUrlToInlineData(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function imagesToParts(images?: ChatImage[]): GeminiContentPart[] {
  if (!images || images.length === 0) return [];
  return images
    .map((img) => dataUrlToInlineData(img.dataUrl))
    .filter((part): part is { mimeType: string; data: string } => !!part)
    .map((inlineData) => ({ inlineData }));
}

export function historyToContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .filter((m) => !m.pending && !m.error)
    .map((m) => ({
      role: m.role,
      parts: [{ text: messageToPromptText(m.text, m.files) }, ...imagesToParts(m.images)],
    }));
}

const SAFETY_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
];

/** Schema for the Gemini API's Structured Output mode (generationConfig.responseSchema).
 * Forces syntactically valid JSON at the API level instead of hoping the model formats free-text
 * JSON correctly - the latter reliably breaks once responses contain multi-file source code with
 * quotes/newlines that need escaping. */
export const WORKSPACE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: {
      type: "STRING",
      description: "Normale Chat-Antwort an den Nutzer (Erklärung, Rückfrage, o.ä.). Leer lassen, wenn nur Datei-Aktionen zurückgegeben werden.",
    },
    actions: {
      type: "ARRAY",
      description: "Datei-Aktionen im verknüpften Workspace-Ordner. Leer lassen, wenn keine Datei geändert werden soll.",
      items: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING", enum: ["create", "edit", "delete"] },
          filename: { type: "STRING", description: "Pfad relativ zum Workspace-Ordner." },
          content: {
            type: "STRING",
            description:
              "Vollständiger neuer Dateiinhalt - NUR bei action=create verwenden (neue Datei, es " +
              "gibt noch nichts, das ersetzt werden könnte). Für action=edit STATTDESSEN das " +
              "'edits'-Feld nutzen, niemals 'content'. MUSS normal formatierter, mehrzeiliger " +
              "Quellcode mit echten Zeilenumbrüchen (\\n) und sauberer Einrückung sein, genau wie " +
              "in einer echten Datei/IDE. NIEMALS den gesamten Dateiinhalt in eine einzige Zeile " +
              "komprimieren oder minifizieren, nur weil er in einem JSON-String steht.",
          },
          edits: {
            type: "ARRAY",
            description:
              "NUR bei action=edit: Liste präziser Suchen/Ersetzen-Paare statt des ganzen " +
              "Dateiinhalts. 'search' muss EXAKT (Zeichen für Zeichen, inkl. Einrückung) im " +
              "aktuellen Dateiinhalt vorkommen - kopiere ihn wortwörtlich aus dem dir bekannten " +
              "Dateiinhalt. Halte 'search' so kurz wie möglich, aber lang genug, um eindeutig zu " +
              "sein (z. B. die betroffene Funktion oder den betroffenen Block, nicht die ganze " +
              "Datei).",
            items: {
              type: "OBJECT",
              properties: {
                search: { type: "STRING", description: "Exakt zu findender Text im aktuellen Dateiinhalt." },
                replace: { type: "STRING", description: "Text, der 'search' ersetzen soll." },
              },
              required: ["search", "replace"],
            },
          },
        },
        required: ["action", "filename"],
      },
    },
    createProject: {
      type: "OBJECT",
      description:
        "Nur für 'Architect Mode' verwenden: wenn ein KOMPLETT NEUES Projekt/eine neue Ressource " +
        "mit mehreren Dateien in einem eigenen Unterordner angelegt werden soll. Leer/null lassen " +
        "für alles andere (einzelne Datei-Änderungen laufen über 'actions').",
      properties: {
        rootFolder: { type: "STRING", description: "Name des neuen Wurzelordners für das Projekt, relativ zum Workspace." },
        files: {
          type: "ARRAY",
          description: "Alle Dateien des neuen Projekts, mit Pfaden relativ zu rootFolder.",
          items: {
            type: "OBJECT",
            properties: {
              filename: { type: "STRING", description: "Pfad relativ zu rootFolder, z. B. \"client/main.lua\"." },
              content: { type: "STRING", description: "Vollständiger, normal formatierter Dateiinhalt." },
            },
            required: ["filename", "content"],
          },
        },
      },
      required: ["rootFolder", "files"],
    },
  },
  required: ["reply", "actions"],
};

export async function sendToGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  safetyThreshold: string,
  contents: GeminiContent[],
  responseSchema?: object
): Promise<GeminiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    safetySettings: SAFETY_CATEGORIES.map((category) => ({
      category,
      threshold: safetyThreshold,
    })),
  };

  if (responseSchema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let errJson: unknown = null;
    try {
      errJson = await res.json();
      message = (errJson as { error?: { message?: string } })?.error?.message ?? message;
    } catch {
      // ignore parse failure, keep default message
    }
    if (res.status === 429) {
      throw new GeminiApiError(message, 429, parseRetryDelaySeconds(errJson));
    }
    throw new GeminiApiError(message, res.status);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Von Google blockiert: ${blockReason}` : "Keine Antwort erhalten.");
  }

  const text: string = candidate.content?.parts?.map((p: GeminiContentPart) => p.text ?? "").join("") ?? "";
  const usage = data.usageMetadata ?? {};

  return {
    text,
    promptTokens: usage.promptTokenCount ?? 0,
    candidatesTokens: usage.candidatesTokenCount ?? 0,
  };
}

/** True for HTTP 503 responses ("model is currently overloaded / high demand") - these are
 * transient and worth retrying, unlike most other errors. */
export function isOverloadedError(err: unknown): boolean {
  return err instanceof GeminiApiError && err.status === 503;
}

export interface RetryStatus {
  attempt: number;
  maxAttempts: number;
  model: string;
  isFallback: boolean;
}

const OVERLOAD_MAX_ATTEMPTS = 3;
const OVERLOAD_RETRY_DELAYS_MS = [1000, 2000, 4000];

/** Wraps sendToGemini with automatic retries (with backoff) on HTTP 503 "high demand" errors,
 * and falls back to trying each model in fallbackModels once each if the primary model keeps
 * failing. onStatusUpdate is called before every attempt so the UI can show progress. */
export async function sendToGeminiWithRetry(
  apiKey: string,
  model: string,
  systemPrompt: string,
  safetyThreshold: string,
  contents: GeminiContent[],
  responseSchema: object | undefined,
  fallbackModels: string[] = [],
  onStatusUpdate?: (status: RetryStatus) => void
): Promise<GeminiResult> {
  const modelsToTry = [model, ...fallbackModels];
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const currentModel = modelsToTry[modelIndex];
    const isFallback = modelIndex > 0;
    const maxAttempts = isFallback ? 1 : OVERLOAD_MAX_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      onStatusUpdate?.({ attempt, maxAttempts, model: currentModel, isFallback });
      try {
        return await sendToGemini(apiKey, currentModel, systemPrompt, safetyThreshold, contents, responseSchema);
      } catch (err) {
        lastError = err;
        if (!isOverloadedError(err)) throw err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 4000));
        }
      }
    }
  }

  throw lastError;
}

/** Strips leading/trailing markdown code fences from a model response, per system prompt instruction. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
