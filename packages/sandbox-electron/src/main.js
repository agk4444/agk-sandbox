// AGK OS Electron main process.
// Spawns the local orchestrator, opens the web UI in a BrowserWindow.
// The user gets the full AGK OS experience as a desktop app — no terminal, no browser needed.

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let orchestratorProc = null;
let webProc = null;

const ORCHESTRATOR_PORT = 8788;
const WEB_PORT = 3002;

// Find the agk-os repo. In dev, it's a sibling; in prod, it's bundled.
function findAgkOsDir() {
  const candidates = [
    // Bundled (electron-builder extraResources)
    path.join(process.resourcesPath, "agk-os"),
    // Dev: sibling of agk-sandbox repo
    path.join(__dirname, "..", "..", "..", "agk-fire-os", "wt-main"),
    path.join(__dirname, "..", "..", "agk-os"),
    // Env override
    process.env.AGK_OS_DIR,
  ].filter(Boolean);
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "services", "orchestrator"))) {
      return dir;
    }
  }
  return null;
}

// Poll a port until it responds or timeout. Returns true if healthy.
function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    check();
  });
}

function showFatalError(title, message) {
  dialog.showErrorBox(title, message);
  app.quit();
}

// Auto-updater: checks GitHub releases for new versions.
// Configure via `publish` in electron-builder.yml.
function setupAutoUpdater() {
  autoUpdater.autoDownload = false; // ask first

  autoUpdater.on("update-available", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update available",
        message: `AGK OS ${info.version} is available. Download it?`,
        buttons: ["Download", "Later"],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: "Update downloaded. Restart to install?",
        buttons: ["Restart", "Later"],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (err) => {
    console.error(`[updater] ${err.message}`);
  });

  // Check on startup (after window opens) and every 6 hours
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600 * 1000);
}

function startOrchestrator(agkOsDir) {
  const entry = path.join(agkOsDir, "services", "orchestrator", "src", "index.js");
  console.log(`[electron] starting orchestrator: ${entry}`);
  orchestratorProc = spawn(process.execPath, [entry], {
    cwd: path.join(agkOsDir, "services", "orchestrator"),
    env: {
      ...process.env,
      PORT: String(ORCHESTRATOR_PORT),
      AGK_LOCAL_MODE: "1",
      // Local data dir (not the Plesk path)
      AGK_DATA_DIR: path.join(app.getPath("userData"), "data"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  orchestratorProc.stdout.on("data", (d) => console.log(`[orchestrator] ${d}`.trim()));
  orchestratorProc.stderr.on("data", (d) => console.error(`[orchestrator] ${d}`.trim()));
  orchestratorProc.on("exit", (code) => console.log(`[electron] orchestrator exited: ${code}`));
}

function startWebApp(agkOsDir) {
  const webDir = path.join(agkOsDir, "apps", "web");
  const nextBin = path.join(webDir, "node_modules", ".bin", "next");

  if (!fs.existsSync(path.join(webDir, ".next"))) {
    console.error("[electron] no .next build found. Run `npm run build` in apps/web first.");
    return false;
  }

  console.log("[electron] starting Next.js production server");
  webProc = spawn(nextBin, ["start", "-p", String(WEB_PORT)], {
    cwd: webDir,
    env: { ...process.env, PORT: String(WEB_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  webProc.stdout.on("data", (d) => console.log(`[web] ${d}`.trim()));
  webProc.stderr.on("data", (d) => console.error(`[web] ${d}`.trim()));
  webProc.on("exit", (code) => console.log(`[electron] web server exited: ${code}`));
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "AGK OS",
  });

  // In dev, the Next.js dev server; in prod, the bundled build.
  const webUrl = process.env.AGK_WEB_URL || `http://localhost:${WEB_PORT}`;
  mainWindow.loadURL(webUrl);

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${WEB_PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const agkOsDir = findAgkOsDir();
  if (!agkOsDir) {
    showFatalError(
      "AGK OS — Setup Error",
      "Could not find the AGK OS files.\n\nSet the AGK_OS_DIR environment variable to the agk-os repo path."
    );
    return;
  }
  console.log(`[electron] using agk-os at ${agkOsDir}`);

  startOrchestrator(agkOsDir);
  const webOk = startWebApp(agkOsDir);
  if (!webOk) {
    showFatalError(
      "AGK OS — Setup Error",
      "Web UI not built.\n\nRun `npm run build` in apps/web first, then relaunch."
    );
    return;
  }

  // Wait for both servers to be healthy before opening the window
  console.log("[electron] waiting for servers...");
  const [orchOk, webHealthy] = await Promise.all([
    waitForPort(ORCHESTRATOR_PORT, 30000),
    waitForPort(WEB_PORT, 30000),
  ]);

  if (!orchOk) {
    showFatalError("AGK OS — Startup Error", "Orchestrator failed to start on port 8788.\n\nCheck the logs and try again.");
    return;
  }
  if (!webHealthy) {
    showFatalError("AGK OS — Startup Error", "Web UI failed to start on port 3002.\n\nCheck the logs and try again.");
    return;
  }

  console.log("[electron] servers healthy, opening window");
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (orchestratorProc) {
    console.log("[electron] stopping orchestrator");
    orchestratorProc.kill();
  }
  if (webProc) {
    console.log("[electron] stopping web server");
    webProc.kill();
  }
});
