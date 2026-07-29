export type Role = "user" | "model";

export interface AttachedFile {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceActionResult {
  action: "create" | "edit" | "delete";
  filename: string;
  success: boolean;
  error?: string;
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
  workspaceActions?: WorkspaceActionResult[];
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  totalTokens: number;
  workspacePath?: string;
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

/** Appended to the system prompt only while a chat has a workspace folder linked. The response
 * shape itself (reply/actions) is enforced via the Gemini API's Structured Output mode
 * (see WORKSPACE_RESPONSE_SCHEMA in gemini.ts), not just prompt instructions. */
export function buildWorkspaceSystemPromptAddition(fileList: string[]): string {
  const files = fileList.length ? fileList.map((f) => `- ${f}`).join("\n") : "(Ordner ist leer)";
  return (
    "\n\nZUSÄTZLICH hast du Zugriff auf einen lokalen Workspace-Ordner. Vorhandene Dateien darin:\n" +
    `${files}\n\n` +
    "Deine Antwort hat zwei Felder: 'reply' für normalen Chat-Text (Erklärungen, Rückfragen) und " +
    "'actions' für Datei-Operationen in diesem Workspace-Ordner. Nutze 'actions', wenn der Nutzer " +
    "möchte, dass du Dateien erstellst, bearbeitest oder löschst. Fülle 'reply' dabei IMMER mit " +
    "einer kurzen, konkreten Zusammenfassung (1-3 Sätze): was genau wurde in welchen Dateien " +
    "gemacht, und was wäre ein sinnvoller nächster Schritt (z. B. fehlende Assets, offene " +
    "Konfiguration, zum Testen benötigte Schritte). Lasse 'reply' nur leer, wenn wirklich nichts " +
    "davon relevant ist. Wenn die Anfrage mehrere Dateien braucht (z. B. ein " +
    "komplettes Feature oder eine ganze Ressource mit mehreren Skripten/Configs), liefere ALLE " +
    "dafür nötigen Dateien in EINER Antwort als mehrere Einträge im actions-Array, statt nur eine " +
    "einzelne Datei zu erstellen und auf Rückfrage zu warten. Für reine Fragen/Erklärungen ohne " +
    "Dateiänderung nutze nur 'reply' und lasse 'actions' leer."
  );
}

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
