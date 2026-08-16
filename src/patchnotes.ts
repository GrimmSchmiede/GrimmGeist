export interface PatchNoteEntry {
  version: string;
  de: string[];
  en: string[];
}

export const PATCH_NOTES: PatchNoteEntry[] = [
  {
    version: "0.8.20",
    de: [
      "Fix: Im strukturierten Antwortformat stand 'reply' (die Chat-Antwort) im Schema vor 'actions' (die Datei-Änderungen) - Gemini generiert JSON-Felder aber genau in dieser Reihenfolge, wodurch die KI sich gelegentlich schon beim Formulieren der Erklärung 'verausgabt' hat und 'actions' dann leer/falsch blieb, obwohl der Chat-Text von einer erfolgreichen Änderung sprach. 'actions' steht jetzt vor 'reply', damit die KI sich zuerst auf die tatsächliche Datei-Änderung festlegt.",
    ],
    en: [
      "Fix: in the structured response format, 'reply' (the chat text) was declared before 'actions' (the file changes) in the schema - but Gemini generates JSON fields in that exact order, so the AI sometimes 'spent' its reasoning on the explanation first and left 'actions' empty/wrong, even though the reply confidently described a successful change. 'actions' now comes before 'reply', so the AI commits to the actual file change first.",
    ],
  },
  {
    version: "0.8.19",
    de: [
      "Fix: Commit & Push hat bisher auch den lokalen `.grimmgeist-backups`-Ordner mit ins Git-Repo gepusht. Der Ordner wird jetzt automatisch zur `.gitignore` hinzugefügt und, falls bereits committet, beim nächsten Commit & Push aus dem Repo entfernt (die Backups bleiben lokal auf der Festplatte erhalten).",
    ],
    en: [
      "Fix: Commit & Push used to also push the local `.grimmgeist-backups` folder into the Git repo. That folder is now automatically added to `.gitignore` and, if it was already committed, untracked on the next Commit & Push (the backups stay on your local disk).",
    ],
  },
  {
    version: "0.8.18",
    de: [
      "Neu: Proaktive Datei-Kontext-Injektion - bevor eine Nachricht mit Workspace-Bezug an Gemini geht, schickt GrimmGeist jetzt automatisch den echten aktuellen Inhalt der im Live-Editor geöffneten Datei sowie aller im Nachrichtentext namentlich genannten Dateien mit, statt dass die KI aus dem Chat-Verlauf raten muss. Ist keine Datei eindeutig identifizierbar, wird die KI angewiesen, im Zweifel nach dem Dateinamen zu fragen statt zu raten.",
    ],
    en: [
      "New: proactive file context injection - before a workspace-related message goes to Gemini, GrimmGeist now automatically sends the real current content of the file open in the live editor plus any file explicitly named in the message text, instead of the AI having to guess from chat history. If no file can be clearly identified, the AI is instructed to ask for the filename rather than guess.",
    ],
  },
  {
    version: "0.8.17",
    de: [
      "Fix: Bei kleinen/mittelgroßen Dateien (bis ca. 400-500 Zeilen) zwang der System-Prompt die KI bisher IMMER zu Suchen/Ersetzen-Patches, selbst wenn eine komplette Neuausgabe zuverlässiger gewesen wäre - das führte bei CSS/HTML mit mehreren zusammenhängenden Stellen (z. B. mehrere ähnliche Selektoren) zu Kaskaden-Fehlern, bei denen jeder Fix nur einen Teil traf. Die KI darf solche Dateien jetzt standardmäßig als Ganzes neu ausgeben, Suchen/Ersetzen bleibt nur für wirklich große Dateien reserviert.",
    ],
    en: [
      "Fix: for small/medium files (up to roughly 400-500 lines), the system prompt previously forced the AI to ALWAYS use search/replace patches, even when a full rewrite would have been more reliable - this caused cascading failures with CSS/HTML that has multiple related spots (e.g. several similar selectors), where each fix only caught part of the problem. The AI can now rewrite such files wholesale by default; search/replace is reserved for genuinely large files.",
    ],
  },
  {
    version: "0.8.16",
    de: [
      "Fix: Wenn eine präzise Änderung nicht exakt passte (KI hat sich beim Dateiinhalt vertan), stand die Chat-Antwort trotzdem so da, als wäre alles erledigt worden. GrimmGeist versucht jetzt automatisch einmal, mit dem tatsächlichen aktuellen Dateiinhalt zu korrigieren, bevor es aufgibt - vorher musste man manuell nochmal fragen.",
    ],
    en: [
      "Fix: when a precise edit didn't match exactly (the AI misremembered the file content), the chat reply still read as if everything had been done. GrimmGeist now automatically retries once with the actual current file content before giving up - previously you had to manually ask again.",
    ],
  },
  {
    version: "0.8.15",
    de: [
      "Neu: Optionaler zweiter, kostenpflichtiger API-Schlüssel - in den Einstellungen konfigurierbar mit drei Prioritäts-Modi (nur kostenlos, nur kostenpflichtig, oder kostenlos zuerst mit automatischem Wechsel bei aufgebrauchtem Free-Kontingent). Antworten, die über den kostenpflichtigen Schlüssel liefen, werden mit einem deutlichen grünen 💲-Badge markiert.",
    ],
    en: [
      "New: optional second, paid API key - configurable in settings with three priority modes (free only, paid only, or free first with automatic switch once the free quota is exhausted). Responses served via the paid key are clearly marked with a green 💲 badge.",
    ],
  },
  {
    version: "0.8.14",
    de: [
      "Neu: Commit & Push direkt aus GrimmGeist - ein ⬆-Button neben dem Arbeitsordner-Pfad (nur sichtbar, wenn der Ordner ein Git-Repo ist) zeigt geänderte Dateien, lässt eine Commit-Nachricht eingeben und pusht mit einem Klick. Nutzt dein bereits lokal installiertes und eingerichtetes Git, kein separates Login in GrimmGeist nötig.",
    ],
    en: [
      "New: Commit & Push directly from GrimmGeist - an ⬆ button next to the workspace path (only shown when the folder is a Git repo) lists changed files, lets you enter a commit message, and pushes with one click. Uses your already-installed and configured local Git, no separate sign-in inside GrimmGeist required.",
    ],
  },
  {
    version: "0.8.13",
    de: [
      "Fix: Windows-Installer/Auto-Updater installierten seit 0.8.12 fälschlich das grimmgeist-cli-Binary statt der eigentlichen GUI (App öffnete kurz ein Fenster und stürzte sofort ab). Ursache war, dass GUI und CLI im selben Cargo-Package lagen und der Tauri-Bundler bei mehreren Binaries das falsche auswählte. grimmgeist-cli lebt jetzt als eigenes Package in einem Cargo-Workspace (crates/grimmgeist-cli), damit der GUI-Build gar nicht mehr mehrdeutig sein kann.",
    ],
    en: [
      "Fix: since 0.8.12, the Windows installer/auto-updater incorrectly installed the grimmgeist-cli binary instead of the actual GUI (app flashed a window open and crashed immediately). Caused by the GUI and CLI sharing one Cargo package, which made the Tauri bundler pick the wrong binary when multiple existed. grimmgeist-cli now lives in its own package inside a Cargo workspace (crates/grimmgeist-cli), so the GUI build can no longer be ambiguous.",
    ],
  },
  {
    version: "0.8.12",
    de: [
      "Neu: grimmgeist-cli - schlankes Terminal-Tool für schnelle Fragen an Gemini ohne die GUI zu öffnen, nutzt denselben API-Schlüssel aus dem Schlüsselbund, streamt die Antwort live. Bewusst reiner Ask-Modus ohne Workspace-Zugriff. Noch nicht Teil der Releases, selbst bauen mit cargo build -p grimmgeist-cli",
    ],
    en: [
      "New: grimmgeist-cli - lightweight terminal tool for quick questions to Gemini without opening the GUI, uses the same keychain API key, streams the reply live. Deliberately ask-mode only, no workspace access. Not yet part of the releases, build it yourself with cargo build -p grimmgeist-cli",
    ],
  },
  {
    version: "0.8.11",
    de: [
      "Neu: Konflikt-Erkennung im Live-Editor - schreibt die KI eine Datei, die du gerade mit ungespeicherten Änderungen offen hast, wird nicht mehr blind überschrieben, sondern eine Diff-Ansicht zeigt beide Versionen zur Auswahl (deine Änderung behalten oder KI-Version übernehmen)",
    ],
    en: [
      "New: live editor conflict detection - if the AI writes a file you have open with unsaved edits, it's no longer silently overwritten; a diff view lets you pick which version wins (keep your edit or take the AI's version)",
    ],
  },
  {
    version: "0.8.10",
    de: [
      "Neu: Sichtbares ⚡-Badge an einer Antwort, wenn sie wegen Überlastung/Kontingent nicht vom gewählten Modell, sondern einem Ausweichmodell kam - vorher war das nur an einer kurzen, schnell verschwindenden Statuszeile während des Wartens erkennbar",
    ],
    en: [
      "New: a visible \"⚡\" badge on a response when it came from a fallback model instead of the one you selected (due to overload/quota) - previously only visible as a brief status note while waiting, easy to miss",
    ],
  },
  {
    version: "0.8.9",
    de: [
      "Neu: Fuzzy-Match-Vorschlag - schlägt Gemini der search-Block eines präzisen Edits nicht exakt an, sucht GrimmGeist die ähnlichste Stelle in der Datei und bietet sie direkt im Chat mit einem Klick zur Übernahme an, statt einfach aufzugeben",
      "Neu: Verlauf einfrieren - über ein Schloss-Symbol an jeder Nachricht lässt sich der Chat ab diesem Punkt einfrieren, sodass ältere Nachrichten sichtbar bleiben, aber nicht mehr mitgeschickt werden (spart Tokens bei langen Chats)",
    ],
    en: [
      "New: fuzzy-match suggestion - if a precise edit's search block doesn't match exactly, GrimmGeist now looks for the closest matching spot in the file and offers it right in the chat with a one-click apply, instead of just giving up",
      "New: freeze history - a lock icon on any message lets you freeze the chat from that point on, so older messages stay visible but stop being sent to the AI (saves tokens on long chats)",
    ],
  },
  {
    version: "0.8.8",
    de: [
      "Neu: Bei „Kontingent aufgebraucht“ (HTTP 429) weicht GrimmGeist jetzt automatisch auf ein anderes Modell aus, bevor der Cooldown-Timer greift - Free-Tier-Kontingente sind pro Modell getrennt, ein anderes Modell hat oft noch welches übrig",
    ],
    en: [
      "New: on \"quota exceeded\" (HTTP 429), GrimmGeist now automatically falls back to a different model before the cooldown timer kicks in - free-tier quotas are tracked per model, so another one often still has quota left",
    ],
  },
  {
    version: "0.8.7",
    de: [
      "Neu: .grimmgeistignore - schließt Dateien vom KI-Kontext aus, die zwar in Git getrackt sind, aber für Gemini irrelevant/zu groß sind (z. B. Testdaten, generierte Bundles), ohne die eigentliche .gitignore anzufassen. Gleiche Syntax wie .gitignore, auf jeder Verzeichnisebene beachtet.",
    ],
    en: [
      "New: .grimmgeistignore - excludes files from the AI's context that are tracked in git but still irrelevant/too large for Gemini (e.g. test fixtures, generated bundles), without touching the actual .gitignore. Same syntax as .gitignore, honored at every directory level.",
    ],
  },
  {
    version: "0.8.6",
    de: [
      "Neu: Der Workspace-Ordner beachtet jetzt die .gitignore des Projekts (inkl. .git/info/exclude und globaler Gitignore-Regeln) - z. B. .env-Dateien mit echten Zugangsdaten landen dadurch nicht mehr versehentlich im an Gemini gesendeten Kontext",
    ],
    en: [
      "New: the workspace folder now respects the project's .gitignore (including .git/info/exclude and global gitignore rules) - e.g. .env files with real credentials no longer accidentally end up in the context sent to Gemini",
    ],
  },
  {
    version: "0.8.5",
    de: [
      "Linux: AppImage komplett entfernt - trotz mehrerer Fixversuche blieb das Fenster auf manchen Wayland-Systemen (z. B. CachyOS) weiß, weil Tauris AppImage-Bundler eine eigene, teils inkompatible WebKitGTK/GTK/Wayland-Bibliothekskette mitbündelt",
      "Flatpak und die rohe Linux-ELF-Binärdatei decken denselben Anwendungsfall (portabel, kein Root nötig) ab und sind davon nicht betroffen",
    ],
    en: [
      "Linux: removed the AppImage build entirely - despite several fix attempts, the window stayed blank on some Wayland systems (e.g. CachyOS) because Tauri's AppImage bundler ships its own, partly incompatible WebKitGTK/GTK/Wayland library stack",
      "Flatpak and the raw Linux ELF binary cover the same use case (portable, no root needed) and aren't affected by this",
    ],
  },
  {
    version: "0.8.4",
    de: [
      "Neu: Automatisches Backup - jede Datei, die im Workspace-Ordner überschrieben, bearbeitet oder gelöscht wird (durch die KI oder dich selbst im Live-Editor), wird zuerst unsichtbar nach .grimmgeist-backups/ gesichert (kein Git nötig, letzte 20 Versionen pro Datei, älteres wird automatisch entfernt)",
      "Neu: „↺ Rückgängig\"-Button direkt bei jeder erfolgreichen Datei-Aktion der KI im Chat - setzt genau diese eine Änderung zurück",
    ],
    en: [
      "New: automatic backup - every file overwritten, edited, or deleted in the workspace folder (by the AI or by you in the live editor) is first saved to a hidden .grimmgeist-backups/ folder (no Git required, last 20 versions per file, older ones pruned automatically)",
      "New: an \"↺ Undo\" button right on every successful AI file action in the chat - reverts exactly that one change",
    ],
  },
  {
    version: "0.8.3",
    de: [
      "Linux: möglicher Fix für weißes AppImage-Fenster unter Wayland (z. B. CachyOS) - der AppImage-Bundler erzwingt intern GDK_BACKEND=x11, wodurch WebKitGTK über XWayland statt nativem Wayland rendert; wird jetzt wieder auf Wayland zurückgesetzt, sobald eine Wayland-Sitzung erkannt wird",
    ],
    en: [
      "Linux: possible fix for a blank AppImage window under Wayland (e.g. CachyOS) - the AppImage bundler internally forces GDK_BACKEND=x11, causing WebKitGTK to render via XWayland instead of native Wayland; now forced back to Wayland whenever a Wayland session is detected",
    ],
  },
  {
    version: "0.8.2",
    de: [
      "Linux-Fix korrigiert: v0.8.1 setzte versehentlich WEBKIT_FORCE_SANDBOX (existiert bei WebKitGTK nicht, hatte nie eine Wirkung) statt der korrekten Variable WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS - betrifft AppImage, native Installation und das Flatpak-Manifest",
      "Behebt insbesondere Systeme (z. B. Arch/CachyOS), auf denen WebKitGTKs Sandbox mangels unprivilegierter User-Namespaces komplett fehlschlägt und die App mit einer \"Sandbox kann nicht deaktiviert werden\"-Meldung gar nicht erst startet",
    ],
    en: [
      "Linux fix corrected: v0.8.1 accidentally set WEBKIT_FORCE_SANDBOX (not a real WebKitGTK variable, never had any effect) instead of the correct WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS - affects AppImage, native install and the Flatpak manifest",
      "Fixes in particular systems (e.g. Arch/CachyOS) where WebKitGTK's sandbox fails outright due to disabled unprivileged user namespaces, preventing the app from starting at all with a \"sandbox could not be disabled\" error",
    ],
  },
  {
    version: "0.8.1",
    de: [
      "Linux: möglicher Fix für weißes Fenster mit „could not connect to localhost“ auch außerhalb von Flatpak (AppImage, native Installation) - WebKitGTKs interne Sandbox wird jetzt auch dort deaktiviert (WEBKIT_FORCE_SANDBOX=0)",
      "Frontend nutzt jetzt relative statt absolute Asset-Pfade (defensive Absicherung)",
    ],
    en: [
      "Linux: possible fix for a blank window with \"could not connect to localhost\" outside of Flatpak too (AppImage, native install) - WebKitGTK's internal sandbox is now disabled there as well (WEBKIT_FORCE_SANDBOX=0)",
      "Frontend now uses relative instead of absolute asset paths (defensive hardening)",
    ],
  },
  {
    version: "0.8.0",
    de: [
      "Neu: Präzise Datei-Bearbeitung per Suchen/Ersetzen statt vollständigem Datei-Überschreiben - schützt bestehenden Code (CSS, Animationen, Logik) vor versehentlichem Löschen/Vereinfachen",
      "Neu: „Architect Mode\" - GrimmGeist kann komplett neue Projektstrukturen mit mehreren Dateien in einem eigenen Unterordner in einem Zug anlegen",
      "Neu: Bilder per Einfügen (Strg+V) oder Drag & Drop in den Chat anhängen - werden automatisch verkleinert/komprimiert und an Gemini mitgeschickt",
      "Robustere JSON-Verarbeitung: abgeschnittene/fehlerhafte Antworten (z. B. bei Erreichen des Ausgabe-Limits) werden jetzt automatisch repariert, statt als Rohtext im Chat zu landen",
    ],
    en: [
      "New: precise file edits via search/replace instead of overwriting the whole file - protects existing code (CSS, animations, logic) from accidental deletion/simplification",
      "New: \"Architect Mode\" - GrimmGeist can scaffold a whole new project structure with multiple files in its own subfolder in one go",
      "New: attach images to the chat via paste (Ctrl+V) or drag & drop - automatically downscaled/compressed before being sent to Gemini",
      "More robust JSON handling: truncated/malformed responses (e.g. from hitting the output limit) are now automatically repaired instead of leaking as raw text into the chat",
    ],
  },
  {
    version: "0.7.0",
    de: [
      "Neu: Granulare Sicherheit für den KI-Dateizugriff im Workspace-Ordner (Einstellungen → „KI-Dateizugriff“)",
      "Drei Modi: Immer nachfragen, Teil-Autonom (einzeln pro Aktionstyp konfigurierbar), Voll-Autonom",
      "Beim Löschen fragt GrimmGeist jetzt mit einer deutlichen Warnung nach, bevor eine Datei unwiderruflich entfernt wird (wenn aktiviert)",
      "Beim Erstellen/Bearbeiten zeigt GrimmGeist einen Diff (Monacos nativer Diff-Editor) zwischen aktuellem und vorgeschlagenem Inhalt, bevor die Datei geschrieben wird (wenn aktiviert)",
    ],
    en: [
      "New: granular security for AI file access in the workspace folder (Settings → \"AI file access\")",
      "Three modes: always ask, partially autonomous (configurable per action type), fully autonomous",
      "On delete, GrimmGeist now asks for confirmation with a clear warning before a file is permanently removed (if enabled)",
      "On create/edit, GrimmGeist shows a diff (Monaco's native diff editor) between the current and proposed content before writing the file (if enabled)",
    ],
  },
  {
    version: "0.6.1",
    de: [
      "Neu: Smarter API-Key-Import - Button „API-Schlüssel holen“ in den Einstellungen öffnet Google AI Studio im Standard-Browser",
      "Sobald du dort einen Schlüssel kopierst, erkennt GrimmGeist ihn automatisch aus der Zwischenablage und trägt ihn ein (nur während das Einstellungsfenster offen ist)",
    ],
    en: [
      "New: smart API key import - a \"Get API key\" button in Settings opens Google AI Studio in the default browser",
      "As soon as you copy a key there, GrimmGeist automatically detects it from the clipboard and fills it in (only while the settings window is open)",
    ],
  },
  {
    version: "0.6.0",
    de: [
      "App aus Markenrechtsgründen von „NovaTwin\" in „GrimmGeist\" umbenannt (App-ID, Repository, Datenablage, Schlüsselbund-Eintrag)",
      "Hinweis: Chats/Einstellungen aus älteren Versionen werden dadurch nicht automatisch übernommen, der API-Schlüssel muss einmalig neu eingetragen werden",
      "Fehler behoben: über die Büroklammer angehängte Dateien ließen sich nicht im Live-Editor öffnen - jetzt sowohl direkt in der Anhang-Vorschau als auch nach dem Senden anklickbar",
      "Sperre für Dateien im Live-Editor gilt jetzt über die gesamte Dauer einer Anfrage (nicht nur den kurzen Schreibvorgang), damit das Schloss-Symbol tatsächlich sichtbar wird",
    ],
    en: [
      "App renamed from \"NovaTwin\" to \"GrimmGeist\" for trademark reasons (app ID, repository, data storage, keychain entry)",
      "Note: chats/settings from older versions are not carried over automatically because of this, the API key needs to be re-entered once",
      "Fixed: files attached via the paperclip couldn't be opened in the live editor - now clickable both in the attachment preview and after sending",
      "The live editor's file lock now spans the whole duration of a request (not just the brief disk write) so the lock icon is actually visible",
    ],
  },
  {
    version: "0.5.1",
    de: [
      "Fehler behoben: Chats umbenennen funktionierte nicht zuverlässig - jetzt per Rechtsklick auf einen Chat mit Menü für Umbenennen/Löschen",
      "Fehler behoben: Live-Editor ließ sich nicht ausblenden (ein CSS-Konflikt überschrieb das Verstecken)",
      "Klapp-Griff mit Pfeil-Symbol (‹/›) am Rand der Editor-Spalte ersetzt das bisherige, wenig eindeutige Umschalt-Icon - immer sichtbar, unabhängig vom Workspace-Ordner",
      "Sichtbarer Speichern-Button für eigene Änderungen im Editor (zusätzlich zu Strg+S, Tooltip zeigt den Shortcut)",
      "An eine Nachricht angehängte Einzeldateien lassen sich jetzt ebenfalls per Klick im Live-Editor öffnen, auch ohne verknüpften Workspace-Ordner",
    ],
    en: [
      "Fixed: renaming chats didn't work reliably - now via right-click on a chat with a rename/delete menu",
      "Fixed: the live editor couldn't be hidden (a CSS rule-order conflict overrode the hide state)",
      "A collapse handle with an arrow icon (‹/›) on the edge of the editor column replaces the previous, unclear toggle icon - always visible, independent of any workspace folder",
      "Visible save button for your own edits in the editor (in addition to Ctrl+S, tooltip shows the shortcut)",
      "Files attached to a single message can now also be opened in the live editor by clicking them, even without a linked workspace folder",
    ],
  },
  {
    version: "0.5.0",
    de: [
      "Neu: Live-Editor (Monaco/VS-Code-Engine) als eigene Spalte zwischen Chat-Verlauf und Chat-Fenster, ein-/ausblendbar über das Symbol in der Workspace-Leiste",
      "Datei aus der Workspace-Dateiliste anklicken, um sie mit Syntax-Highlighting im Editor zu öffnen (Tab-Leiste mit Schließen-Button)",
      "Während NovaTwin eine geöffnete Datei bearbeitet, wird der zugehörige Tab automatisch gesperrt (🔒) und danach live mit dem neuen Inhalt aktualisiert",
      "Eigene Änderungen im Editor mit Strg+S direkt speichern",
      "Dateien in der Workspace-Liste zeigen jetzt einen Zeiger-Cursor beim Hovern, damit klar ist, dass sie anklickbar sind",
      "Fehler behoben: von NovaTwin erstellter Code landete manchmal komplett in einer einzigen Zeile statt normal formatiert",
    ],
    en: [
      "New: live editor (Monaco/VS Code engine) as its own column between the chat list and the chat window, toggleable via the icon in the workspace bar",
      "Click a file in the workspace file list to open it in the editor with syntax highlighting (tab bar with close button)",
      "While NovaTwin edits an open file, its tab is automatically locked (🔒) and then live-updated with the new content once done",
      "Save your own edits in the editor directly with Ctrl+S",
      "Workspace file list entries now show a pointer cursor on hover to make clear they're clickable",
      "Fixed: code NovaTwin generated sometimes ended up entirely on a single line instead of properly formatted",
    ],
  },
  {
    version: "0.4.0",
    de: [
      "Chat-Namen umbenennbar (Doppelklick in der Seitenleiste)",
      "Fehler behoben: sehr lange Chat-Namen verdeckten den Löschen-Button",
      "Sprachumschalter Deutsch/Englisch in der Titelleiste",
      "Patch-Notes-Fenster (dieses hier) über die Versionsnummer in der Titelleiste",
      "Animierte „NovaTwin denkt nach“-Anzeige mit Timer während der Antwort generiert wird",
      "Gemini legt bei mehreren Dateien jetzt sinnvolle Unterordner an, statt alles ins Wurzelverzeichnis zu schreiben",
      "Bei „Modell überlastet“-Fehlern (hohe Nachfrage) versucht die App es automatisch mehrfach erneut und weicht danach auf ein anderes Modell aus, statt sofort abzubrechen",
      "Sprachumschalter nutzt jetzt echte Vektor-Flaggen (SVG) statt Emoji",
    ],
    en: [
      "Chats can now be renamed (double-click in the sidebar)",
      "Fixed: very long chat names hid the delete button",
      "German/English language switcher in the titlebar",
      "Patch notes window (this one) via the version number in the titlebar",
      "Animated \"NovaTwin is thinking\" indicator with a live timer while a reply is generated",
      "Gemini now creates sensible subfolders for multi-file requests instead of dumping everything in one folder",
      "\"Model overloaded\" (high demand) errors now trigger automatic retries and fall back to another model instead of failing immediately",
      "Language switcher now uses real vector flags (SVG) instead of emoji",
    ],
  },
  {
    version: "0.3.8",
    de: [
      "Release-Pipeline: Windows- und Linux-Build laufen jetzt nacheinander statt parallel (behebt einen Race-Condition-Fehler beim Release-Anlegen)",
    ],
    en: [
      "Release pipeline: Windows and Linux builds now run sequentially instead of in parallel (fixes a race condition when creating the release)",
    ],
  },
  {
    version: "0.3.7",
    de: ["Flatpak-Runtime auf org.gnome.Platform//50 angehoben, zusätzliche Keyring-Berechtigung"],
    en: ["Bumped Flatpak runtime to org.gnome.Platform//50, added keyring filesystem permission"],
  },
  {
    version: "0.3.6",
    de: ["Flatpak: weißes Fenster (\"could not connect to localhost\") durch Deaktivieren von WebKitGTKs interner Sandbox behoben"],
    en: ["Flatpak: fixed blank window (\"could not connect to localhost\") by disabling WebKitGTK's internal sandbox"],
  },
  {
    version: "0.3.5",
    de: ["Eigenes App-Icon in Titelleiste, Fenster- und Desktop-Icons aller Plattformen"],
    en: ["Custom app icon in the titlebar, window and desktop icons on all platforms"],
  },
  {
    version: "0.3.4",
    de: [
      "Workspace-Datei-Aktionen nutzen jetzt Googles Structured-Output-Modus (zuverlässiger als reines Prompt-JSON)",
      "Gemini erklärt jetzt kurz, was gemacht wurde und was als Nächstes sinnvoll ist",
    ],
    en: [
      "Workspace file actions now use Google's Structured Output mode (more reliable than plain-prompt JSON)",
      "Gemini now briefly explains what it did and what to do next",
    ],
  },
  {
    version: "0.3.3",
    de: ["Mehrere Datei-Aktionen (create/edit/delete) in einer einzigen Gemini-Antwort möglich"],
    en: ["Multiple file actions (create/edit/delete) possible in a single Gemini response"],
  },
  {
    version: "0.3.2",
    de: ["Flatpak-Build für Linux hinzugefügt (org.gnome.Platform-Runtime)"],
    en: ["Added Flatpak build for Linux (org.gnome.Platform runtime)"],
  },
  {
    version: "0.3.1",
    de: ["Weißes/schwarzes Fenster unter Linux behoben (WebKitGTK-Compositing-Workaround)"],
    en: ["Fixed blank/black window on Linux (WebKitGTK compositing workaround)"],
  },
  {
    version: "0.3.0",
    de: [
      "Eigene Titelleiste im App-Design mit Versionsanzeige",
      "Workspace-Ordner pro Chat: Gemini kann Dateien darin autonom erstellen/bearbeiten/löschen",
    ],
    en: [
      "Custom in-app titlebar with version display",
      "Per-chat workspace folder: Gemini can autonomously create/edit/delete files in it",
    ],
  },
  {
    version: "0.2.0",
    de: [
      "Modelle auf gemini-flash-latest / gemini-3.1-flash-lite umgestellt (alte Modelle von Google gesperrt)",
      "Automatischer Cooldown-Timer bei Kontingent-Fehlern (HTTP 429)",
    ],
    en: [
      "Switched models to gemini-flash-latest / gemini-3.1-flash-lite (old models blocked by Google)",
      "Automatic cooldown timer on quota errors (HTTP 429)",
    ],
  },
  {
    version: "0.1.0",
    de: ["Erste Version: Chat-UI, Datei-Anhang, sicherer API-Key-Speicher, Auto-Updater"],
    en: ["Initial release: chat UI, file attachments, secure API key storage, auto-updater"],
  },
];
