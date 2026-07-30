import "./monaco-workers";
import * as monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { readWorkspaceFile, writeWorkspaceFile } from "./workspace";
import { t } from "./i18n";

export interface OpenTab {
  path: string; // workspace-relative path, or an absolute path when `absolute` is true
  name: string;
  content: string; // last content written to disk / loaded from disk
  isLockedByAI: boolean;
  dirty: boolean; // unsaved local edits
  absolute: boolean; // true for files opened via a chat attachment (no workspace involved)
}

let activeTabs: OpenTab[] = [];
let currentActiveTabPath: string | null = null;
let monacoEditorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
let currentWorkspacePath: string | null = null;
let suppressChangeEvent = false;

const editorPaneEl = document.getElementById("editor-pane")!;
const editorTabsEl = document.getElementById("editor-tabs")!;
const editorContainerEl = document.getElementById("editor-container")!;
const editorCollapseHandleEl = document.getElementById("editor-collapse-handle")!;
const editorCollapseIconEl = document.getElementById("editor-collapse-icon")!;
const editorEmptyEl = document.getElementById("editor-empty")!;
const editorSaveBtnEl = document.getElementById("editor-save-btn") as HTMLButtonElement;

export function getLanguageFromExtension(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "rs":
      return "rust";
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "cjs":
    case "mjs":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "lua":
      return "lua";
    case "toml":
      return "ini";
    case "yml":
    case "yaml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    case "xml":
      return "xml";
    case "sql":
      return "sql";
    case "go":
      return "go";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    default:
      return "plaintext";
  }
}

export function initEditor() {
  monacoEditorInstance = monaco.editor.create(editorContainerEl, {
    theme: "vs-dark",
    automaticLayout: true,
    readOnly: false,
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 2,
  });

  monacoEditorInstance.onDidChangeModelContent(() => {
    if (suppressChangeEvent) return;
    const tab = activeTabs.find((tb) => tb.path === currentActiveTabPath);
    if (!tab || tab.isLockedByAI) return;
    tab.dirty = true;
    renderTabBar();
    updateSaveButton();
  });

  // eslint-disable-next-line no-bitwise
  monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveActiveTab();
  });

  editorSaveBtnEl.addEventListener("click", saveActiveTab);
  updateSaveButton();
}

function renderTabBar() {
  editorTabsEl.innerHTML = "";
  for (const tab of activeTabs) {
    const el = document.createElement("div");
    el.className = "editor-tab" + (tab.path === currentActiveTabPath ? " active" : "");
    const lockIcon = tab.isLockedByAI ? '<span class="tab-lock" title="Wird von NovaTree bearbeitet">🔒</span>' : "";
    const dirtyDot = tab.dirty && !tab.isLockedByAI ? '<span class="tab-dirty">●</span>' : "";
    el.innerHTML = `${lockIcon}<span class="tab-name">${escapeHtml(tab.name)}</span>${dirtyDot}<button class="tab-close" title="Schließen">✕</button>`;
    el.addEventListener("click", () => switchToTab(tab.path));
    el.querySelector(".tab-close")!.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    });
    editorTabsEl.appendChild(el);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function updateEmptyState() {
  const hasTabs = activeTabs.length > 0;
  editorEmptyEl.classList.toggle("hidden", hasTabs);
  editorContainerEl.classList.toggle("hidden", !hasTabs);
}

function updateSaveButton() {
  const tab = activeTabs.find((tb) => tb.path === currentActiveTabPath);
  editorSaveBtnEl.classList.toggle("hidden", !tab);
  editorSaveBtnEl.disabled = !tab || !tab.dirty || tab.isLockedByAI;
  editorSaveBtnEl.title = t.saveFileTitle;
}

export function switchToTab(path: string) {
  const tab = activeTabs.find((tb) => tb.path === path);
  if (!tab || !monacoEditorInstance) return;

  currentActiveTabPath = path;
  suppressChangeEvent = true;
  monacoEditorInstance.setValue(tab.content);
  const model = monacoEditorInstance.getModel();
  if (model) monaco.editor.setModelLanguage(model, getLanguageFromExtension(tab.path));
  monacoEditorInstance.updateOptions({ readOnly: tab.isLockedByAI });
  suppressChangeEvent = false;

  renderTabBar();
  updateEmptyState();
  updateSaveButton();
}

export function closeTab(path: string) {
  activeTabs = activeTabs.filter((tb) => tb.path !== path);
  if (currentActiveTabPath === path) {
    currentActiveTabPath = null;
    if (activeTabs.length) {
      switchToTab(activeTabs[activeTabs.length - 1].path);
    } else {
      monacoEditorInstance?.setValue("");
      renderTabBar();
      updateEmptyState();
      updateSaveButton();
    }
  } else {
    renderTabBar();
  }
}

export function setWorkspacePath(path: string | null) {
  if (path === currentWorkspacePath) return;
  currentWorkspacePath = path;
  // Keep tabs opened from a chat attachment (absolute path) - only workspace-relative tabs
  // belong to the folder that just changed/detached.
  activeTabs = activeTabs.filter((tb) => tb.absolute);
  if (currentActiveTabPath && !activeTabs.some((tb) => tb.path === currentActiveTabPath)) {
    currentActiveTabPath = null;
    monacoEditorInstance?.setValue("");
  }
  renderTabBar();
  updateEmptyState();
  updateSaveButton();
}

/** Opens (or focuses, if already open) a workspace file in the editor and shows the editor pane. */
export async function openWorkspaceFileInEditor(relativePath: string): Promise<void> {
  if (!currentWorkspacePath) return;
  const existing = activeTabs.find((tb) => tb.path === relativePath && !tb.absolute);
  showEditorPane();
  if (existing) {
    switchToTab(relativePath);
    return;
  }
  const content = await readWorkspaceFile(currentWorkspacePath, relativePath);
  const name = relativePath.split("/").pop() ?? relativePath;
  activeTabs.push({ path: relativePath, name, content, isLockedByAI: false, dirty: false, absolute: false });
  switchToTab(relativePath);
}

/** Opens a file the user attached to a chat message (absolute path, content already in memory -
 * no disk read needed) in the editor and shows the editor pane. Works even without a workspace
 * folder linked. */
export function openAbsoluteFileInEditor(path: string, name: string, content: string): void {
  showEditorPane();
  const existing = activeTabs.find((tb) => tb.path === path && tb.absolute);
  if (existing) {
    switchToTab(path);
    return;
  }
  activeTabs.push({ path, name, content, isLockedByAI: false, dirty: false, absolute: true });
  switchToTab(path);
}

async function saveActiveTab() {
  if (!currentActiveTabPath || !monacoEditorInstance) return;
  const tab = activeTabs.find((tb) => tb.path === currentActiveTabPath);
  if (!tab || tab.isLockedByAI) return;
  const content = monacoEditorInstance.getValue();
  try {
    if (tab.absolute) {
      await invoke("write_text_file", { path: tab.path, content });
    } else {
      if (!currentWorkspacePath) return;
      await writeWorkspaceFile(currentWorkspacePath, tab.path, content);
    }
    tab.content = content;
    tab.dirty = false;
    renderTabBar();
    updateSaveButton();
  } catch (err) {
    alert(t.updateFileError(String(err)));
  }
}

/** Called by the workspace-action executor before/after NovaTree writes a file, so an open tab
 * reflects the AI-lock state and its new content in real time - without needing a Rust/Tauri
 * event round-trip, since the Gemini call and the write both already happen in this same
 * frontend context. */
export function setTabAILock(relativePath: string, locked: boolean) {
  const tab = activeTabs.find((tb) => tb.path === relativePath && !tb.absolute);
  if (!tab) return;
  tab.isLockedByAI = locked;
  if (currentActiveTabPath === relativePath && monacoEditorInstance) {
    monacoEditorInstance.updateOptions({ readOnly: locked });
  }
  renderTabBar();
  updateSaveButton();
}

/** Locks (or unlocks) every currently open workspace tab. Used for the whole duration of a
 * request to a workspace-linked chat: which file(s) NovaTree will touch is only known once its
 * response arrives, and the actual disk write afterwards completes in a few milliseconds - too
 * fast to ever be visible on its own. The perceivable "the app is working on your files" window
 * is the full round-trip, so every open tab is treated as at-risk for that whole time. */
export function setAllWorkspaceTabsLocked(locked: boolean) {
  for (const tab of activeTabs) {
    if (!tab.absolute) tab.isLockedByAI = locked;
  }
  const activeTab = activeTabs.find((tb) => tb.path === currentActiveTabPath);
  if (activeTab && monacoEditorInstance) {
    monacoEditorInstance.updateOptions({ readOnly: activeTab.isLockedByAI });
  }
  renderTabBar();
  updateSaveButton();
}

export function updateTabContent(relativePath: string, content: string) {
  const tab = activeTabs.find((tb) => tb.path === relativePath && !tb.absolute);
  if (!tab) return;
  tab.content = content;
  tab.dirty = false;
  if (currentActiveTabPath === relativePath && monacoEditorInstance) {
    suppressChangeEvent = true;
    monacoEditorInstance.setValue(content);
    suppressChangeEvent = false;
  }
  renderTabBar();
  updateSaveButton();
}

export function removeTabIfOpen(relativePath: string) {
  if (activeTabs.some((tb) => tb.path === relativePath && !tb.absolute)) {
    closeTab(relativePath);
  }
}

export function isEditorPaneVisible(): boolean {
  return !editorPaneEl.classList.contains("hidden");
}

function updateCollapseHandle() {
  const visible = isEditorPaneVisible();
  editorCollapseIconEl.textContent = visible ? "‹" : "›";
  editorCollapseHandleEl.title = visible ? t.hideEditorTitle : t.showEditorTitle;
  editorCollapseHandleEl.classList.toggle("panel-open", visible);
}

export function showEditorPane() {
  editorPaneEl.classList.remove("hidden");
  updateCollapseHandle();
  setTimeout(() => monacoEditorInstance?.layout(), 50);
}

export function hideEditorPane() {
  editorPaneEl.classList.add("hidden");
  updateCollapseHandle();
}

export function toggleEditorPane() {
  if (isEditorPaneVisible()) {
    hideEditorPane();
  } else {
    showEditorPane();
  }
}

editorCollapseHandleEl.addEventListener("click", toggleEditorPane);
updateCollapseHandle();
