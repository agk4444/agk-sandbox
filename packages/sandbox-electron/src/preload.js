// Preload script: secure bridge between renderer and main.
// Currently minimal — exposes app version. Expand as needed for
// native integrations (file dialogs, system tray, etc.).

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("agkDesktop", {
  version: "0.1.0",
  platform: process.platform,
  isDesktop: true,
});
