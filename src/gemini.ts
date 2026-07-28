import { AttachedFile, ChatMessage } from "./types";

interface GeminiContentPart {
  text: string;
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

function messageToPromptText(text: string, files?: AttachedFile[]): string {
  if (!files || files.length === 0) return text;
  const fileBlocks = files
    .map((f) => `Datei: ${f.name}\n---\n${f.content}\n---`)
    .join("\n\n");
  return `${text}\n\n${fileBlocks}`;
}

export function historyToContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .filter((m) => !m.pending && !m.error)
    .map((m) => ({
      role: m.role,
      parts: [{ text: messageToPromptText(m.text, m.files) }],
    }));
}

const SAFETY_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
];

export async function sendToGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  safetyThreshold: string,
  contents: GeminiContent[]
): Promise<GeminiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    safetySettings: SAFETY_CATEGORIES.map((category) => ({
      category,
      threshold: safetyThreshold,
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      message = errJson?.error?.message ?? message;
    } catch {
      // ignore parse failure, keep default message
    }
    throw new Error(message);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Von Google blockiert: ${blockReason}` : "Keine Antwort erhalten.");
  }

  const text: string = candidate.content?.parts?.map((p: GeminiContentPart) => p.text).join("") ?? "";
  const usage = data.usageMetadata ?? {};

  return {
    text,
    promptTokens: usage.promptTokenCount ?? 0,
    candidatesTokens: usage.candidatesTokenCount ?? 0,
  };
}

/** Strips leading/trailing markdown code fences from a model response, per system prompt instruction. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
