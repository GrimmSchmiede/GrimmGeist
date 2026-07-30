import { Language } from "./types";

interface Dict {
  newChat: string;
  settings: string;
  noWorkspace: string;
  pickWorkspaceTitle: string;
  showFilesTitle: string;
  hideFilesTitle: string;
  detachWorkspaceTitle: string;
  toggleEditorTitle: string;
  showEditorTitle: string;
  hideEditorTitle: string;
  saveFileTitle: string;
  openInEditorTitle: string;
  openEditorEmpty: string;
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
  getApiKeyBtn: string;
  apiKeyDetectedNote: string;
  openLinkError: (err: string) => string;
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
  securitySectionLabel: string;
  securityModeHint: string;
  securityModeAlways: string;
  securityModePartial: string;
  securityModeNone: string;
  approvalCreateLabel: string;
  approvalEditLabel: string;
  approvalDeleteLabel: string;
  deleteApprovalMessage: (filename: string) => string;
  diffApprovalTitle: (filename: string) => string;
  approvalCancel: string;
  approvalConfirmDelete: string;
  approvalDiscard: string;
  approvalAccept: string;
  actionRejectedByUser: string;
  batchApprovalTitle: (rootFolder: string) => string;
  fileCreatedProject: (rootFolder: string, count: number) => string;
  editFuzzyMatch: string;
  editNotFound: string;
  jsonRepairFailed: string;
  imageAttached: (name: string) => string;
  removeImageTitle: string;
  disclaimerTitle: string;
  disclaimerText: string;
  disclaimerCheckboxLabel: string;
  disclaimerCancel: string;
  disclaimerAccept: string;
}

const de: Dict = {
  newChat: "Neuer Chat",
  settings: "Einstellungen",
  noWorkspace: "Kein Arbeitsordner verknüpft",
  pickWorkspaceTitle: "Arbeitsordner wählen",
  showFilesTitle: "Dateien anzeigen",
  hideFilesTitle: "Dateien verbergen",
  detachWorkspaceTitle: "Ordner entfernen",
  toggleEditorTitle: "Live-Editor ein-/ausblenden",
  showEditorTitle: "Live-Editor einblenden",
  hideEditorTitle: "Live-Editor ausblenden",
  saveFileTitle: "Speichern (Strg+S)",
  openInEditorTitle: "Im Live-Editor öffnen",
  openEditorEmpty: "Öffne eine Datei aus der Dateiliste, um sie hier zu bearbeiten.",
  loadingFiles: "Lade Dateien…",
  emptyFolder: "(Ordner ist leer)",
  folderReadError: "Fehler beim Lesen des Ordners",
  attachFileTitle: "Datei anhängen",
  attachFileDialogTitle: "Datei anhängen",
  removeAttachmentTitle: "Entfernen",
  promptPlaceholder: "Nachricht an NovaTree…",
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
  renameChatTitle: "Umbenennen",
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
  getApiKeyBtn: "API-Schlüssel holen",
  apiKeyDetectedNote: "✓ API-Schlüssel aus Zwischenablage erkannt",
  openLinkError: (err) => `Link konnte nicht geöffnet werden: ${err}`,
  systemPromptLabel: "System-Prompt",
  safetyLabel: "Sicherheitsfilter",
  safetyNone: "Kein Filter (BLOCK_NONE)",
  safetyHigh: "Nur hohes Risiko blockieren",
  safetyMedium: "Standard (mittel und höher)",
  safetyLow: "Streng (niedrig und höher)",
  save: "Speichern",
  patchNotesTitle: "Was ist neu",
  patchNotesClose: "Schließen",
  thinking: "NovaTree denkt nach",
  modelOverloadedRetrying: (attempt, max) => `Modell überlastet, Versuch ${attempt}/${max}…`,
  modelOverloadedSwitching: (model) => `Modell überlastet, wechsle zu ${model}…`,
  errorPrefix: (msg) => `Fehler: ${msg}`,
  securitySectionLabel: "KI-Dateizugriff",
  securityModeHint: "Legt fest, ob NovaTree vor Datei-Änderungen im Workspace-Ordner erst deine Freigabe braucht.",
  securityModeAlways: "Immer nachfragen",
  securityModePartial: "Teil-Autonom",
  securityModeNone: "Voll-Autonom",
  approvalCreateLabel: "Freigabe beim Erstellen neuer Dateien",
  approvalEditLabel: "Freigabe beim Bearbeiten bestehender Dateien",
  approvalDeleteLabel: "Freigabe beim Löschen von Dateien",
  deleteApprovalMessage: (filename) => `Möchtest du zulassen, dass die KI die Datei „${filename}" unwiderruflich löscht?`,
  diffApprovalTitle: (filename) => `Vorgeschlagene Änderung: ${filename}`,
  approvalCancel: "Abbrechen",
  approvalConfirmDelete: "Ja, löschen",
  approvalDiscard: "Verwerfen",
  approvalAccept: "Änderungen übernehmen",
  actionRejectedByUser: "Vom Nutzer abgelehnt",
  batchApprovalTitle: (rootFolder) => `Neues Projekt erstellen: ${rootFolder}`,
  fileCreatedProject: (rootFolder, count) => `Projekt „${rootFolder}" erstellt (${count} Dateien)`,
  editFuzzyMatch: "Suchmuster nur mit abweichenden Leerzeichen/Einrückung gefunden - keine automatische Änderung vorgenommen. Bitte Anfrage neu formulieren oder Datei manuell prüfen.",
  editNotFound: "Suchmuster wurde in der Datei nicht gefunden - keine Änderung vorgenommen.",
  jsonRepairFailed: "Die Antwort wurde abgeschnitten und konnte nicht repariert werden. Bitte versuche es erneut oder formuliere die Anfrage kleinteiliger.",
  imageAttached: (name) => `Bild angehängt: ${name}`,
  removeImageTitle: "Bild entfernen",
  disclaimerTitle: "Achtung: Autonomer Dateizugriff",
  disclaimerText:
    "Sie stehen im Begriff, der KI Zugriff auf ein lokales Verzeichnis zu gewähren. Je nach " +
    "Freigabe-Modus kann die KI selbstständig Dateien erstellen, verändern oder unwiderruflich löschen.",
  disclaimerCheckboxLabel:
    "Ich verstehe, dass die Nutzung auf eigene Gefahr erfolgt und die Entwickler von NovaTree " +
    "nicht für Datenverlust oder Schäden an meinem System haftbar gemacht werden können.",
  disclaimerCancel: "Abbrechen",
  disclaimerAccept: "Workspace aktivieren",
};

const en: Dict = {
  newChat: "New Chat",
  settings: "Settings",
  noWorkspace: "No workspace folder linked",
  pickWorkspaceTitle: "Choose workspace folder",
  showFilesTitle: "Show files",
  hideFilesTitle: "Hide files",
  detachWorkspaceTitle: "Remove folder",
  toggleEditorTitle: "Toggle live editor",
  showEditorTitle: "Show live editor",
  hideEditorTitle: "Hide live editor",
  saveFileTitle: "Save (Ctrl+S)",
  openInEditorTitle: "Open in live editor",
  openEditorEmpty: "Open a file from the file list to edit it here.",
  loadingFiles: "Loading files…",
  emptyFolder: "(Folder is empty)",
  folderReadError: "Failed to read folder",
  attachFileTitle: "Attach file",
  attachFileDialogTitle: "Attach file",
  removeAttachmentTitle: "Remove",
  promptPlaceholder: "Message NovaTree…",
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
  renameChatTitle: "Rename",
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
  getApiKeyBtn: "Get API key",
  apiKeyDetectedNote: "✓ API key detected from clipboard",
  openLinkError: (err) => `Could not open link: ${err}`,
  systemPromptLabel: "System prompt",
  safetyLabel: "Safety filter",
  safetyNone: "No filter (BLOCK_NONE)",
  safetyHigh: "Block high risk only",
  safetyMedium: "Standard (medium and above)",
  safetyLow: "Strict (low and above)",
  save: "Save",
  patchNotesTitle: "What's new",
  patchNotesClose: "Close",
  thinking: "NovaTree is thinking",
  modelOverloadedRetrying: (attempt, max) => `Model overloaded, attempt ${attempt}/${max}…`,
  modelOverloadedSwitching: (model) => `Model overloaded, switching to ${model}…`,
  errorPrefix: (msg) => `Error: ${msg}`,
  securitySectionLabel: "AI file access",
  securityModeHint: "Controls whether NovaTree needs your approval before changing files in the workspace folder.",
  securityModeAlways: "Always ask",
  securityModePartial: "Partially autonomous",
  securityModeNone: "Fully autonomous",
  approvalCreateLabel: "Require approval when creating new files",
  approvalEditLabel: "Require approval when editing existing files",
  approvalDeleteLabel: "Require approval when deleting files",
  deleteApprovalMessage: (filename) => `Allow the AI to permanently delete the file "${filename}"?`,
  diffApprovalTitle: (filename) => `Proposed change: ${filename}`,
  approvalCancel: "Cancel",
  approvalConfirmDelete: "Yes, delete",
  approvalDiscard: "Discard",
  approvalAccept: "Apply changes",
  actionRejectedByUser: "Rejected by user",
  batchApprovalTitle: (rootFolder) => `Create new project: ${rootFolder}`,
  fileCreatedProject: (rootFolder, count) => `Project "${rootFolder}" created (${count} files)`,
  editFuzzyMatch: "Search text was only found with different whitespace/indentation - no change applied. Please rephrase the request or check the file manually.",
  editNotFound: "Search text was not found in the file - no change applied.",
  jsonRepairFailed: "The response was truncated and could not be repaired. Please try again or split the request into smaller steps.",
  imageAttached: (name) => `Image attached: ${name}`,
  removeImageTitle: "Remove image",
  disclaimerTitle: "Warning: autonomous file access",
  disclaimerText:
    "You are about to grant the AI access to a local directory. Depending on the approval mode, " +
    "the AI can create, modify, or permanently delete files on its own.",
  disclaimerCheckboxLabel:
    "I understand that use is entirely at my own risk and that the NovaTree developers cannot be " +
    "held liable for data loss or damage to my system.",
  disclaimerCancel: "Cancel",
  disclaimerAccept: "Enable workspace",
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
