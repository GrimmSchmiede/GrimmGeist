export type Role = "user" | "model";

export interface AttachedFile {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceActionResult {
  action: "create" | "edit" | "delete" | "create_project";
  filename: string;
  success: boolean;
  error?: string;
}

/** A pasted/dropped image attached to an outgoing message, already downscaled/compressed
 * client-side before being sent to Gemini as an inlineData part. */
export interface ChatImage {
  dataUrl: string;
  name: string;
}

export interface ChatMessage {
  role: Role;
  text: string;
  files?: AttachedFile[];
  images?: ChatImage[];
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
  };
  pending?: boolean;
  pendingStartedAt?: number;
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

export type Language = "de" | "en";

/** "always" = jede Datei-Aktion braucht Freigabe. "partial" = pro Aktionstyp konfigurierbar
 * (requireApprovalFor). "none" = voll-autonom, nie nachfragen. */
export type SecurityMode = "always" | "partial" | "none";

export interface SecuritySettings {
  mode: SecurityMode;
  requireApprovalFor: {
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  mode: "partial",
  requireApprovalFor: { create: false, edit: true, delete: true },
};

export interface AppSettings {
  systemPrompt: string;
  safetyThreshold: string;
  language: Language;
  security: SecuritySettings;
}

export function actionRequiresApproval(
  action: "create" | "edit" | "delete",
  security: SecuritySettings
): boolean {
  if (security.mode === "always") return true;
  if (security.mode === "none") return false;
  return security.requireApprovalFor[action];
}

export interface QuotaState {
  date: string;
  count: number;
}

export const DEFAULT_SYSTEM_PROMPT =
  "Du bist NovaTree, ein Assistent zur Analyse und Bearbeitung von Code-Dateien (u.a. Lua, Python). " +
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
    "Dateiänderung nutze nur 'reply' und lasse 'actions' leer.\n\n" +
    "WICHTIG für die Dateistruktur: Achte bei mehreren Dateien auf eine sinnvolle, übliche " +
    "Ordnerstruktur passend zum Projekttyp (z. B. bei FiveM-Ressourcen: client/, server/, html/, " +
    "config/ - bei Webprojekten: src/, assets/ - bei Python: src/ oder Modul-Unterordner), statt " +
    "alle Dateien flach ins Wurzelverzeichnis zu legen. Nutze dafür relative Pfade mit " +
    "Unterordnern im 'filename'-Feld (z. B. \"client/main.lua\"). Nur wenn der Nutzer ausdrücklich " +
    "eine flache Struktur wünscht oder es sich um ein einzelnes, eigenständiges Skript handelt, " +
    "lege die Datei direkt ins Wurzelverzeichnis.\n\n" +
    "WICHTIG für 'content': Schreibe IMMER normal formatierten, mehrzeiligen Code mit echten " +
    "Zeilenumbrüchen und sauberer Einrückung - genau wie in einer IDE. Quetsche NIEMALS den " +
    "kompletten Dateiinhalt in eine einzige Zeile, nur weil er als JSON-String übertragen wird.\n\n" +
    "WICHTIG für 'action=edit': Überschreibe eine bestehende Datei NIEMALS komplett über 'content'. " +
    "Nutze stattdessen IMMER das 'edits'-Array mit präzisen Suchen/Ersetzen-Paaren " +
    "({\"search\": \"...\", \"replace\": \"...\"}). 'search' muss exakt (Zeichen für Zeichen, " +
    "inklusive Einrückung) im dir bekannten aktuellen Dateiinhalt vorkommen - kopiere ihn " +
    "wortwörtlich, erfinde ihn nicht. Halte 'search' so kurz wie möglich (z. B. nur die betroffene " +
    "Funktion/den betroffenen Block), aber lang genug, um eindeutig zu sein.\n\n" +
    "PRESERVATION RULE (sehr wichtig): Ändere bei 'edit'-Aktionen NUR den Teil der Datei, um den " +
    "der Nutzer explizit gebeten hat. Lösche, vereinfache oder verändere NIEMALS unbeteiligten " +
    "vorhandenen Code - insbesondere nicht bestehendes CSS, Animationen, Layout oder Business-" +
    "Logik, die mit der Anfrage nichts zu tun haben. Wenn du unsicher bist, ob etwas zur Anfrage " +
    "gehört, lass es unangetastet.\n\n" +
    "ARCHITECT MODE ('createProject'): Wenn der Nutzer ein komplett NEUES Projekt/eine neue " +
    "Ressource mit mehreren Dateien möchte (nicht nur eine einzelne neue Datei), nutze das " +
    "'createProject'-Feld statt vieler einzelner 'create'-Aktionen: {\"rootFolder\": \"name\", " +
    "\"files\": [{\"filename\": \"...\", \"content\": \"...\"}]}. Lass 'actions' in diesem Fall " +
    "leer und liefere stattdessen 'createProject'. Für einzelne neue Dateien in einem bereits " +
    "bestehenden Projekt bleibt weiterhin eine normale 'create'-Aktion in 'actions' richtig."
  );
}

/** Appended to every system prompt so Gemini replies in the UI's selected language. */
export function buildLanguageSystemPromptAddition(language: Language): string {
  return language === "en"
    ? "\n\nAlways reply in English, regardless of the language the user writes in."
    : "\n\nAntworte immer auf Deutsch, unabhängig davon, in welcher Sprache der Nutzer schreibt.";
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
