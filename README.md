<img src="App/build/icon.png" width="96" alt="DHFile">

# 💙🤍README🤍💙

## 📘Table of Contents

1. [📘Table of Contents](#📘table-of-contents)
2. [🖖Introduction](#🖖introduction)
3. [✨Features](#✨features)
4. [⌨️Keyboard shortcuts](#⌨️keyboard-shortcuts)
5. [🛠️Development](#🛠️development)

---

## 🖖Introduction

DHFile is a modern tabbed file explorer for Windows by Elias De Hondt, in the house style of DHMail and DHTerminal. It does what Windows Explorer does — browse, copy, move, rename, delete, search, preview — with tabs, your own pinned folders, a PIN lock and full control over how it looks. If you want, DHFile also takes over from Explorer: folders, drives and Win + E then open in DHFile.

Please also see following documents:
- [LICENSE](LICENSE.md)
- [SECURITY](SECURITY.md)
- [CONTRIBUTING](CONTRIBUTING.md)
- [CODE OF CONDUCT](CODE-OF-CONDUCT.md)

## ✨Features

- **Tabs and windows**: open folders in tabs, drag tabs to reorder them, middle-click a folder to open it in a new tab, and pick up your tabs from last time.
- **Pinned folders**: Downloads and Documents are pinned at the top of the sidebar from the start. Pin any other folder or drive (right-click → Pin to sidebar, or drag it onto "Pinned") and reorder them.
- **This PC**: every drive with its free space, mapped network drives and the network locations you added in Explorer.
- **Details and icon views**: sortable columns, small, medium and large icons with real thumbnails for photos, videos and PDFs, and each app's own icon for `.exe` and shortcuts. Smooth with folders of thousands of files.
- **Everything Explorer does with files**: new folder, new text document, rename in place, cut, copy and paste (also to and from Explorer), drag and drop (also from and to other apps), Recycle Bin or delete for good, "Replace / Keep both / Skip" when names clash, Open with…, Copy as path and a Properties window with the folder size.
- **Search**: searches the current folder and everything below it while you type, with `*` and `?` wildcards.
- **Preview pane**: pictures and the first lines of text and code files.
- **Address bar**: click to type a path (also `%USERPROFILE%`, `~` and `\\server\share`), or use the breadcrumbs and their subfolder menus.
- **Works with your other tools**: Open in DHTerminal (or Windows Terminal), Open in VS Code and Show in Windows Explorer. The installer adds "Open in DHFile" to Explorer's right-click menu.
- **PIN lock**: like DHMail and DHTerminal. While DHFile is locked, nothing on your disks can be listed, opened, changed or previewed. It also locks itself after a while without use.
- **NL / EN, dark / light**, Windows 11 Mica, and the DH cursors and colours. While a dialog is open, the window buttons are dimmed and disabled along with the rest.

## ⌨️Keyboard shortcuts

| Keys | What it does |
| --- | --- |
| `Ctrl + Shift + N` | New folder (and rename it right away) |
| `F2` | Rename |
| `Ctrl + C` / `Ctrl + X` / `Ctrl + V` | Copy / cut / paste |
| `Ctrl + Shift + C` | Copy as path |
| `Delete` / `Shift + Delete` | Recycle Bin / delete for good |
| `Enter` / `Alt + Enter` | Open / Properties |
| `Ctrl + A` | Select all |
| `Backspace` or `Alt + ↑` | Up one level |
| `Alt + ←` / `Alt + →` (or the mouse side buttons) | Back / forward |
| `Ctrl + L`, `Alt + D` or `F4` | Type in the address bar |
| `Ctrl + F`, `Ctrl + E` or `F3` | Search |
| `F5` | Refresh |
| `Ctrl + T` / `Ctrl + W` / `Ctrl + Tab` | New tab / close tab / next tab |
| `Ctrl + N` | New window |
| `Ctrl + ,` | Settings |
| Letters | Jump to the first item that starts with them |

## 🛠️Development

The app lives in [App](App): Electron + Angular 20, with an NSIS installer built by electron-builder.

```powershell
cd App
npm install
npm start          # build and run
npm test           # unit tests
npm run dist       # App/release/DHFile-Setup-v<version>.exe
```

Bump `version` in `App/package.json` with every change. Pushing a `v<version>` tag builds the installer on GitHub Actions and publishes it as a release.
