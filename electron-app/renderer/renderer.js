let selectedFolder = "";

function setStatus(message) {
  document.getElementById("status").innerText = message;
}

function setResult(value) {
  document.getElementById("result").innerText = value;
}

function requireFolder() {
  if (!selectedFolder) {
    throw new Error("Select a folder first.");
  }
}

async function selectFolder() {
  selectedFolder = await window.electronAPI.selectFolder();
  document.getElementById("folder").innerText = selectedFolder || "No folder selected.";
  setStatus(selectedFolder ? "Folder selected." : "Folder selection canceled.");
}

async function scanFolder() {
  try {
    requireFolder();
    setStatus("Scanning and classifying images...");
    const result = await window.electronAPI.scanFolder(selectedFolder);
    setResult(JSON.stringify(result, null, 2));
    setStatus(`Scan complete. Found ${result.project_count} projects across ${result.image_count} images.`);
  } catch (error) {
    setStatus(error.message || "Scan failed.");
  }
}

async function organizeFolder() {
  try {
    requireFolder();
    setStatus("Organizing images...");
    const result = await window.electronAPI.organizeFolder(selectedFolder);
    setResult(JSON.stringify(result, null, 2));
    setStatus(`Organize complete. Moved ${result.operations.length} files into ${result.project_count} projects.`);
  } catch (error) {
    setStatus(error.message || "Organize failed.");
  }
}
