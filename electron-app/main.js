const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND_URL = "http://127.0.0.1:8765";

let mainWindow;
let backendProcess;

function safeWrite(stream, message) {
  if (!stream || !stream.writable || stream.destroyed) {
    return;
  }

  try {
    stream.write(`${message}\n`);
  } catch (error) {
    if (error && error.code !== "EPIPE") {
      // Ignore logging failures so app flow is not interrupted.
    }
  }
}

function logInfo(message) {
  safeWrite(process.stdout, message);
}

function logError(message) {
  safeWrite(process.stderr, message);
}

function createWindow() {
  const WINDOW_WIDTH = 1520;
  const WINDOW_HEIGHT = 980;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxHeight: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Backend still warming up.
    }

    await sleep(250);
  }

  throw new Error("Backend startup timed out.");
}

async function requestBackend(route, folderPath) {
  const response = await fetch(`${BACKEND_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_path: folderPath }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail || "Backend request failed.");
  }

  return body;
}

async function requestBackendJson(route, payload) {
  const response = await fetch(`${BACKEND_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail || "Backend request failed.");
  }

  return body;
}

async function requestBackendHealth() {
  const response = await fetch(`${BACKEND_URL}/health`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail || "Backend health request failed.");
  }
  return body;
}

function startBackend() {
  if (backendProcess) {
    return;
  }

  const repoRoot = path.resolve(__dirname, "..");
  backendProcess = spawn("python", ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8765"], {
    cwd: repoRoot,
    windowsHide: true,
  });

  backendProcess.stderr.on("data", (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      logError(`[backend] ${line}`);
    }
  });

  backendProcess.on("exit", (code) => {
    backendProcess = null;
    logInfo(`Backend exited with code ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  startBackend();
  try {
    await waitForBackend();
  } catch (error) {
    logError(error.message);
  }
  createWindow();
});

app.on("before-quit", () => {
  stopBackend();
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.filePaths[0] || "";
});

ipcMain.handle("scan-folder", async (_event, folderPath) => {
  return requestBackend("/scan", folderPath);
});

ipcMain.handle("organize-folder", async (_event, folderPath) => {
  return requestBackend("/organize", folderPath);
});

ipcMain.handle("organize-folder-dry-run", async (_event, folderPath) => {
  return requestBackend("/organize/dry-run", folderPath);
});

ipcMain.handle("backend-health", async () => {
  return requestBackendHealth();
});

ipcMain.handle("gpu-acceleration-set", async (_event, enabled) => {
  return requestBackendJson("/runtime/gpu", { enabled: Boolean(enabled) });
});

ipcMain.handle("window-close", async (event) => {
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  if (currentWindow) {
    currentWindow.close();
  }
});

ipcMain.handle("window-minimize", async (event) => {
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  if (currentWindow) {
    currentWindow.minimize();
  }
});
