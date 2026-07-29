import { Language } from "./types";

interface Dict {
  newChat: string;
  settings: string;
  noWorkspace: string;
  pickWorkspaceTitle: string;
  showFilesTitle: string;
  hideFilesTitle: string;
  detachWorkspaceTitle: string;
  loadingFiles: string;
  emptyFolder: string;
  folderReadError: string;
  attachFileTitle: string;
  attachFileDialogTitle: string;
  removeAttachmentTitle: string;
  promptPlaceholder: string;
  sendTitle: string;
  tokens: (n: number) => string;
  requestsToday: (n: number, limit: number) => string;
  you: string;
  fileCreated: string;
  fileEdited: string;
  fileDeleted: string;
  actionFailed: (action: string, filename: string, error: string) => string;
  updateFileBtn: (name: string) => string;
  updatedFileBtn: (name: string) => string;
  updateFileError: (err: string) => string;
  deleteChatTitle: string;
  renameChatTitle: string;
  updateAvailable: (v: string) => string;
  installUpdate: string;
  installing: string;
  installUpdateError: (err: string) => string;
  later: string;
  cooldownNotice: (s: number) => string;
  needApiKey: string;
  dailyLimitReached: string;
  rateLimitReached: string;
  readFileError: (err: string) => string;
  settingsTitle: string;
  apiKeyLabel: string;
  apiKeyHint: string;
  systemPromptLabel: string;
  safetyLabel: string;
  safetyNone: string;
  safetyHigh: string;
  safetyMedium: string;
  safetyLow: string;
  save: string;
  patchNotesTitle: string;
  patchNotesClose: string;
  thinking: string;
  modelOverloadedRetrying: (attempt: number, max: number) => string;
  modelOverloadedSwitching: (model: string) => string;
  errorPrefix: (msg: string) => string;
}

const de: Dict = {
  newChat: "Neuer Chat",
  settings: "Einstellungen",
  noWorkspace: "Kein Arbeitsordner verknüpft",
  pickWorkspaceTitle: "Arbeitsordner wählen",
  showFilesTitle: "Dateien anzeigen",
  hideFilesTitle: "Dateien verbergen",
  detachWorkspaceTitle: "Ordner entfernen",
  loadingFiles: "Lade Dateien…",
  emptyFolder: "(Ordner ist leer)",
  folderReadError: "Fehler beim Lesen des Ordners",
  attachFileTitle: "Datei anhängen",
  attachFileDialogTitle: "Datei anhängen",
  removeAttachmentTitle: "Entfernen",
  promptPlaceholder: "Nachricht an NovaTwin…",
  sendTitle: "Senden",
  tokens: (n) => `Tokens: ${n}`,
  requestsToday: (n, limit) => `Anfragen heute: ${n} / ${limit}`,
  you: "Du",
  fileCreated: "erstellt",
  fileEdited: "bearbeitet",
  fileDeleted: "gelöscht",
  actionFailed: (action, filename, error) => `Aktion „${action}" für ${filename} fehlgeschlagen: ${error}`,
  updateFileBtn: (name) => `Datei aktualisieren: ${name}`,
  updatedFileBtn: (name) => `Aktualisiert: ${name}`,
  updateFileError: (err) => `Fehler beim Schreiben der Datei: ${err}`,
  deleteChatTitle: "Löschen",
  renameChatTitle: "Umbenennen (Doppelklick)",
  updateAvailable: (v) => `Update verfügbar: Version ${v}`,
  installUpdate: "Jetzt installieren",
  installing: "Wird installiert…",
  installUpdateError: (err) => `Update konnte nicht installiert werden: ${err}`,
  later: "Später",
  cooldownNotice: (s) => `Kontingent-Limit erreicht. Bitte warte ${s}s, bevor du erneut sendest.`,
  needApiKey: "Bitte zuerst einen Google AI Studio API-Schlüssel in den Einstellungen hinterlegen.",
  dailyLimitReached: "Tageslimit von 1000 Anfragen erreicht. Bitte morgen erneut versuchen.",
  rateLimitReached: "Rate-Limit erreicht: maximal 15 Anfragen pro Minute. Bitte kurz warten.",
  readFileError: (err) => `Datei konnte nicht gelesen werden: ${err}`,
  settingsTitle: "Einstellungen",
  apiKeyLabel: "Google AI Studio API-Schlüssel",
  apiKeyHint:
    "Wird sicher im Betriebssystem-Schlüsselbund gespeichert (Windows Credential Manager / Linux Secret Service), niemals im Quellcode oder Klartext.",
  systemPromptLabel: "System-Prompt",
  safetyLabel: "Sicherheitsfilter",
  safetyNone: "Kein Filter (BLOCK_NONE)",
  safetyHigh: "Nur hohes Risiko blockieren",
  safetyMedium: "Standard (mittel und höher)",
  safetyLow: "Streng (niedrig und höher)",
  save: "Speichern",
  patchNotesTitle: "Was ist neu",
  patchNotesClose: "Schließen",
  thinking: "NovaTwin denkt nach",
  modelOverloadedRetrying: (attempt, max) => `Modell überlastet, Versuch ${attempt}/${max}…`,
  modelOverloadedSwitching: (model) => `Modell überlastet, wechsle zu ${model}…`,
  errorPrefix: (msg) => `Fehler: ${msg}`,
};

const en: Dict = {
  newChat: "New Chat",
  settings: "Settings",
  noWorkspace: "No workspace folder linked",
  pickWorkspaceTitle: "Choose workspace folder",
  showFilesTitle: "Show files",
  hideFilesTitle: "Hide files",
  detachWorkspaceTitle: "Remove folder",
  loadingFiles: "Loading files…",
  emptyFolder: "(Folder is empty)",
  folderReadError: "Failed to read folder",
  attachFileTitle: "Attach file",
  attachFileDialogTitle: "Attach file",
  removeAttachmentTitle: "Remove",
  promptPlaceholder: "Message NovaTwin…",
  sendTitle: "Send",
  tokens: (n) => `Tokens: ${n}`,
  requestsToday: (n, limit) => `Requests today: ${n} / ${limit}`,
  you: "You",
  fileCreated: "created",
  fileEdited: "edited",
  fileDeleted: "deleted",
  actionFailed: (action, filename, error) => `Action "${action}" for ${filename} failed: ${error}`,
  updateFileBtn: (name) => `Update file: ${name}`,
  updatedFileBtn: (name) => `Updated: ${name}`,
  updateFileError: (err) => `Failed to write file: ${err}`,
  deleteChatTitle: "Delete",
  renameChatTitle: "Rename (double-click)",
  updateAvailable: (v) => `Update available: version ${v}`,
  installUpdate: "Install now",
  installing: "Installing…",
  installUpdateError: (err) => `Update could not be installed: ${err}`,
  later: "Later",
  cooldownNotice: (s) => `Quota limit reached. Please wait ${s}s before sending again.`,
  needApiKey: "Please add a Google AI Studio API key in the settings first.",
  dailyLimitReached: "Daily limit of 1000 requests reached. Please try again tomorrow.",
  rateLimitReached: "Rate limit reached: max. 15 requests per minute. Please wait a moment.",
  readFileError: (err) => `Failed to read file: ${err}`,
  settingsTitle: "Settings",
  apiKeyLabel: "Google AI Studio API key",
  apiKeyHint:
    "Stored securely in the OS credential store (Windows Credential Manager / Linux Secret Service), never in source code or plain text.",
  systemPromptLabel: "System prompt",
  safetyLabel: "Safety filter",
  safetyNone: "No filter (BLOCK_NONE)",
  safetyHigh: "Block high risk only",
  safetyMedium: "Standard (medium and above)",
  safetyLow: "Strict (low and above)",
  save: "Save",
  patchNotesTitle: "What's new",
  patchNotesClose: "Close",
  thinking: "NovaTwin is thinking",
  modelOverloadedRetrying: (attempt, max) => `Model overloaded, attempt ${attempt}/${max}…`,
  modelOverloadedSwitching: (model) => `Model overloaded, switching to ${model}…`,
  errorPrefix: (msg) => `Error: ${msg}`,
};

const dicts: Record<Language, Dict> = { de, en };

let currentLang: Language = "de";

export function setLanguage(lang: Language): void {
  currentLang = lang;
}

export function getLanguage(): Language {
  return currentLang;
}

export const t: Dict = new Proxy({} as Dict, {
  get(_target, prop: keyof Dict) {
    return dicts[currentLang][prop];
  },
});
