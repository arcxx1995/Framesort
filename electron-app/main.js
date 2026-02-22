const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND_URL = "http://127.0.0.1:8765";

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
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
    console.error("[backend]", data.toString());
  });

  backendProcess.on("exit", (code) => {
    backendProcess = null;
    console.log(`Backend exited with code ${code}`);
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
    console.error(error.message);
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
