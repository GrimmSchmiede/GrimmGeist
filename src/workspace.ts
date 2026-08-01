import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({ directory: true, title: "Arbeitsordner wählen" });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function listWorkspaceFiles(workspace: string): Promise<string[]> {
  return await invoke<string[]>("list_workspace_files", { workspace });
}

interface WriteResult {
  path: string;
  backup: string | null;
}

/** Writes a file in the workspace and returns the workspace-relative backup path the prior
 * version was saved to (for the "Undo" button), if one existed. */
export async function writeWorkspaceFile(
  workspace: string,
  filename: string,
  content: string
): Promise<{ path: string; backup: string | null }> {
  return await invoke<WriteResult>("workspace_write_file", { workspace, filename, content });
}

export async function readWorkspaceFile(workspace: string, filename: string): Promise<string> {
  return await invoke<string>("workspace_read_file", { workspace, filename });
}

/** Deletes a file in the workspace and returns the workspace-relative backup path its content
 * was saved to (for the "Undo" button), if the file existed. */
export async function deleteWorkspaceFile(workspace: string, filename: string): Promise<string | null> {
  return await invoke<string | null>("workspace_delete_file", { workspace, filename });
}

/** Restores a file from a specific backup snapshot returned by writeWorkspaceFile,
 * deleteWorkspaceFile or applyWorkspaceEdits - the "Undo" action for a workspace change. */
export async function restoreWorkspaceBackup(workspace: string, filename: string, backup: string): Promise<void> {
  await invoke("workspace_restore_backup", { workspace, filename, backup });
}

export interface SearchReplaceEdit {
  search: string;
  replace: string;
}

export interface EditOutcome {
  search: string;
  status: "SUCCESS_PRECISE" | "FUZZY_MATCH_NEEDED" | "NOT_FOUND";
  /** 1-based line number of a located fuzzy match, if status is FUZZY_MATCH_NEEDED. */
  matchedLine?: number;
  /** Exact (non-normalized) text at that location - shown as a "did you mean this?" suggestion. */
  matchedText?: string;
}

interface ApplyEditsResult {
  outcomes: EditOutcome[];
  backup: string | null;
}

/** Applies precise search/replace edits to an existing workspace file. Exact matches are written
 * to disk; ambiguous whitespace-only matches or missing search strings are reported back per edit
 * instead of guessing, since a wrong auto-apply could silently corrupt the file. Also returns the
 * workspace-relative backup path of the pre-edit content (for the "Undo" button), if any edit
 * actually changed the file. */
export async function applyWorkspaceEdits(
  workspace: string,
  filename: string,
  edits: SearchReplaceEdit[]
): Promise<ApplyEditsResult> {
  return await invoke<ApplyEditsResult>("workspace_apply_edits", { workspace, filename, edits });
}

/** Pure in-memory simulation of applyWorkspaceEdits, used only to build the "modified" preview
 * side of the diff-approval view before anything is actually written to disk. Mirrors the Rust
 * exact-match logic (first occurrence per edit); non-matching edits are left as no-ops here too. */
export function applyEditsToContent(original: string, edits: SearchReplaceEdit[]): string {
  let content = original;
  for (const edit of edits) {
    const idx = content.indexOf(edit.search);
    if (idx !== -1) {
      content = content.slice(0, idx) + edit.replace + content.slice(idx + edit.search.length);
    }
  }
  return content;
}

export interface ProjectFile {
  filename: string;
  content: string;
}

/** Creates a whole new project folder ("Architect Mode") with all its files in one call. */
export async function createWorkspaceProject(
  workspace: string,
  rootFolder: string,
  files: ProjectFile[]
): Promise<string[]> {
  return await invoke<string[]>("workspace_create_project", { workspace, rootFolder, files });
}

export interface WorkspaceCommand {
  action: "create" | "edit" | "delete";
  filename: string;
  /** Full new file content - used for "create" (no existing content to diff against). */
  content?: string;
  /** Precise search/replace pairs - used for "edit" instead of overwriting the whole file. */
  edits?: SearchReplaceEdit[];
}

function isSearchReplaceEdit(value: unknown): value is SearchReplaceEdit {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).search === "string" &&
    typeof (value as Record<string, unknown>).replace === "string"
  );
}

function isWorkspaceCommand(value: unknown): value is WorkspaceCommand {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as Record<string, unknown>).filename !== "string" ||
    !["create", "edit", "delete"].includes((value as Record<string, unknown>).action as string)
  ) {
    return false;
  }
  const editsRaw = (value as Record<string, unknown>).edits;
  if (editsRaw !== undefined && !(Array.isArray(editsRaw) && editsRaw.every(isSearchReplaceEdit))) {
    return false;
  }
  return true;
}

export interface CreateProjectRequest {
  rootFolder: string;
  files: ProjectFile[];
}

function isProjectFile(value: unknown): value is ProjectFile {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).filename === "string" &&
    typeof (value as Record<string, unknown>).content === "string"
  );
}

function isCreateProjectRequest(value: unknown): value is CreateProjectRequest {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).rootFolder === "string" &&
    Array.isArray((value as Record<string, unknown>).files) &&
    ((value as { files: unknown[] }).files.every(isProjectFile))
  );
}

export interface WorkspaceResponse {
  reply: string;
  actions: WorkspaceCommand[];
  createProject: CreateProjectRequest | null;
}

/** Best-effort repair for truncated/malformed JSON (e.g. the model hit its output token limit
 * mid-response). Closes unterminated strings and any still-open brackets/braces so JSON.parse gets
 * a chance to succeed instead of the whole raw (partial) JSON leaking into the chat as garbage
 * text. Structured Output makes this rare but doesn't prevent hard truncation. */
function tryRepairTruncatedJson(text: string): string | null {
  let result = "";
  let inString = false;
  let escapeNext = false;
  const stack: string[] = [];

  for (const ch of text) {
    if (inString) {
      result += ch;
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === "\\") {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") stack.pop();
    result += ch;
  }

  if (inString) result += '"';
  while (stack.length) {
    const opener = stack.pop();
    result += opener === "{" ? "}" : "]";
  }
  return result === text ? null : result;
}

/** Parses a workspace-mode Gemini response into its chat reply, file actions and any Architect
 * Mode project scaffold. The API is asked for Structured Output matching WORKSPACE_RESPONSE_SCHEMA
 * (see gemini.ts), so `text` here is expected to always be valid JSON; a repair pass handles the
 * rare case of hard truncation (output token limit hit mid-response) before giving up. */
export function parseWorkspaceResponse(text: string): WorkspaceResponse {
  const trimmed = text.trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const repaired = tryRepairTruncatedJson(trimmed);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        parsed = null;
      }
    }
  }

  if (parsed && typeof parsed === "object") {
    const reply = typeof (parsed as Record<string, unknown>).reply === "string" ? (parsed as { reply: string }).reply : "";
    const actionsRaw = (parsed as Record<string, unknown>).actions;
    const actions = Array.isArray(actionsRaw) ? actionsRaw.filter(isWorkspaceCommand) : [];
    const createProjectRaw = (parsed as Record<string, unknown>).createProject;
    const createProject = isCreateProjectRequest(createProjectRaw) ? createProjectRaw : null;
    if (reply || actions.length || createProject) return { reply, actions, createProject };
  }
  return { reply: text, actions: [], createProject: null };
}
