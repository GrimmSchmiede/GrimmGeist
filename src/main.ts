import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { startClipboardPolling, stopClipboardPolling } from "./clipboard";
import {
  loadSettings,
  saveSettings,
  loadChats,
  saveChats,
  loadQuota,
  saveQuota,
  loadApiKey,
  saveApiKey,
  loadLastSeenVersion,
  saveLastSeenVersion,
  loadWorkspaceDisclaimerAccepted,
  saveWorkspaceDisclaimerAccepted,
} from "./storage";
import {
  GeminiApiError,
  WORKSPACE_RESPONSE_SCHEMA,
  historyToContents,
  sendToGeminiWithRetry,
  stripCodeFences,
} from "./gemini";
import { checkForUpdates } from "./updater";
import { initTitlebar, getAppVersion } from "./titlebar";
import {
  applyWorkspaceEdits,
  createWorkspaceProject,
  deleteWorkspaceFile,
  listWorkspaceFiles,
  parseWorkspaceResponse,
  pickWorkspaceFolder,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "./workspace";
import { t, setLanguage, getLanguage } from "./i18n";
import { PATCH_NOTES } from "./patchnotes";
import {
  initEditor,
  openAbsoluteFileInEditor,
  openWorkspaceFileInEditor,
  removeTabIfOpen,
  setAllWorkspaceTabsLocked,
  setTabAILock,
  setWorkspacePath as setEditorWorkspacePath,
  updateTabContent,
} from "./editor";
import { requestApproval, requestBatchCreateApproval } from "./approval";
import {
  AppSettings,
  AttachedFile,
  Chat,
  ChatImage,
  ChatMessage,
  DAILY_REQUEST_LIMIT,
  DEFAULT_MODEL,
  DEFAULT_SECURITY_SETTINGS,
  Language,
  MODEL_OPTIONS,
  PER_MINUTE_REQUEST_LIMIT,
  QuotaState,
  SecurityMode,
  WorkspaceActionResult,
  actionRequiresApproval,
  buildLanguageSystemPromptAddition,
  buildWorkspaceSystemPromptAddition,
} from "./types";

// ---- State ----
let chats: Chat[] = [];
let activeChatId: string | null = null;
let settings: AppSettings;
let apiKey: string | null = null;
let quota: QuotaState = { date: "", count: 0 };
let pendingAttachments: AttachedFile[] = [];
let pendingImages: ChatImage[] = [];
const requestTimestamps: number[] = [];
let cooldownTimer: ReturnType<typeof setInterval> | null = null;
let cooldownUntil = 0;
let workspaceFilesExpanded = false;
let pendingTimerInterval: ReturnType<typeof setInterval> | null = null;
let pendingStatusNote = "";
let appVersion = "";
let workspaceDisclaimerAccepted = false;

// ---- DOM ----
const chatListEl = document.getElementById("chat-list")!;
const messagesEl = document.getElementById("messages")!;
const modelSelectEl = document.getElementById("model-select") as HTMLSelectElement;
const tokenUsageEl = document.getElementById("token-usage")!;
const quotaUsageEl = document.getElementById("quota-usage")!;
const attachmentsEl = document.getElementById("attachments")!;
const promptInputEl = document.getElementById("prompt-input") as HTMLTextAreaElement;
const sendBtnEl = document.getElementById("send-btn") as HTMLButtonElement;
const attachBtnEl = document.getElementById("attach-btn")!;
const newChatBtnEl = document.getElementById("new-chat-btn")!;
const cooldownNoticeEl = document.getElementById("cooldown-notice")!;
const workspacePickBtnEl = document.getElementById("workspace-pick-btn")!;
const workspacePathEl = document.getElementById("workspace-path")!;
const workspaceToggleBtnEl = document.getElementById("workspace-toggle-btn")!;
const workspaceDetachBtnEl = document.getElementById("workspace-detach-btn")!;
const workspaceFilesEl = document.getElementById("workspace-files")!;

const settingsModalEl = document.getElementById("settings-modal")!;
const settingsBtnEl = document.getElementById("settings-btn")!;
const settingsCloseEl = document.getElementById("settings-close")!;
const settingsSaveEl = document.getElementById("settings-save")!;
const langDeBtnEl = document.getElementById("lang-de")!;
const langEnBtnEl = document.getElementById("lang-en")!;
const titlebarVersionEl = document.getElementById("titlebar-version")!;
const patchnotesModalEl = document.getElementById("patchnotes-modal")!;
const patchnotesCloseEl = document.getElementById("patchnotes-close")!;
const patchnotesBodyEl = document.getElementById("patchnotes-body")!;
const apiKeyInputEl = document.getElementById("api-key-input") as HTMLInputElement;
const systemPromptInputEl = document.getElementById("system-prompt-input") as HTMLTextAreaElement;
const safetySelectEl = document.getElementById("safety-select") as HTMLSelectElement;
const securityModeSelectEl = document.getElementById("security-mode-select") as HTMLSelectElement;
const approvalCreateEl = document.getElementById("approval-create") as HTMLInputElement;
const approvalEditEl = document.getElementById("approval-edit") as HTMLInputElement;
const approvalDeleteEl = document.getElementById("approval-delete") as HTMLInputElement;
const getApiKeyBtnEl = document.getElementById("get-api-key-btn")!;
const apiKeyDetectedNoteEl = document.getElementById("api-key-detected-note")!;
const disclaimerModalEl = document.getElementById("disclaimer-modal")!;
const disclaimerTitleEl = document.getElementById("disclaimer-title")!;
const disclaimerTextEl = document.getElementById("disclaimer-text")!;
const disclaimerCheckboxEl = document.getElementById("disclaimer-checkbox") as HTMLInputElement;
const disclaimerCheckboxLabelEl = document.getElementById("disclaimer-checkbox-label")!;
const disclaimerCancelEl = document.getElementById("disclaimer-cancel")!;
const disclaimerAcceptEl = document.getElementById("disclaimer-accept") as HTMLButtonElement;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMessageBody(text: string): string {
  const parts = text.split(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g);
  // String.split with capture groups returns [plain, lang, code, plain, lang, code, ..., plain]
  let html = "";
  for (let i = 0; i < parts.length; i += 3) {
    html += escapeHtml(parts[i] ?? "");
    const code = parts[i + 2];
    if (code !== undefined) {
      html += `<pre>${escapeHtml(code)}</pre>`;
    }
  }
  return html;
}

function populateModelSelect() {
  modelSelectEl.innerHTML = "";
  for (const option of MODEL_OPTIONS) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    if (option.disabled) {
      el.disabled = true;
      if (option.disabledReason) el.title = option.disabledReason;
    }
    modelSelectEl.appendChild(el);
  }
}

function activeChat(): Chat | null {
  return chats.find((c) => c.id === activeChatId) ?? null;
}

function persist() {
  saveChats(chats);
}

function startChatRename(chat: Chat, titleEl: HTMLElement) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-title-input";
  input.value = chat.title;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;
  const commit = () => {
    if (settled) return;
    settled = true;
    const newTitle = input.value.trim();
    chat.title = newTitle || chat.title;
    persist();
    renderChatList();
  };
  const cancel = () => {
    if (settled) return;
    settled = true;
    renderChatList();
  };

  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
  input.addEventListener("click", (e) => e.stopPropagation());
}

function renderChatList() {
  chatListEl.innerHTML = "";
  for (const chat of [...chats].sort((a, b) => b.createdAt - a.createdAt)) {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (chat.id === activeChatId ? " active" : "");
    item.innerHTML = `<span class="chat-title">${escapeHtml(chat.title)}</span><button class="delete-chat" title="${t.deleteChatTitle}">✕</button>`;
    const titleEl = item.querySelector(".chat-title") as HTMLElement;
    titleEl.addEventListener("click", () => selectChat(chat.id));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showChatContextMenu(e.clientX, e.clientY, chat, titleEl);
    });
    item.querySelector(".delete-chat")!.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    chatListEl.appendChild(item);
  }
}

let chatContextMenuEl: HTMLElement | null = null;

function hideChatContextMenu() {
  chatContextMenuEl?.remove();
  chatContextMenuEl = null;
  document.removeEventListener("click", hideChatContextMenu);
}

function showChatContextMenu(x: number, y: number, chat: Chat, titleEl: HTMLElement) {
  hideChatContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.innerHTML = `
    <button class="context-menu-item" data-action="rename">✏️ ${t.renameChatTitle}</button>
    <button class="context-menu-item danger" data-action="delete">🗑️ ${t.deleteChatTitle}</button>
  `;
  menu.querySelector('[data-action="rename"]')!.addEventListener("click", () => {
    hideChatContextMenu();
    startChatRename(chat, titleEl);
  });
  menu.querySelector('[data-action="delete"]')!.addEventListener("click", () => {
    hideChatContextMenu();
    deleteChat(chat.id);
  });
  document.body.appendChild(menu);
  chatContextMenuEl = menu;
  setTimeout(() => document.addEventListener("click", hideChatContextMenu), 0);
}

function stopPendingTimer() {
  if (pendingTimerInterval) {
    clearInterval(pendingTimerInterval);
    pendingTimerInterval = null;
  }
}

function startPendingTimer(startedAt: number) {
  stopPendingTimer();
  const el = document.getElementById("pending-timer-text");
  if (!el) return;
  const tick = () => {
    const timerEl = document.getElementById("pending-timer-text");
    if (!timerEl) {
      stopPendingTimer();
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    timerEl.textContent = `${pendingStatusNote || t.thinking}… ${elapsed}s`;
  };
  tick();
  pendingTimerInterval = setInterval(tick, 1000);
}

function renderMessages() {
  stopPendingTimer();
  const chat = activeChat();
  messagesEl.innerHTML = "";
  if (!chat) return;

  chat.messages.forEach((msg, idx) => {
    const el = document.createElement("div");
    el.className = `message ${msg.role}` + (msg.pending ? " pending" : "") + (msg.error ? " error" : "");

    const roleLabel = msg.role === "user" ? t.you : "NovaTree";
    let filesHtml = "";
    if (msg.files && msg.files.length) {
      filesHtml = `<div class="file-actions">${msg.files
        .map((f, i) => `<span class="file-tag" data-file-idx="${i}" title="${t.openInEditorTitle}">📎 ${escapeHtml(f.name)}</span>`)
        .join("")}</div>`;
    }
    if (msg.images && msg.images.length) {
      filesHtml += `<div class="message-images">${msg.images
        .map((img) => `<img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" class="message-image-thumb" />`)
        .join("")}</div>`;
    }

    let bubbleHtml: string;
    if (msg.pending) {
      bubbleHtml =
        '<div class="bubble"><span class="typing-dots"><span></span><span></span><span></span></span>' +
        '<span id="pending-timer-text" class="pending-timer"></span></div>';
    } else if (msg.workspaceActions && !msg.text) {
      bubbleHtml = "";
    } else {
      bubbleHtml = `<div class="bubble">${renderMessageBody(msg.text)}</div>`;
    }

    let workspaceActionHtml = "";
    if (msg.workspaceActions) {
      const actionLabel = { create: t.fileCreated, edit: t.fileEdited, delete: t.fileDeleted, create_project: "" };
      workspaceActionHtml = msg.workspaceActions
        .map((wa) => {
          if (wa.success && wa.action === "create_project") {
            return `<div class="workspace-action-note success">${escapeHtml(wa.filename)}</div>`;
          }
          return wa.success
            ? `<div class="workspace-action-note success">${escapeHtml(actionLabel[wa.action])}: ${escapeHtml(wa.filename)}</div>`
            : `<div class="workspace-action-note failed">${escapeHtml(t.actionFailed(wa.action, wa.filename, wa.error ?? ""))}</div>`;
        })
        .join("");
    }

    el.innerHTML = `
      <span class="role-label">${escapeHtml(roleLabel)}</span>
      ${bubbleHtml}
      ${workspaceActionHtml}
      ${filesHtml}
    `;

    if (msg.files && msg.files.length) {
      el.querySelectorAll<HTMLElement>(".file-tag[data-file-idx]").forEach((tagEl) => {
        const file = msg.files![Number(tagEl.dataset.fileIdx)];
        if (file) tagEl.addEventListener("click", () => openAbsoluteFileInEditor(file.path, file.name, file.content));
      });
    }

    // Offer "Datei aktualisieren" for model responses that follow a user message with attachments
    if (msg.role === "model" && !msg.pending && !msg.error) {
      const prevUser = chat.messages[idx - 1];
      if (prevUser && prevUser.role === "user" && prevUser.files && prevUser.files.length) {
        const actions = document.createElement("div");
        actions.className = "file-actions";
        for (const file of prevUser.files) {
          const btn = document.createElement("button");
          btn.className = "update-file-btn";
          btn.textContent = t.updateFileBtn(file.name);
          btn.addEventListener("click", async () => {
            try {
              const newContent = stripCodeFences(msg.text);
              await invoke("write_text_file", { path: file.path, content: newContent });
              btn.textContent = t.updatedFileBtn(file.name);
              btn.classList.add("done");
            } catch (err) {
              alert(t.updateFileError(String(err)));
            }
          });
          actions.appendChild(btn);
        }
        el.appendChild(actions);
      }
    }

    messagesEl.appendChild(el);

    if (msg.pending && msg.pendingStartedAt) {
      startPendingTimer(msg.pendingStartedAt);
    }
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateHeader() {
  const chat = activeChat();
  tokenUsageEl.textContent = t.tokens(chat?.totalTokens ?? 0);

  // Ältere Chats können noch ein inzwischen entferntes/deaktiviertes Modell (z. B. "gemini-2.5-flash")
  // referenzieren; auf das aktuelle Standardmodell migrieren, statt eine leere Auswahl anzuzeigen.
  if (chat && !MODEL_OPTIONS.some((o) => o.value === chat.model && !o.disabled)) {
    chat.model = DEFAULT_MODEL;
    persist();
  }
  modelSelectEl.value = chat?.model ?? DEFAULT_MODEL;

  const nearLimit = quota.count >= DAILY_REQUEST_LIMIT * 0.9;
  quotaUsageEl.textContent = t.requestsToday(quota.count, DAILY_REQUEST_LIMIT);
  quotaUsageEl.classList.toggle("warn", nearLimit);
}

function renderAttachments() {
  attachmentsEl.innerHTML = "";
  pendingAttachments.forEach((file, idx) => {
    const badge = document.createElement("div");
    badge.className = "attachment-badge";
    badge.innerHTML = `<span class="attachment-name" title="${t.openInEditorTitle}">📎 ${escapeHtml(file.name)}</span><button title="${t.removeAttachmentTitle}">✕</button>`;
    badge.querySelector(".attachment-name")!.addEventListener("click", () => {
      openAbsoluteFileInEditor(file.path, file.name, file.content);
    });
    badge.querySelector("button")!.addEventListener("click", (e) => {
      e.stopPropagation();
      pendingAttachments.splice(idx, 1);
      renderAttachments();
    });
    attachmentsEl.appendChild(badge);
  });
  pendingImages.forEach((img, idx) => {
    const badge = document.createElement("div");
    badge.className = "attachment-badge image-badge";
    badge.innerHTML = `<img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" class="attachment-thumb" /><button title="${t.removeImageTitle}">✕</button>`;
    badge.querySelector("button")!.addEventListener("click", (e) => {
      e.stopPropagation();
      pendingImages.splice(idx, 1);
      renderAttachments();
    });
    attachmentsEl.appendChild(badge);
  });
}

const MAX_IMAGE_WIDTH = 1024;
const IMAGE_JPEG_QUALITY = 0.7;

/** Downscales/compresses a pasted or dropped image client-side (max 1024px wide, JPEG q=0.7)
 * before it's ever sent to Gemini, so large screenshots don't blow up the request payload. */
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas-Kontext nicht verfügbar."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function addPendingImageFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  try {
    const dataUrl = await downscaleImage(file);
    pendingImages.push({ dataUrl, name: file.name || "image.jpg" });
    renderAttachments();
  } catch (err) {
    console.debug("Bild konnte nicht verarbeitet werden:", err);
  }
}

function renderWorkspaceBar() {
  const chat = activeChat();
  const path = chat?.workspacePath;
  workspacePathEl.textContent = path ?? t.noWorkspace;
  workspacePathEl.classList.toggle("linked", !!path);
  workspacePathEl.title = path ?? "";
  workspaceToggleBtnEl.classList.toggle("hidden", !path);
  workspaceDetachBtnEl.classList.toggle("hidden", !path);
  workspaceToggleBtnEl.title = workspaceFilesExpanded ? t.hideFilesTitle : t.showFilesTitle;
  workspaceToggleBtnEl.textContent = workspaceFilesExpanded ? "▴" : "▾";
  workspaceDetachBtnEl.title = t.detachWorkspaceTitle;
  workspacePickBtnEl.title = t.pickWorkspaceTitle;

  setEditorWorkspacePath(path ?? null);

  if (!path) {
    workspaceFilesEl.classList.add("hidden");
    workspaceFilesExpanded = false;
  }
}

async function renderWorkspaceFiles() {
  const chat = activeChat();
  if (!chat?.workspacePath) return;
  workspaceFilesEl.textContent = t.loadingFiles;
  try {
    const files = await listWorkspaceFiles(chat.workspacePath);
    workspaceFilesEl.innerHTML = files.length
      ? files.map((f) => `<div class="workspace-file-entry" data-path="${escapeHtml(f)}">${escapeHtml(f)}</div>`).join("")
      : `<div class="workspace-file-entry">${escapeHtml(t.emptyFolder)}</div>`;
    workspaceFilesEl.querySelectorAll<HTMLElement>(".workspace-file-entry[data-path]").forEach((el) => {
      el.addEventListener("click", () => openWorkspaceFileInEditor(el.dataset.path!));
    });
  } catch (err) {
    workspaceFilesEl.textContent = `${t.folderReadError}: ${err}`;
  }
}

/** Shows the one-time "autonomous file access" disclaimer before a workspace folder is linked or
 * the security mode is loosened, gating the accept button on the checkbox being ticked. Resolves
 * immediately with true if the disclaimer was already accepted in a previous session. */
function ensureWorkspaceDisclaimerAccepted(): Promise<boolean> {
  if (workspaceDisclaimerAccepted) return Promise.resolve(true);

  disclaimerTitleEl.textContent = t.disclaimerTitle;
  disclaimerTextEl.textContent = t.disclaimerText;
  disclaimerCheckboxLabelEl.textContent = t.disclaimerCheckboxLabel;
  disclaimerCancelEl.textContent = t.disclaimerCancel;
  disclaimerAcceptEl.textContent = t.disclaimerAccept;
  disclaimerCheckboxEl.checked = false;
  disclaimerAcceptEl.disabled = true;
  disclaimerModalEl.classList.remove("hidden");

  return new Promise((resolve) => {
    const onCheckboxChange = () => {
      disclaimerAcceptEl.disabled = !disclaimerCheckboxEl.checked;
    };
    const cleanup = () => {
      disclaimerModalEl.classList.add("hidden");
      disclaimerCheckboxEl.removeEventListener("change", onCheckboxChange);
      disclaimerAcceptEl.removeEventListener("click", onAccept);
      disclaimerCancelEl.removeEventListener("click", onCancel);
    };
    const onAccept = async () => {
      cleanup();
      workspaceDisclaimerAccepted = true;
      await saveWorkspaceDisclaimerAccepted();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    disclaimerCheckboxEl.addEventListener("change", onCheckboxChange);
    disclaimerAcceptEl.addEventListener("click", onAccept);
    disclaimerCancelEl.addEventListener("click", onCancel);
  });
}

async function pickWorkspace() {
  const chat = activeChat();
  if (!chat) return;
  if (!(await ensureWorkspaceDisclaimerAccepted())) return;
  const folder = await pickWorkspaceFolder();
  if (!folder) return;
  chat.workspacePath = folder;
  persist();
  renderWorkspaceBar();
  workspaceFilesExpanded = true;
  workspaceFilesEl.classList.remove("hidden");
  workspaceToggleBtnEl.textContent = "▴";
  await renderWorkspaceFiles();
}

function detachWorkspace() {
  const chat = activeChat();
  if (!chat) return;
  chat.workspacePath = undefined;
  persist();
  renderWorkspaceBar();
}

async function toggleWorkspaceFiles() {
  workspaceFilesExpanded = !workspaceFilesExpanded;
  workspaceFilesEl.classList.toggle("hidden", !workspaceFilesExpanded);
  workspaceToggleBtnEl.textContent = workspaceFilesExpanded ? "▴" : "▾";
  if (workspaceFilesExpanded) await renderWorkspaceFiles();
}

function selectChat(id: string) {
  activeChatId = id;
  renderChatList();
  renderMessages();
  updateHeader();
  renderWorkspaceBar();
}

function deleteChat(id: string) {
  chats = chats.filter((c) => c.id !== id);
  if (activeChatId === id) {
    activeChatId = chats[0]?.id ?? null;
    if (!activeChatId) createNewChat();
  }
  persist();
  renderChatList();
  renderMessages();
  updateHeader();
  renderWorkspaceBar();
}

function createNewChat() {
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: t.newChat,
    model: modelSelectEl.value || DEFAULT_MODEL,
    messages: [],
    createdAt: Date.now(),
    totalTokens: 0,
  };
  chats.push(chat);
  activeChatId = chat.id;
  persist();
  renderChatList();
  renderMessages();
  updateHeader();
  renderWorkspaceBar();
}

async function attachFiles() {
  const selected = await open({ multiple: true, title: t.attachFileDialogTitle });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const path of paths) {
    try {
      const result = await invoke<{ path: string; name: string; content: string }>(
        "read_text_file",
        { path }
      );
      pendingAttachments.push(result);
    } catch (err) {
      alert(t.readFileError(String(err)));
    }
  }
  renderAttachments();
}

function isInCooldown(): boolean {
  return Date.now() < cooldownUntil;
}

function startCooldown(seconds: number) {
  cooldownUntil = Date.now() + seconds * 1000;
  sendBtnEl.disabled = true;
  cooldownNoticeEl.classList.remove("hidden");

  const tick = () => {
    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = null;
      sendBtnEl.disabled = false;
      sendBtnEl.textContent = "➤";
      cooldownNoticeEl.classList.add("hidden");
      return;
    }
    sendBtnEl.textContent = `${remaining}s`;
    cooldownNoticeEl.textContent = t.cooldownNotice(remaining);
  };

  if (cooldownTimer) clearInterval(cooldownTimer);
  tick();
  cooldownTimer = setInterval(tick, 500);
}

function withinRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length < PER_MINUTE_REQUEST_LIMIT;
}

async function sendMessage() {
  const text = promptInputEl.value.trim();
  if (!text && pendingAttachments.length === 0 && pendingImages.length === 0) return;

  if (isInCooldown()) {
    // Server-seitiges Kontingent-Limit aktiv: keine automatischen oder manuellen Wiederholungsversuche zulassen.
    return;
  }

  if (!apiKey) {
    alert(t.needApiKey);
    openSettings();
    return;
  }

  if (quota.date === todayStr() && quota.count >= DAILY_REQUEST_LIMIT) {
    alert(t.dailyLimitReached);
    return;
  }

  if (!withinRateLimit()) {
    alert(t.rateLimitReached);
    return;
  }

  const chat = activeChat();
  if (!chat) return;

  const userMessage: ChatMessage = {
    role: "user",
    text,
    files: pendingAttachments.length ? [...pendingAttachments] : undefined,
    images: pendingImages.length ? [...pendingImages] : undefined,
  };
  chat.messages.push(userMessage);

  if (chat.title === t.newChat && text) {
    chat.title = text.slice(0, 40);
  }

  const pendingMessage: ChatMessage = { role: "model", text: "", pending: true, pendingStartedAt: Date.now() };
  chat.messages.push(pendingMessage);
  pendingStatusNote = "";

  pendingAttachments = [];
  pendingImages = [];
  promptInputEl.value = "";
  autoGrowTextarea();
  renderAttachments();
  renderChatList();
  renderMessages();

  requestTimestamps.push(Date.now());

  if (chat.workspacePath) setAllWorkspaceTabsLocked(true);

  try {
    let systemPrompt = settings.systemPrompt + buildLanguageSystemPromptAddition(settings.language);
    if (chat.workspacePath) {
      try {
        const files = await listWorkspaceFiles(chat.workspacePath);
        systemPrompt += buildWorkspaceSystemPromptAddition(files);
      } catch (err) {
        console.debug("Workspace-Dateiliste konnte nicht gelesen werden:", err);
      }
    }

    const contents = historyToContents(chat.messages.slice(0, -1));
    const fallbackModels = MODEL_OPTIONS.filter((o) => !o.disabled && o.value !== chat.model).map((o) => o.value);
    const result = await sendToGeminiWithRetry(
      apiKey,
      chat.model,
      systemPrompt,
      settings.safetyThreshold,
      contents,
      chat.workspacePath ? WORKSPACE_RESPONSE_SCHEMA : undefined,
      fallbackModels,
      (status) => {
        pendingStatusNote = status.isFallback
          ? t.modelOverloadedSwitching(status.model)
          : status.attempt > 1
            ? t.modelOverloadedRetrying(status.attempt, status.maxAttempts)
            : "";
      }
    );
    pendingStatusNote = "";

    if (chat.workspacePath) {
      const workspacePath = chat.workspacePath;
      const { reply, actions, createProject } = parseWorkspaceResponse(result.text);
      pendingMessage.text = reply;

      const results: WorkspaceActionResult[] = [];

      if (actions.length) {
        for (const cmd of actions) {
          if (actionRequiresApproval(cmd.action, settings.security)) {
            const approved = await requestApproval(cmd, workspacePath);
            if (!approved) {
              results.push({
                action: cmd.action,
                filename: cmd.filename,
                success: false,
                error: t.actionRejectedByUser,
              });
              continue;
            }
          }
          setTabAILock(cmd.filename, true);
          try {
            if (cmd.action === "delete") {
              await deleteWorkspaceFile(workspacePath, cmd.filename);
              removeTabIfOpen(cmd.filename);
            } else if (cmd.action === "edit" && cmd.edits && cmd.edits.length) {
              const outcomes = await applyWorkspaceEdits(workspacePath, cmd.filename, cmd.edits);
              const problem = outcomes.find((o) => o.status !== "SUCCESS_PRECISE");
              if (problem) {
                results.push({
                  action: cmd.action,
                  filename: cmd.filename,
                  success: false,
                  error: problem.status === "FUZZY_MATCH_NEEDED" ? t.editFuzzyMatch : t.editNotFound,
                });
                continue;
              }
              const newContent = await readWorkspaceFile(workspacePath, cmd.filename);
              updateTabContent(cmd.filename, newContent);
            } else {
              await writeWorkspaceFile(workspacePath, cmd.filename, cmd.content ?? "");
              updateTabContent(cmd.filename, cmd.content ?? "");
            }
            results.push({ action: cmd.action, filename: cmd.filename, success: true });
          } catch (err) {
            results.push({
              action: cmd.action,
              filename: cmd.filename,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          } finally {
            setTabAILock(cmd.filename, false);
          }
        }
      }

      if (createProject && createProject.files.length) {
        let approved = true;
        if (actionRequiresApproval("create", settings.security)) {
          approved = await requestBatchCreateApproval(createProject.rootFolder, createProject.files);
        }
        if (!approved) {
          results.push({
            action: "create_project",
            filename: createProject.rootFolder,
            success: false,
            error: t.actionRejectedByUser,
          });
        } else {
          try {
            await createWorkspaceProject(workspacePath, createProject.rootFolder, createProject.files);
            results.push({
              action: "create_project",
              filename: t.fileCreatedProject(createProject.rootFolder, createProject.files.length),
              success: true,
            });
          } catch (err) {
            results.push({
              action: "create_project",
              filename: createProject.rootFolder,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (results.length) {
        pendingMessage.workspaceActions = results;
        if (workspaceFilesExpanded) await renderWorkspaceFiles();
      }
    } else {
      pendingMessage.text = result.text;
    }

    pendingMessage.pending = false;
    pendingMessage.usage = {
      promptTokens: result.promptTokens,
      candidatesTokens: result.candidatesTokens,
    };
    chat.totalTokens += result.promptTokens + result.candidatesTokens;

    if (quota.date !== todayStr()) {
      quota = { date: todayStr(), count: 0 };
    }
    quota.count += 1;
    await saveQuota(quota);
  } catch (err) {
    pendingMessage.pending = false;
    pendingMessage.error = true;
    pendingMessage.text = t.errorPrefix(String(err instanceof Error ? err.message : err));

    if (err instanceof GeminiApiError && err.status === 429) {
      startCooldown(err.retryAfterSeconds ?? 40);
    }
  } finally {
    if (chat.workspacePath) setAllWorkspaceTabsLocked(false);
  }

  persist();
  renderMessages();
  updateHeader();
}

function autoGrowTextarea() {
  promptInputEl.style.height = "auto";
  promptInputEl.style.height = `${Math.min(promptInputEl.scrollHeight, 200)}px`;
}

// ---- Settings modal ----
function updateSecurityCheckboxesDisabled() {
  const mode = securityModeSelectEl.value as SecurityMode;
  const editable = mode === "partial";
  approvalCreateEl.disabled = !editable;
  approvalEditEl.disabled = !editable;
  approvalDeleteEl.disabled = !editable;
  if (mode === "always") {
    approvalCreateEl.checked = true;
    approvalEditEl.checked = true;
    approvalDeleteEl.checked = true;
  } else if (mode === "none") {
    approvalCreateEl.checked = false;
    approvalEditEl.checked = false;
    approvalDeleteEl.checked = false;
  }
}

function openSettings() {
  apiKeyInputEl.value = apiKey ?? "";
  systemPromptInputEl.value = settings.systemPrompt;
  safetySelectEl.value = settings.safetyThreshold;
  const security = settings.security ?? DEFAULT_SECURITY_SETTINGS;
  securityModeSelectEl.value = security.mode;
  approvalCreateEl.checked = security.requireApprovalFor.create;
  approvalEditEl.checked = security.requireApprovalFor.edit;
  approvalDeleteEl.checked = security.requireApprovalFor.delete;
  updateSecurityCheckboxesDisabled();
  settingsModalEl.classList.remove("hidden");
  apiKeyDetectedNoteEl.classList.add("hidden");

  // Only polls the clipboard while the settings modal (and thus the key field) is actually open.
  startClipboardPolling(async (detectedKey) => {
    apiKeyInputEl.value = detectedKey;
    apiKeyDetectedNoteEl.classList.remove("hidden");
    apiKey = detectedKey;
    await saveApiKey(detectedKey);
  });
}

function closeSettings() {
  settingsModalEl.classList.add("hidden");
  stopClipboardPolling();
}

async function openGoogleAIStudioKeyPage() {
  try {
    await openUrl("https://aistudio.google.com/apikey");
  } catch (err) {
    alert(t.openLinkError(String(err)));
  }
}

async function saveSettingsFromModal() {
  const newKey = apiKeyInputEl.value.trim();
  if (newKey !== (apiKey ?? "")) {
    await saveApiKey(newKey);
    apiKey = newKey || null;
  }
  let mode = securityModeSelectEl.value as SecurityMode;
  if (mode !== "always" && mode !== settings.security.mode) {
    if (!(await ensureWorkspaceDisclaimerAccepted())) {
      mode = settings.security.mode;
      securityModeSelectEl.value = mode;
    }
  }
  settings = {
    ...settings,
    systemPrompt: systemPromptInputEl.value,
    safetyThreshold: safetySelectEl.value,
    security: {
      mode,
      requireApprovalFor: {
        create: approvalCreateEl.checked,
        edit: approvalEditEl.checked,
        delete: approvalDeleteEl.checked,
      },
    },
  };
  await saveSettings(settings);
  closeSettings();
}

// ---- Language ----
async function setAppLanguage(lang: Language) {
  settings.language = lang;
  setLanguage(lang);
  langDeBtnEl.classList.toggle("active", lang === "de");
  langEnBtnEl.classList.toggle("active", lang === "en");
  applyStaticTranslations();
  updateHeader();
  renderWorkspaceBar();
  renderChatList();
  renderMessages();
  await saveSettings(settings);
}

function applyStaticTranslations() {
  document.getElementById("new-chat-label")!.textContent = t.newChat;
  document.getElementById("settings-label")!.textContent = t.settings;
  settingsBtnEl.title = t.settings;
  attachBtnEl.title = t.attachFileTitle;
  sendBtnEl.title = t.sendTitle;
  promptInputEl.placeholder = t.promptPlaceholder;
  document.getElementById("patchnotes-title")!.textContent = t.patchNotesTitle;
  patchnotesCloseEl.title = t.patchNotesClose;
  document.getElementById("editor-empty")!.textContent = t.openEditorEmpty;

  document.getElementById("settings-title")!.textContent = t.settingsTitle;
  document.getElementById("api-key-label")!.textContent = t.apiKeyLabel;
  document.getElementById("api-key-hint")!.textContent = t.apiKeyHint;
  getApiKeyBtnEl.textContent = t.getApiKeyBtn;
  apiKeyDetectedNoteEl.textContent = t.apiKeyDetectedNote;
  document.getElementById("system-prompt-label")!.textContent = t.systemPromptLabel;
  document.getElementById("safety-label")!.textContent = t.safetyLabel;
  settingsSaveEl.textContent = t.save;

  const safetySelect = safetySelectEl;
  if (safetySelect.options.length >= 4) {
    safetySelect.options[0].textContent = t.safetyNone;
    safetySelect.options[1].textContent = t.safetyHigh;
    safetySelect.options[2].textContent = t.safetyMedium;
    safetySelect.options[3].textContent = t.safetyLow;
  }

  document.getElementById("security-section-label")!.textContent = t.securitySectionLabel;
  document.getElementById("security-mode-hint")!.textContent = t.securityModeHint;
  if (securityModeSelectEl.options.length >= 3) {
    securityModeSelectEl.options[0].textContent = t.securityModeAlways;
    securityModeSelectEl.options[1].textContent = t.securityModePartial;
    securityModeSelectEl.options[2].textContent = t.securityModeNone;
  }
  document.getElementById("approval-create-label")!.textContent = t.approvalCreateLabel;
  document.getElementById("approval-edit-label")!.textContent = t.approvalEditLabel;
  document.getElementById("approval-delete-label")!.textContent = t.approvalDeleteLabel;
  document.getElementById("approval-delete-cancel")!.textContent = t.approvalCancel;
  document.getElementById("approval-delete-confirm")!.textContent = t.approvalConfirmDelete;
  document.getElementById("approval-diff-discard")!.textContent = t.approvalDiscard;
  document.getElementById("approval-diff-accept")!.textContent = t.approvalAccept;
}

// ---- Patch notes ----
function renderPatchNotes() {
  const lang = getLanguage();
  patchnotesBodyEl.innerHTML = PATCH_NOTES.map(
    (entry) => `
      <div class="patchnotes-entry">
        <h3>v${entry.version}</h3>
        <ul>${(lang === "en" ? entry.en : entry.de).map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
      </div>
    `
  ).join("");
}

function openPatchNotes() {
  renderPatchNotes();
  patchnotesModalEl.classList.remove("hidden");
}

function closePatchNotes() {
  patchnotesModalEl.classList.add("hidden");
}

// ---- Init ----
async function init() {
  populateModelSelect();
  initEditor();

  settings = await loadSettings();
  setLanguage(settings.language);
  langDeBtnEl.classList.toggle("active", settings.language === "de");
  langEnBtnEl.classList.toggle("active", settings.language === "en");
  applyStaticTranslations();

  apiKey = await loadApiKey();
  workspaceDisclaimerAccepted = await loadWorkspaceDisclaimerAccepted();
  chats = await loadChats();
  quota = await loadQuota();
  if (quota.date !== todayStr()) {
    quota = { date: todayStr(), count: 0 };
  }

  if (chats.length === 0) {
    createNewChat();
  } else {
    activeChatId = [...chats].sort((a, b) => b.createdAt - a.createdAt)[0].id;
  }

  renderChatList();
  renderMessages();
  updateHeader();
  renderWorkspaceBar();

  newChatBtnEl.addEventListener("click", createNewChat);
  workspacePickBtnEl.addEventListener("click", pickWorkspace);
  workspaceDetachBtnEl.addEventListener("click", detachWorkspace);
  workspaceToggleBtnEl.addEventListener("click", toggleWorkspaceFiles);
  attachBtnEl.addEventListener("click", attachFiles);
  sendBtnEl.addEventListener("click", sendMessage);
  promptInputEl.addEventListener("input", autoGrowTextarea);
  promptInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  promptInputEl.addEventListener("paste", (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          addPendingImageFile(file);
        }
      }
    }
  });
  promptInputEl.addEventListener("dragover", (e) => e.preventDefault());
  promptInputEl.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    const hasImage = Array.from(files).some((f) => f.type.startsWith("image/"));
    if (!hasImage) return;
    e.preventDefault();
    Array.from(files).forEach((f) => addPendingImageFile(f));
  });

  modelSelectEl.addEventListener("change", () => {
    const chat = activeChat();
    if (chat) {
      chat.model = modelSelectEl.value;
      persist();
    }
  });

  settingsBtnEl.addEventListener("click", openSettings);
  settingsCloseEl.addEventListener("click", closeSettings);
  settingsSaveEl.addEventListener("click", saveSettingsFromModal);
  settingsModalEl.addEventListener("click", (e) => {
    if (e.target === settingsModalEl) closeSettings();
  });
  getApiKeyBtnEl.addEventListener("click", openGoogleAIStudioKeyPage);
  securityModeSelectEl.addEventListener("change", updateSecurityCheckboxesDisabled);

  langDeBtnEl.addEventListener("click", () => setAppLanguage("de"));
  langEnBtnEl.addEventListener("click", () => setAppLanguage("en"));

  titlebarVersionEl.addEventListener("click", openPatchNotes);
  patchnotesCloseEl.addEventListener("click", closePatchNotes);
  patchnotesModalEl.addEventListener("click", (e) => {
    if (e.target === patchnotesModalEl) closePatchNotes();
  });

  checkForUpdates();
  initTitlebar();

  try {
    appVersion = await getAppVersion();
    const lastSeenVersion = await loadLastSeenVersion();
    if (lastSeenVersion !== appVersion) {
      openPatchNotes();
      await saveLastSeenVersion(appVersion);
    }
  } catch (err) {
    console.debug("Versionsvergleich für Patch Notes fehlgeschlagen:", err);
  }
}

init();
