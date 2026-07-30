import * as monaco from "monaco-editor";
import { getLanguageFromExtension } from "./editor";
import { readWorkspaceFile, WorkspaceCommand, applyEditsToContent, ProjectFile } from "./workspace";
import { t } from "./i18n";

const modalEl = document.getElementById("approval-modal")!;
const deleteViewEl = document.getElementById("approval-delete-view")!;
const deleteMessageEl = document.getElementById("approval-delete-message")!;
const deleteConfirmBtnEl = document.getElementById("approval-delete-confirm")!;
const deleteCancelBtnEl = document.getElementById("approval-delete-cancel")!;
const diffViewEl = document.getElementById("approval-diff-view")!;
const diffTitleEl = document.getElementById("approval-diff-title")!;
const diffContainerEl = document.getElementById("approval-diff-container")!;
const diffAcceptBtnEl = document.getElementById("approval-diff-accept")!;
const diffDiscardBtnEl = document.getElementById("approval-diff-discard")!;
const batchViewEl = document.getElementById("approval-batch-view")!;
const batchTitleEl = document.getElementById("approval-batch-title")!;
const batchListEl = document.getElementById("approval-batch-list")!;
const batchAcceptBtnEl = document.getElementById("approval-batch-accept")!;
const batchDiscardBtnEl = document.getElementById("approval-batch-discard")!;

let diffEditorInstance: monaco.editor.IStandaloneDiffEditor | null = null;

/** Shows the appropriate approval UI for a single workspace action and resolves once the user
 * accepts or rejects it. Never runs two approvals concurrently - the caller awaits one at a time. */
export async function requestApproval(cmd: WorkspaceCommand, workspacePath: string): Promise<boolean> {
  return cmd.action === "delete" ? requestDeleteApproval(cmd.filename) : requestDiffApproval(cmd, workspacePath);
}

function requestDeleteApproval(filename: string): Promise<boolean> {
  deleteViewEl.classList.remove("hidden");
  diffViewEl.classList.add("hidden");
  deleteMessageEl.textContent = t.deleteApprovalMessage(filename);
  modalEl.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = () => {
      modalEl.classList.add("hidden");
      deleteConfirmBtnEl.removeEventListener("click", onConfirm);
      deleteCancelBtnEl.removeEventListener("click", onCancel);
    };
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    deleteConfirmBtnEl.addEventListener("click", onConfirm);
    deleteCancelBtnEl.addEventListener("click", onCancel);
  });
}

async function requestDiffApproval(cmd: WorkspaceCommand, workspacePath: string): Promise<boolean> {
  let original = "";
  try {
    original = await readWorkspaceFile(workspacePath, cmd.filename);
  } catch {
    // File doesn't exist yet (create) or is unreadable - diff against empty content.
    original = "";
  }
  // Edits carry search/replace pairs instead of the whole new content - simulate them here just
  // to build the diff preview; the actual write still applies them exactly the same way on disk.
  const modified = cmd.edits ? applyEditsToContent(original, cmd.edits) : cmd.content ?? "";
  const language = getLanguageFromExtension(cmd.filename);

  diffViewEl.classList.remove("hidden");
  deleteViewEl.classList.add("hidden");
  diffTitleEl.textContent = t.diffApprovalTitle(cmd.filename);
  modalEl.classList.remove("hidden");

  const originalModel = monaco.editor.createModel(original, language);
  const modifiedModel = monaco.editor.createModel(modified, language);

  diffEditorInstance = monaco.editor.createDiffEditor(diffContainerEl, {
    theme: "vs-dark",
    readOnly: true,
    renderSideBySide: false,
    automaticLayout: true,
  });
  diffEditorInstance.setModel({ original: originalModel, modified: modifiedModel });

  return new Promise((resolve) => {
    const cleanup = () => {
      modalEl.classList.add("hidden");
      diffEditorInstance?.dispose();
      diffEditorInstance = null;
      originalModel.dispose();
      modifiedModel.dispose();
      diffAcceptBtnEl.removeEventListener("click", onAccept);
      diffDiscardBtnEl.removeEventListener("click", onDiscard);
    };
    const onAccept = () => {
      cleanup();
      resolve(true);
    };
    const onDiscard = () => {
      cleanup();
      resolve(false);
    };
    diffAcceptBtnEl.addEventListener("click", onAccept);
    diffDiscardBtnEl.addEventListener("click", onDiscard);
  });
}

/** Approval for Architect Mode ("createProject"): a whole new project folder with many new
 * files. Showing an individual diff per file would be pointless (nothing existed before), so this
 * shows one consolidated list of files to be created with a single accept/discard. */
export function requestBatchCreateApproval(rootFolder: string, files: ProjectFile[]): Promise<boolean> {
  batchViewEl.classList.remove("hidden");
  deleteViewEl.classList.add("hidden");
  diffViewEl.classList.add("hidden");
  batchTitleEl.textContent = t.batchApprovalTitle(rootFolder);
  batchListEl.innerHTML = "";
  for (const file of files) {
    const li = document.createElement("li");
    li.textContent = `${rootFolder}/${file.filename}`;
    batchListEl.appendChild(li);
  }
  modalEl.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = () => {
      modalEl.classList.add("hidden");
      batchAcceptBtnEl.removeEventListener("click", onAccept);
      batchDiscardBtnEl.removeEventListener("click", onDiscard);
    };
    const onAccept = () => {
      cleanup();
      resolve(true);
    };
    const onDiscard = () => {
      cleanup();
      resolve(false);
    };
    batchAcceptBtnEl.addEventListener("click", onAccept);
    batchDiscardBtnEl.addEventListener("click", onDiscard);
  });
}
