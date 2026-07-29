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

export async function writeWorkspaceFile(
  workspace: string,
  filename: string,
  content: string
): Promise<string> {
  return await invoke<string>("workspace_write_file", { workspace, filename, content });
}

export async function deleteWorkspaceFile(workspace: string, filename: string): Promise<void> {
  await invoke("workspace_delete_file", { workspace, filename });
}

export interface WorkspaceCommand {
  action: "create" | "edit" | "delete";
  filename: string;
  content?: string;
}

function isWorkspaceCommand(value: unknown): value is WorkspaceCommand {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).filename === "string" &&
    ["create", "edit", "delete"].includes((value as Record<string, unknown>).action as string)
  );
}

/** Parses a Gemini response as one or more workspace file-action commands, per the JSON protocol
 * in the workspace system-prompt addition. Accepts both the current `{"actions":[...]}` array
 * format and a bare single-action object (in case the model drops the wrapper). Returns null for
 * any normal chat text (not an error). */
export function tryParseWorkspaceCommands(text: string): WorkspaceCommand[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).actions)) {
      const actions = (parsed as { actions: unknown[] }).actions.filter(isWorkspaceCommand);
      return actions.length ? actions : null;
    }
    if (isWorkspaceCommand(parsed)) {
      return [parsed];
    }
  } catch {
    // Not JSON: treat as normal chat text.
  }
  return null;
}
