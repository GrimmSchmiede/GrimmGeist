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
  loadPaidApiKey,
  savePaidApiKey,
  loadLastSeenVersion,
  saveLastSeenVersion,
  loadWorkspaceDisclaimerAccepted,
  saveWorkspaceDisclaimerAccepted,
} from "./storage";
import {
  ApiKeyCandidate,
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
  restoreWorkspaceBackup,
  writeWorkspaceFile,
} from "./workspace";
import { t, setLanguage, getLanguage } from "./i18n";
import { PATCH_NOTES } from "./patchnotes";
import {
  getActiveWorkspaceTabPath,
  getDirtyActiveTabContent,
  initEditor,
  markTabSaved,
  openAbsoluteFileInEditor,
  openWorkspaceFileInEditor,
  removeTabIfOpen,
  setAllWorkspaceTabsLocked,
  setTabAILock,
  setWorkspacePath as setEditorWorkspacePath,
  updateTabContent,
} from "./editor";
import { requestApproval, requestBatchCreateApproval, requestConflictResolution } from "./approval";
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
  GitStatus,
  actionRequiresApproval,
  buildLanguageSystemPromptAddition,
  buildWorkspaceSystemPromptAddition,
} from "./types";

// ---- State ----
let chats: Chat[] = [];
let activeChatId: string | null = null;
let settings: AppSettings;
let apiKey: string | null = null;
let paidApiKey: string | null = null;
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
const gitPushBtnEl = document.getElementById("git-push-btn")!;
const gitPushModalEl = document.getElementById("git-push-modal")!;
const gitPushTitleEl = document.getElementById("git-push-title")!;
const gitPushBranchEl = document.getElementById("git-push-branch")!;
const gitPushChangedFilesEl = document.getElementById("git-push-changed-files")!;
const gitPushMessageEl = document.getElementById("git-push-message") as HTMLTextAreaElement;
const gitPushErrorEl = document.getElementById("git-push-error")!;
const gitPushCancelEl = document.getElementById("git-push-cancel") as HTMLButtonElement;
const gitPushConfirmEl = document.getElementById("git-push-confirm") as HTMLButtonElement;
const gitPushCloseEl = document.getElementById("git-push-close")!;

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
const paidApiKeyInputEl = document.getElementById("paid-api-key-input") as HTMLInputElement;
const keyPrioritySelectEl = document.getElementById("key-priority-select") as HTMLSelectElement;
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
    if (chat.frozenAtIndex != null && idx === chat.frozenAtIndex) {
      const divider = document.createElement("div");
      divider.className = "frozen-history-divider";
      divider.innerHTML = `<span>${escapeHtml(t.frozenDividerLabel)}</span><button class="unfreeze-btn">${escapeHtml(t.unfreezeTitle)}</button>`;
      divider.querySelector(".unfreeze-btn")!.addEventListener("click", () => {
        chat.frozenAtIndex = null;
        persist();
        renderMessages();
      });
      messagesEl.appendChild(divider);
    }

    const el = document.createElement("div");
    el.className = `message ${msg.role}` + (msg.pending ? " pending" : "") + (msg.error ? " error" : "");

    const roleLabel = msg.role === "user" ? t.you : "GrimmGeist";
    const freezeHtml =
      !msg.pending && (chat.frozenAtIndex == null || idx < chat.frozenAtIndex)
        ? `<button class="freeze-btn" data-idx="${idx}" title="${escapeHtml(t.freezeFromHereTitle)}">🔒</button>`
        : "";
    const fallbackBadgeHtml = msg.servedByModel
      ? `<span class="model-fallback-badge" title="${escapeHtml(t.fallbackModelUsed(msg.servedByModel))}">⚡ ${escapeHtml(msg.servedByModel)}</span>`
      : "";
    const paidKeyBadgeHtml = msg.servedByPaidKey
      ? `<span class="paid-key-badge" title="${escapeHtml(t.paidKeyUsed)}">💲 ${escapeHtml(t.paidKeyBadgeLabel)}</span>`
      : "";
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
        .map((wa, waIdx) => {
          if (wa.success && wa.action === "create_project") {
            return `<div class="workspace-action-note success">${escapeHtml(wa.filename)}</div>`;
          }
          if (!wa.success) {
            const failedNote = `<div class="workspace-action-note failed">${escapeHtml(t.actionFailed(wa.action, wa.filename, wa.error ?? ""))}</div>`;
            if (wa.fuzzySuggestion && !wa.fuzzyResolved) {
              const s = wa.fuzzySuggestion;
              return (
                failedNote +
                `<div class="fuzzy-suggestion">
                  <div class="fuzzy-suggestion-title">${escapeHtml(t.fuzzySuggestionTitle(s.matchedLine))}</div>
                  <pre class="fuzzy-suggestion-code">${escapeHtml(s.matchedText)}</pre>
                  <button class="fuzzy-suggestion-apply" data-msg-idx="${idx}" data-wa-idx="${waIdx}">${escapeHtml(t.applySuggestion)}</button>
                </div>`
              );
            }
            return failedNote;
          }
          const undoable = wa.action !== "create_project" && (wa.backup || wa.action === "create");
          const undoHtml = wa.undone
            ? `<span class="workspace-action-undone">${escapeHtml(t.undoneLabel)}</span>`
            : undoable
              ? `<button class="workspace-action-undo" data-msg-idx="${idx}" data-wa-idx="${waIdx}" title="${escapeHtml(t.undoAction)}">↺ ${escapeHtml(t.undoAction)}</button>`
              : "";
          return `<div class="workspace-action-note success">${escapeHtml(actionLabel[wa.action])}: ${escapeHtml(wa.filename)}${undoHtml}</div>`;
        })
        .join("");
    }

    el.innerHTML = `
      <span class="role-label">${escapeHtml(roleLabel)}</span>${fallbackBadgeHtml}${paidKeyBadgeHtml}${freezeHtml}
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

    el.querySelectorAll<HTMLButtonElement>(".workspace-action-undo").forEach((btn) => {
      btn.addEventListener("click", () => undoWorkspaceAction(Number(btn.dataset.msgIdx), Number(btn.dataset.waIdx)));
    });

    el.querySelectorAll<HTMLButtonElement>(".fuzzy-suggestion-apply").forEach((btn) => {
      btn.addEventListener("click", () => applyFuzzySuggestion(Number(btn.dataset.msgIdx), Number(btn.dataset.waIdx)));
    });

    el.querySelectorAll<HTMLButtonElement>(".freeze-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chat.frozenAtIndex = Number(btn.dataset.idx);
        persist();
        renderMessages();
      });
    });

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
  gitPushBtnEl.title = t.gitPushBtnTitle;

  setEditorWorkspacePath(path ?? null);

  if (!path) {
    workspaceFilesEl.classList.add("hidden");
    workspaceFilesExpanded = false;
    gitPushBtnEl.classList.add("hidden");
  } else {
    updateGitPushButtonVisibility(path);
  }
}

async function updateGitPushButtonVisibility(workspace: string) {
  try {
    const status = await invoke<GitStatus>("git_status", { workspace });
    // Guard against the workspace having changed again while this call was in flight.
    if (activeChat()?.workspacePath !== workspace) return;
    gitPushBtnEl.classList.toggle("hidden", !status.isGitRepo);
  } catch {
    gitPushBtnEl.classList.add("hidden");
  }
}

async function openGitPushModal() {
  const workspace = activeChat()?.workspacePath;
  if (!workspace) return;
  gitPushTitleEl.textContent = t.gitPushTitle;
  gitPushCancelEl.textContent = t.gitPushCancel;
  gitPushConfirmEl.textContent = t.gitPushConfirm;
  gitPushMessageEl.placeholder = t.gitPushMessagePlaceholder;
  gitPushMessageEl.value = "";
  gitPushErrorEl.classList.add("hidden");
  gitPushConfirmEl.disabled = true;
  gitPushBranchEl.textContent = "";
  gitPushChangedFilesEl.innerHTML = "";
  gitPushModalEl.classList.remove("hidden");

  try {
    const status = await invoke<GitStatus>("git_status", { workspace });
    if (!status.isGitRepo || status.changedFiles.length === 0) {
      gitPushErrorEl.textContent = t.gitPushNoChanges;
      gitPushErrorEl.classList.remove("hidden");
      return;
    }
    gitPushBranchEl.textContent = t.gitPushBranch(status.branch);
    gitPushChangedFilesEl.innerHTML = "";
    for (const line of status.changedFiles) {
      const li = document.createElement("li");
      li.textContent = line;
      gitPushChangedFilesEl.appendChild(li);
    }
    const countLabel = document.createElement("p");
    countLabel.className = "git-push-changed-count";
    countLabel.textContent = t.gitPushChangedFiles(status.changedFiles.length);
    gitPushChangedFilesEl.before(countLabel);
    gitPushConfirmEl.disabled = false;
    gitPushMessageEl.focus();
  } catch (err) {
    gitPushErrorEl.textContent = t.gitPushError(String(err));
    gitPushErrorEl.classList.remove("hidden");
  }
}

function closeGitPushModal() {
  gitPushModalEl.classList.add("hidden");
}

async function confirmGitPush() {
  const workspace = activeChat()?.workspacePath;
  if (!workspace) return;
  const message = gitPushMessageEl.value.trim();
  if (!message) {
    gitPushErrorEl.textContent = t.gitPushNoChanges;
    gitPushErrorEl.classList.remove("hidden");
    return;
  }
  gitPushErrorEl.classList.add("hidden");
  gitPushConfirmEl.disabled = true;
  gitPushConfirmEl.textContent = t.gitPushPending;
  try {
    await invoke("git_commit_and_push", { workspace, message });
    closeGitPushModal();
  } catch (err) {
    gitPushErrorEl.textContent = t.gitPushError(String(err));
    gitPushErrorEl.classList.remove("hidden");
    gitPushConfirmEl.disabled = false;
    gitPushConfirmEl.textContent = t.gitPushConfirm;
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

interface EditRetryResult {
  success: boolean;
  backup?: string;
  usedPaidKey?: boolean;
}

/** When a precise edit's "search" text doesn't match the actual file (stale/guessed context from
 * the model), automatically asks Gemini to correct itself using the REAL current file content
 * before giving up - instead of leaving the user with a chat reply that confidently claims the
 * edit succeeded while the file was never touched. One retry only, to keep cost/latency bounded. */
async function retryFailedEditWithActualContent(
  workspacePath: string,
  filename: string,
  failedEdit: { search: string; replace: string },
  failureReason: string,
  model: string,
  systemPrompt: string,
  safetyThreshold: string,
  apiKeys: ApiKeyCandidate[],
  fallbackModels: string[]
): Promise<EditRetryResult> {
  try {
    const actualContent = await readWorkspaceFile(workspacePath, filename);
    const retryPrompt =
      `Eine vorherige präzise Änderung an der Datei "${filename}" ist fehlgeschlagen: ${failureReason}\n\n` +
      `Gesuchter Text (hat nicht exakt gepasst):\n---\n${failedEdit.search}\n---\n\n` +
      `Beabsichtigter Ersetzungstext:\n---\n${failedEdit.replace}\n---\n\n` +
      `Hier ist der TATSÄCHLICHE aktuelle Inhalt von "${filename}":\n---\n${actualContent}\n---\n\n` +
      `Liefere eine korrigierte "edit"-Aktion NUR für "${filename}" mit einem "search"-Text, der ` +
      `WORTWÖRTLICH (exakt wie oben gezeigt) im aktuellen Inhalt vorkommt, um die ursprünglich ` +
      `beabsichtigte Änderung korrekt umzusetzen.`;

    const result = await sendToGeminiWithRetry(
      apiKeys,
      model,
      systemPrompt,
      safetyThreshold,
      [{ role: "user", parts: [{ text: retryPrompt }] }],
      WORKSPACE_RESPONSE_SCHEMA,
      fallbackModels
    );

    const { actions } = parseWorkspaceResponse(result.text);
    const fixedAction = actions.find((a) => a.action === "edit" && a.filename === filename && a.edits?.length);
    if (!fixedAction?.edits) return { success: false };

    const { outcomes, backup } = await applyWorkspaceEdits(workspacePath, filename, fixedAction.edits);
    if (outcomes.some((o) => o.status !== "SUCCESS_PRECISE")) return { success: false };

    return { success: true, backup: backup ?? undefined, usedPaidKey: result.usedPaidKey };
  } catch {
    return { success: false };
  }
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

  if (settings.keyPriority === "payOnly" && !paidApiKey) {
    alert(t.needPaidApiKey);
    openSettings();
    return;
  }

  const apiKeyCandidates: ApiKeyCandidate[] =
    settings.keyPriority === "payOnly"
      ? [{ apiKey: paidApiKey!, isPaid: true }]
      : settings.keyPriority === "freeThenPay" && paidApiKey
        ? [{ apiKey, isPaid: false }, { apiKey: paidApiKey, isPaid: true }]
        : [{ apiKey, isPaid: false }];

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
      const workspacePath = chat.workspacePath;
      try {
        const files = await listWorkspaceFiles(workspacePath);
        systemPrompt += buildWorkspaceSystemPromptAddition(files);

        // Proactively inject the real current content of files the AI is likely about to edit
        // (the open editor tab, or any file explicitly named in the message) - without this, the
        // AI only has the bare file list and has to guess/remember content from earlier chat
        // turns, which is exactly what caused repeated, only-partially-correct edit attempts.
        const activeTabPath = getActiveWorkspaceTabPath();
        const mentionedPaths = files.filter((f) => {
          const base = f.split("/").pop();
          return base && base.length > 3 && text.toLowerCase().includes(base.toLowerCase());
        });
        const candidatePaths = [...new Set([activeTabPath, ...mentionedPaths].filter((p): p is string => !!p))].slice(0, 3);

        const fileBlocks: string[] = [];
        for (const relPath of candidatePaths) {
          try {
            const content = await readWorkspaceFile(workspacePath, relPath);
            if (content.length <= 20_000) {
              fileBlocks.push(`### ${relPath} ###\n${content}`);
            }
          } catch (err) {
            console.debug(`Datei für Kontext-Injektion konnte nicht gelesen werden (${relPath}):`, err);
          }
        }
        if (fileBlocks.length) {
          systemPrompt +=
            "\n\nAKTUELLER INHALT relevanter Dateien (aus dem geöffneten Editor-Tab bzw. im Nutzertext " +
            "genannt) - nutze GENAU diesen Text als Grundlage für 'search'/'content', nicht dein " +
            "Gedächtnis früherer Chat-Antworten:\n\n" +
            fileBlocks.join("\n\n");
        } else {
          systemPrompt +=
            "\n\nHINWEIS: Für keine Datei liegt dir aktuell garantiert der echte Inhalt vor. Wenn du " +
            "nicht mit hoher Sicherheit weißt, welche Datei gemeint ist und was genau darin steht, " +
            "frage im 'reply'-Feld nach dem Dateinamen (oder bitte den Nutzer, die Datei im " +
            "Live-Editor zu öffnen), statt eine 'edit'-Aktion mit geratenem Inhalt zu liefern.";
        }
      } catch (err) {
        console.debug("Workspace-Dateiliste konnte nicht gelesen werden:", err);
      }
    }

    const historyWithoutPending = chat.messages.slice(0, -1);
    const historyForRequest =
      chat.frozenAtIndex != null ? historyWithoutPending.slice(chat.frozenAtIndex) : historyWithoutPending;
    const contents = historyToContents(historyForRequest);
    const fallbackModels = MODEL_OPTIONS.filter((o) => !o.disabled && o.value !== chat.model).map((o) => o.value);
    const result = await sendToGeminiWithRetry(
      apiKeyCandidates,
      chat.model,
      systemPrompt,
      settings.safetyThreshold,
      contents,
      chat.workspacePath ? WORKSPACE_RESPONSE_SCHEMA : undefined,
      fallbackModels,
      (status) => {
        pendingStatusNote = status.usingPaidKey && status.reason === "quota"
          ? t.switchingToPaidKey
          : status.isFallback
            ? status.reason === "quota"
              ? t.modelQuotaSwitching(status.model)
              : t.modelOverloadedSwitching(status.model)
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
            let backup: string | undefined;
            if (cmd.action === "delete") {
              backup = (await deleteWorkspaceFile(workspacePath, cmd.filename)) ?? undefined;
              removeTabIfOpen(cmd.filename);
            } else if (cmd.action === "edit" && cmd.edits && cmd.edits.length) {
              const { outcomes, backup: editBackup } = await applyWorkspaceEdits(workspacePath, cmd.filename, cmd.edits);
              const problemIndex = outcomes.findIndex((o) => o.status !== "SUCCESS_PRECISE");
              if (problemIndex !== -1) {
                const problem = outcomes[problemIndex];
                const originalEdit = cmd.edits[problemIndex];
                const failureReason = problem.status === "FUZZY_MATCH_NEEDED" ? t.editFuzzyMatch : t.editNotFound;

                pendingStatusNote = t.retryingFailedEdit;
                const retry = await retryFailedEditWithActualContent(
                  workspacePath,
                  cmd.filename,
                  originalEdit,
                  failureReason,
                  chat.model,
                  systemPrompt,
                  settings.safetyThreshold,
                  apiKeyCandidates,
                  fallbackModels
                );
                pendingStatusNote = "";

                if (retry.success) {
                  const newContent = await readWorkspaceFile(workspacePath, cmd.filename);
                  await resolveTabUpdate(workspacePath, cmd.filename, newContent);
                  if (retry.usedPaidKey) pendingMessage.servedByPaidKey = true;
                  results.push({ action: cmd.action, filename: cmd.filename, success: true, backup: retry.backup });
                } else {
                  results.push({
                    action: cmd.action,
                    filename: cmd.filename,
                    success: false,
                    error: failureReason,
                    fuzzySuggestion:
                      problem.status === "FUZZY_MATCH_NEEDED" && problem.matchedLine !== undefined && problem.matchedText !== undefined
                        ? { matchedLine: problem.matchedLine, matchedText: problem.matchedText, replace: originalEdit.replace }
                        : undefined,
                  });
                }
                continue;
              }
              backup = editBackup ?? undefined;
              const newContent = await readWorkspaceFile(workspacePath, cmd.filename);
              await resolveTabUpdate(workspacePath, cmd.filename, newContent);
            } else {
              const writeResult = await writeWorkspaceFile(workspacePath, cmd.filename, cmd.content ?? "");
              backup = writeResult.backup ?? undefined;
              await resolveTabUpdate(workspacePath, cmd.filename, cmd.content ?? "");
            }
            results.push({ action: cmd.action, filename: cmd.filename, success: true, backup });
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

    if (result.model !== chat.model) {
      pendingMessage.servedByModel = result.model;
    }
    if (result.usedPaidKey) {
      pendingMessage.servedByPaidKey = true;
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

/** Applies the AI's new content to an open editor tab - unless that tab is the active one AND has
 * unsaved local edits, in which case blindly overwriting it would silently lose the user's work.
 * In that case, shows a diff and lets the user pick which version wins: their unsaved edits (kept
 * and re-saved over the AI's write) or the AI's version (local edits discarded). */
async function resolveTabUpdate(workspacePath: string, filename: string, newContent: string): Promise<void> {
  const dirtyContent = getDirtyActiveTabContent(filename);
  if (dirtyContent === null) {
    updateTabContent(filename, newContent);
    return;
  }
  const choice = await requestConflictResolution(filename, dirtyContent, newContent);
  if (choice === "mine") {
    await writeWorkspaceFile(workspacePath, filename, dirtyContent);
    markTabSaved(filename, dirtyContent);
  } else {
    updateTabContent(filename, newContent);
  }
}

/** Undoes a single workspace action (create/edit/delete) using the backup snapshot taken right
 * before it ran. "Create" actions without a backup (genuinely new file, nothing existed before)
 * are undone by deleting the file instead of restoring anything. */
async function undoWorkspaceAction(msgIdx: number, waIdx: number) {
  const chat = activeChat();
  if (!chat?.workspacePath) return;
  const msg = chat.messages[msgIdx];
  const wa = msg?.workspaceActions?.[waIdx];
  if (!wa || wa.undone) return;
  const workspacePath = chat.workspacePath;

  try {
    setTabAILock(wa.filename, true);
    if (wa.backup) {
      await restoreWorkspaceBackup(workspacePath, wa.filename, wa.backup);
      const content = await readWorkspaceFile(workspacePath, wa.filename);
      updateTabContent(wa.filename, content);
    } else if (wa.action === "create") {
      await deleteWorkspaceFile(workspacePath, wa.filename);
      removeTabIfOpen(wa.filename);
    } else {
      return;
    }
    wa.undone = true;
    persist();
    renderMessages();
    if (workspaceFilesExpanded) await renderWorkspaceFiles();
  } catch (err) {
    alert(t.undoError(err instanceof Error ? err.message : String(err)));
  } finally {
    setTabAILock(wa.filename, false);
  }
}

/** Applies a fuzzy-match "did you mean this?" suggestion for a failed edit: writes the exact
 * located text (guaranteed to match now, since it was just read from disk) with the AI's
 * original replacement, respecting the same approval gate a normal edit would. */
async function applyFuzzySuggestion(msgIdx: number, waIdx: number) {
  const chat = activeChat();
  if (!chat?.workspacePath) return;
  const msg = chat.messages[msgIdx];
  const wa = msg?.workspaceActions?.[waIdx];
  if (!wa || !wa.fuzzySuggestion || wa.fuzzyResolved) return;
  const workspacePath = chat.workspacePath;
  const suggestion = wa.fuzzySuggestion;
  const edits = [{ search: suggestion.matchedText, replace: suggestion.replace }];

  if (actionRequiresApproval("edit", settings.security)) {
    const approved = await requestApproval({ action: "edit", filename: wa.filename, edits }, workspacePath);
    if (!approved) return;
  }

  try {
    setTabAILock(wa.filename, true);
    const { outcomes, backup } = await applyWorkspaceEdits(workspacePath, wa.filename, edits);
    if (outcomes[0]?.status !== "SUCCESS_PRECISE") {
      alert(t.undoError(t.editFuzzyMatch));
      return;
    }
    const content = await readWorkspaceFile(workspacePath, wa.filename);
    updateTabContent(wa.filename, content);
    wa.fuzzyResolved = true;
    wa.success = true;
    wa.backup = backup ?? undefined;
    persist();
    renderMessages();
    if (workspaceFilesExpanded) await renderWorkspaceFiles();
  } catch (err) {
    alert(t.undoError(err instanceof Error ? err.message : String(err)));
  } finally {
    setTabAILock(wa.filename, false);
  }
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
  paidApiKeyInputEl.value = paidApiKey ?? "";
  keyPrioritySelectEl.value = settings.keyPriority;
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
  const newPaidKey = paidApiKeyInputEl.value.trim();
  if (newPaidKey !== (paidApiKey ?? "")) {
    await savePaidApiKey(newPaidKey);
    paidApiKey = newPaidKey || null;
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
    keyPriority: keyPrioritySelectEl.value as AppSettings["keyPriority"],
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
  document.getElementById("paid-api-key-label")!.textContent = t.paidApiKeyLabel;
  document.getElementById("paid-api-key-hint")!.textContent = t.paidApiKeyHint;
  document.getElementById("key-priority-label")!.textContent = t.keyPriorityLabel;
  document.getElementById("key-priority-hint")!.textContent = t.keyPriorityHint;
  if (keyPrioritySelectEl.options.length >= 3) {
    keyPrioritySelectEl.options[0].textContent = t.keyPriorityFreeOnly;
    keyPrioritySelectEl.options[1].textContent = t.keyPriorityFreeThenPay;
    keyPrioritySelectEl.options[2].textContent = t.keyPriorityPayOnly;
  }
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
  paidApiKey = await loadPaidApiKey();
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
  gitPushBtnEl.addEventListener("click", openGitPushModal);
  gitPushCancelEl.addEventListener("click", closeGitPushModal);
  gitPushCloseEl.addEventListener("click", closeGitPushModal);
  gitPushConfirmEl.addEventListener("click", confirmGitPush);
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
