import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

const appWindow = getCurrentWindow();

export async function getAppVersion(): Promise<string> {
  return await getVersion();
}

export async function initTitlebar(): Promise<void> {
  const versionEl = document.getElementById("titlebar-version")!;
  const minimizeBtn = document.getElementById("titlebar-minimize")!;
  const maximizeBtn = document.getElementById("titlebar-maximize")!;
  const closeBtn = document.getElementById("titlebar-close")!;

  try {
    versionEl.textContent = `v${await getVersion()}`;
  } catch {
    versionEl.textContent = "";
  }

  minimizeBtn.addEventListener("click", () => appWindow.minimize());
  closeBtn.addEventListener("click", () => appWindow.close());
  maximizeBtn.addEventListener("click", () => appWindow.toggleMaximize());

  const syncMaximizeIcon = async () => {
    maximizeBtn.textContent = (await appWindow.isMaximized()) ? "❐" : "☐";
  };
  await syncMaximizeIcon();
  appWindow.onResized(syncMaximizeIcon);
}
