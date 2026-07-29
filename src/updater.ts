import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { t } from "./i18n";

const bannerEl = document.getElementById("update-banner")!;
const bannerTextEl = document.getElementById("update-banner-text")!;
const installBtnEl = document.getElementById("update-install-btn") as HTMLButtonElement;
const dismissBtnEl = document.getElementById("update-dismiss-btn")!;

let pendingUpdate: Update | null = null;

function showBanner(version: string) {
  bannerTextEl.textContent = t.updateAvailable(version);
  installBtnEl.textContent = t.installUpdate;
  dismissBtnEl.title = t.later;
  bannerEl.classList.remove("hidden");
}

function hideBanner() {
  bannerEl.classList.add("hidden");
}

async function installUpdate() {
  if (!pendingUpdate) return;
  installBtnEl.disabled = true;
  installBtnEl.textContent = t.installing;
  try {
    await pendingUpdate.downloadAndInstall();
    await relaunch();
  } catch (err) {
    installBtnEl.disabled = false;
    installBtnEl.textContent = t.installUpdate;
    alert(t.installUpdateError(String(err)));
  }
}

/** Checks the GitHub release feed for a newer signed build and shows a banner if one is found. */
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (update?.available) {
      pendingUpdate = update;
      showBanner(update.version);
    }
  } catch (err) {
    // No network / no releases yet / running an unsigned dev build: fail silently.
    console.debug("Update-Check fehlgeschlagen:", err);
  }
}

installBtnEl.addEventListener("click", installUpdate);
dismissBtnEl.addEventListener("click", hideBanner);
