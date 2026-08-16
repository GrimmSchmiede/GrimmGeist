# AUR-Paket (`grimmgeist-bin`)

Dieser Ordner enthält die `PKGBUILD` für ein AUR-Binärpaket, das die bereits fertig gebaute
`GrimmGeist_<version>_linux_amd64`-Datei aus den GitHub-Releases installiert (kein Kompilieren nötig,
analog zu z. B. `visual-studio-code-bin`).

**Wichtig:** Ich (Claude) kann dieses Paket nicht selbst auf's AUR hochladen - das braucht einen
persönlichen [AUR-Account](https://aur.archlinux.org/register) mit hinterlegtem SSH-Key, an den nur
ein Mensch mit Arch/CachyOS-System kommt. Die folgenden Schritte müssten manuell (auf einem
Arch-basierten System) durchgeführt werden.

## Erstmaliges Veröffentlichen

1. AUR-Account erstellen, SSH-Key unter Account-Einstellungen hinterlegen.
2. `PKGBUILD` in diesem Ordner ggf. anpassen: `# Maintainer:`-Zeile mit echtem Namen/E-Mail füllen.
3. Prüfsummen der aktuellen Quellen berechnen (im Ordner mit der `PKGBUILD`):
   ```bash
   sudo pacman -S --needed pacman-contrib base-devel
   updpkgsums
   ```
4. `.SRCINFO` generieren (Pflicht für jeden AUR-Upload):
   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```
5. Lokal testen, ob das Paket sauber baut und installiert:
   ```bash
   makepkg -si
   ```
6. AUR-Git-Repo initialisieren und pushen:
   ```bash
   git clone ssh://aur@aur.archlinux.org/grimmgeist-bin.git aur-grimmgeist-bin
   cp PKGBUILD .SRCINFO aur-grimmgeist-bin/
   cd aur-grimmgeist-bin
   git add PKGBUILD .SRCINFO
   git commit -m "Initial import: grimmgeist-bin 0.8.6"
   git push
   ```

## Bei jedem neuen GrimmGeist-Release aktualisieren

1. `pkgver` in der `PKGBUILD` auf die neue Version anheben, `pkgrel` zurück auf `1`.
2. `updpkgsums` erneut ausführen (lädt die neuen Release-Dateien und aktualisiert die Prüfsummen).
3. `makepkg --printsrcinfo > .SRCINFO` erneut ausführen.
4. Im geklonten AUR-Repo committen und pushen (wie oben, Schritt 6).

Das lässt sich später auch automatisieren (z. B. ein GitHub-Actions-Workflow, der bei jedem Release
automatisch `pkgver`/Prüfsummen aktualisiert und ins AUR pusht) - dafür wird aber der private
SSH-Key des AUR-Accounts als Secret benötigt, den nur ihr hinterlegen könnt.
