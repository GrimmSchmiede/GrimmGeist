export type Role = "user" | "model";

export interface AttachedFile {
  path: string;
  name: string;
  content: string;
}

export interface ChatMessage {
  role: Role;
  text: string;
  files?: AttachedFile[];
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
  };
  pending?: boolean;
  error?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  totalTokens: number;
}

export interface AppSettings {
  systemPrompt: string;
  safetyThreshold: string;
}

export interface QuotaState {
  date: string;
  count: number;
}

export const DEFAULT_SYSTEM_PROMPT =
  "Du bist NovaTwin, ein Assistent zur Analyse und Bearbeitung von Code-Dateien (u.a. Lua, Python). " +
  "Wenn der Nutzer eine Datei anhängt und um eine Änderung bittet, antworte mit dem VOLLSTÄNDIGEN neuen " +
  "Dateiinhalt als reinen Text, OHNE Markdown-Codeblöcke (keine ``` Backticks), ohne Erklärungen davor " +
  "oder danach. Wenn keine Datei bearbeitet werden soll, antworte normal in Klartext.";

export interface ModelOption {
  value: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

// gemini-2.5-flash / gemini-2.5-flash-lite wurden durch die rollierenden Alias-Modelle ersetzt,
// nachdem Google die versionsgebundenen Modelle für neue API-Keys gesperrt hat
// ("is no longer available to new users"). gemini-2.5-pro bleibt im Free Tier auf limit: 0
// (Quota exceeded) und wird daher nur ausgegraut angezeigt statt entfernt.
export const MODEL_OPTIONS: ModelOption[] = [
  { value: "gemini-flash-latest", label: "gemini-flash-latest" },
  { value: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
  {
    value: "gemini-2.5-pro",
    label: "gemini-2.5-pro (Free Tier: Kontingent 0)",
    disabled: true,
    disabledReason: "Google gewährt für diesen API-Schlüssel im Free Tier kein Kontingent (limit: 0) für gemini-2.5-pro.",
  },
];

export const DEFAULT_MODEL = "gemini-flash-latest";

export const DAILY_REQUEST_LIMIT = 1000;
export const PER_MINUTE_REQUEST_LIMIT = 15;
