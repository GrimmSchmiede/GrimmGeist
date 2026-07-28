# NovaTwin

Desktop-Chat-Client (Windows/Linux) für die Google Gemini API, gebaut mit [Tauri](https://tauri.app) 2
(Rust-Backend + Vanilla TypeScript-Frontend).

## Features

- Sidebar mit Chat-Verlauf, "Neuer Chat"-Button und Einstellungen
- Modell-Auswahl pro Chat (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`)
- Token- und Tageskontingent-Anzeige (Free-Tier-Limit: 1000 Anfragen/Tag, 15/Minute)
- Datei-Anhang (Büroklammer) zum Einlesen lokaler Dateien (z. B. `.lua`, `.py`) als Kontext
- "Datei aktualisieren"-Button, um von Gemini editierten Code direkt auf die Festplatte zurückzuschreiben
- API-Schlüssel wird **nicht** im Code oder als Klartext gespeichert, sondern im
  OS-Schlüsselbund (Windows Credential Manager / Linux Secret Service via `keyring`-Crate)
- Automatisches Update: Beim Start prüft die App den neuesten GitHub-Release; ist eine neuere,
  signierte Version verfügbar, erscheint ein Banner zum Herunterladen/Installieren + Neustart

## Entwicklung

Voraussetzungen: [Node.js](https://nodejs.org), [Rust](https://www.rust-lang.org/tools/install) und die
[Tauri-Systemabhängigkeiten](https://tauri.app/start/prerequisites/) für dein Betriebssystem.

```bash
npm install
npm run tauri dev
```

## Produktions-Build (lokal)

```bash
npm run tauri build
```

## Automatischer Release via GitHub Actions

Bei jedem Push auf `main` baut `.github/workflows/release.yml` über eine Matrix-Strategie
(`windows-latest`, `ubuntu-22.04`) mittels `tauri-apps/tauri-action` automatisch:

- Windows: `.exe` (NSIS) / `.msi`
- Linux: `.AppImage` / `.deb`

Die fertigen Installer werden automatisch als **veröffentlichter Release** (nicht als Draft)
unter "Releases" im Repository abgelegt – nur ein veröffentlichter Release ist über den
`/releases/latest/download/...`-Endpunkt erreichbar, den der Auto-Updater abfragt.

Vor der ersten Nutzung: Repository (und ggf. die Organisation) unter
`Settings → Actions → General → Workflow permissions` auf "Read and write permissions" stellen,
damit der Workflow Releases erstellen darf.

### Auto-Updater

Die App prüft bei jedem Start `https://github.com/State-of-Economy/NovaTwin/releases/latest/download/latest.json`.
Ist die dort verzeichnete Version neuer als die installierte, erscheint ein Update-Banner.
Damit ein neuer Push tatsächlich ein Update auslöst, **muss die Versionsnummer** in
`src-tauri/tauri.conf.json` (Feld `version`) und `package.json` vor dem Push erhöht werden –
sonst versucht die Pipeline, denselben Release-Tag erneut anzulegen, was fehlschlägt.

Updates werden mit einem lokal erzeugten Minisign-Schlüsselpaar signiert:

- **Public Key** liegt in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) – öffentlich, unkritisch.
- **Private Key** liegt **nicht** im Repository, sondern als verschlüsseltes GitHub-Secret
  `TAURI_SIGNING_PRIVATE_KEY` (Passwort in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
  **Wichtig:** Diesen privaten Schlüssel sicher aufbewahren (z. B. Passwortmanager) – geht er
  verloren, können keine weiteren signierten Updates mehr veröffentlicht werden und bestehende
  Installationen lassen sich nicht mehr automatisch aktualisieren.

## API-Schlüssel einrichten

1. App starten, unten links auf **Einstellungen** klicken.
2. Google AI Studio API-Schlüssel eintragen (kostenlos erhältlich unter
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
3. Optional: System-Prompt und Sicherheitsfilter anpassen.
4. Speichern – der Schlüssel wird verschlüsselt im OS-Schlüsselbund abgelegt, niemals im Klartext
   in einer Konfigurationsdatei oder im Quellcode.
