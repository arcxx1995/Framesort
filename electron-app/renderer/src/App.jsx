import React, { useEffect, useMemo, useReducer } from "react";

const DEFAULT_REVIEW_MESSAGE = 'Run "Review Organize Plan" to preview file moves before approval.';
const DEFAULT_SCAN_SUMMARY = "Run a scan to load project insights.";
const EMPTY_RESULT_TEXT = "Run a scan to preview grouped projects.";
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DIFF_SAMPLE_LIMIT = 12;
const IMAGE_PREVIEW_LIMIT = 20;

const initialState = {
  selectedFolder: "",
  statusMessage: "",
  resultText: EMPTY_RESULT_TEXT,
  reviewSummary: DEFAULT_REVIEW_MESSAGE,
  pendingPlan: null,
  displayedOperations: [],
  planDiff: null,
  moveFilter: "",
  pageSize: DEFAULT_PAGE_SIZE,
  currentPage: 1,
  busyAction: null,
  backendHealth: "checking",
  scanResult: null,
  projectFilter: "",
  selectedProjectName: "",
  showRawPayload: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, statusMessage: action.payload };
    case "SET_RESULT":
      return { ...state, resultText: action.payload };
    case "SET_BUSY":
      return { ...state, busyAction: action.payload };
    case "SET_BACKEND_HEALTH":
      return { ...state, backendHealth: action.payload };
    case "TOGGLE_RAW":
      return { ...state, showRawPayload: !state.showRawPayload };
    case "SELECT_FOLDER":
      return {
        ...state,
        selectedFolder: action.payload,
        reviewSummary: DEFAULT_REVIEW_MESSAGE,
        pendingPlan: null,
        displayedOperations: [],
        planDiff: null,
        moveFilter: "",
        pageSize: DEFAULT_PAGE_SIZE,
        currentPage: 1,
        scanResult: null,
        projectFilter: "",
        selectedProjectName: "",
      };
    case "LOAD_SCAN":
      return {
        ...state,
        scanResult: action.payload,
        pendingPlan: null,
        displayedOperations: [],
        reviewSummary: DEFAULT_REVIEW_MESSAGE,
        planDiff: null,
        moveFilter: "",
        pageSize: DEFAULT_PAGE_SIZE,
        currentPage: 1,
        projectFilter: "",
        selectedProjectName: action.payload.projects.length > 0 ? action.payload.projects[0].name : "",
      };
    case "LOAD_PLAN":
      return {
        ...state,
        pendingPlan: action.payload.plan,
        displayedOperations: action.payload.plan.operations,
        reviewSummary: action.payload.summary,
        planDiff: null,
        moveFilter: "",
        pageSize: DEFAULT_PAGE_SIZE,
        currentPage: 1,
      };
    case "PLAN_DRIFT":
      return {
        ...state,
        pendingPlan: action.payload.latestPlan,
        displayedOperations: action.payload.latestPlan.operations,
        reviewSummary: action.payload.summary,
        planDiff: action.payload.diff,
        currentPage: 1,
      };
    case "ORGANIZE_COMPLETE":
      return {
        ...state,
        pendingPlan: null,
        displayedOperations: action.payload.result.operations,
        reviewSummary: action.payload.summary,
        planDiff: null,
        currentPage: 1,
      };
    case "DISCARD_PLAN":
      return {
        ...state,
        pendingPlan: null,
        displayedOperations: [],
        reviewSummary: action.payload,
        planDiff: null,
        moveFilter: "",
        pageSize: DEFAULT_PAGE_SIZE,
        currentPage: 1,
      };
    case "SET_FILTER":
      return { ...state, moveFilter: action.payload, currentPage: 1 };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.payload, currentPage: 1 };
    case "SET_PAGE":
      return { ...state, currentPage: action.payload };
    case "SET_PROJECT_FILTER":
      return { ...state, projectFilter: action.payload };
    case "SELECT_PROJECT":
      return { ...state, selectedProjectName: action.payload };
    default:
      return state;
  }
}

function requireFolder(folderPath) {
  if (!folderPath) {
    throw new Error("Select a folder first.");
  }
}

function requireAPI() {
  if (!window.electronAPI) {
    throw new Error("Electron preload API is unavailable.");
  }

  return window.electronAPI;
}

function toResultText(payload) {
  return JSON.stringify(payload, null, 2);
}

function computePlanDiff(previousOperations, latestOperations) {
  const previousBySource = new Map();
  const latestBySource = new Map();

  for (const move of previousOperations) {
    previousBySource.set(move.source_path, move);
  }
  for (const move of latestOperations) {
    latestBySource.set(move.source_path, move);
  }

  const added = [];
  const removed = [];
  const retargeted = [];

  for (const [sourcePath, latestMove] of latestBySource.entries()) {
    const previousMove = previousBySource.get(sourcePath);
    if (!previousMove) {
      added.push(latestMove);
      continue;
    }

    if (previousMove.target_path !== latestMove.target_path || previousMove.status !== latestMove.status) {
      retargeted.push({
        source_path: sourcePath,
        previous_target: previousMove.target_path,
        latest_target: latestMove.target_path,
      });
    }
  }

  for (const [sourcePath, previousMove] of previousBySource.entries()) {
    if (!latestBySource.has(sourcePath)) {
      removed.push(previousMove);
    }
  }

  return {
    hasDiff: added.length > 0 || removed.length > 0 || retargeted.length > 0,
    added,
    removed,
    retargeted,
  };
}

function diffLines(diff) {
  const lines = [];
  for (const row of diff.retargeted.slice(0, DIFF_SAMPLE_LIMIT)) {
    lines.push(`RETARGET ${row.source_path}\n  FROM ${row.previous_target}\n  TO   ${row.latest_target}`);
  }
  for (const row of diff.added.slice(0, DIFF_SAMPLE_LIMIT)) {
    lines.push(`ADDED   ${row.source_path} -> ${row.target_path}`);
  }
  for (const row of diff.removed.slice(0, DIFF_SAMPLE_LIMIT)) {
    lines.push(`REMOVED ${row.source_path} -> ${row.target_path}`);
  }

  const changedCount = diff.added.length + diff.removed.length + diff.retargeted.length;
  if (changedCount > lines.length) {
    lines.push(`...and ${changedCount - lines.length} more changed move(s).`);
  }

  return lines;
}

function backendHealthLabel(health) {
  if (health === "healthy") {
    return "Healthy";
  }
  if (health === "unreachable") {
    return "Unreachable";
  }
  return "Checking";
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const isBusy = state.busyAction !== null;
  const canReview = !isBusy && Boolean(state.selectedFolder);
  const canScan = !isBusy && Boolean(state.selectedFolder);
  const canApprove = !isBusy && Boolean(state.pendingPlan) && state.pendingPlan.operations.length > 0;
  const canDiscard = !isBusy && Boolean(state.pendingPlan);

  const scanProjects = state.scanResult ? state.scanResult.projects : [];

  const filteredProjects = useMemo(() => {
    const needle = state.projectFilter.trim().toLowerCase();
    if (!needle) {
      return scanProjects;
    }

    return scanProjects.filter((project) => {
      const haystack = `${project.name} ${project.category} ${project.capture_date}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [scanProjects, state.projectFilter]);

  const selectedProject = useMemo(() => {
    if (!state.selectedProjectName) {
      return null;
    }
    return filteredProjects.find((project) => project.name === state.selectedProjectName) || null;
  }, [filteredProjects, state.selectedProjectName]);

  useEffect(() => {
    if (filteredProjects.length === 0) {
      if (state.selectedProjectName) {
        dispatch({ type: "SELECT_PROJECT", payload: "" });
      }
      return;
    }

    const exists = filteredProjects.some((project) => project.name === state.selectedProjectName);
    if (!exists) {
      dispatch({ type: "SELECT_PROJECT", payload: filteredProjects[0].name });
    }
  }, [filteredProjects, state.selectedProjectName]);

  const categorySummary = useMemo(() => {
    const counts = new Map();
    for (const project of scanProjects) {
      const key = project.category;
      counts.set(key, (counts.get(key) || 0) + project.image_count);
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [scanProjects]);

  const filteredOperations = useMemo(() => {
    const needle = state.moveFilter.trim().toLowerCase();
    if (!needle) {
      return state.displayedOperations;
    }

    return state.displayedOperations.filter((move) => {
      const haystack = `${move.status} ${move.source_path} ${move.target_path}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [state.displayedOperations, state.moveFilter]);

  const totalPages = filteredOperations.length === 0 ? 0 : Math.ceil(filteredOperations.length / state.pageSize);
  const currentPage = totalPages === 0 ? 0 : Math.min(state.currentPage, totalPages);
  const start = currentPage > 0 ? (currentPage - 1) * state.pageSize : 0;
  const end = start + state.pageSize;
  const pageRows = filteredOperations.slice(start, end);

  function setStatus(message) {
    dispatch({ type: "SET_STATUS", payload: message });
  }

  function setBusy(busyAction) {
    dispatch({ type: "SET_BUSY", payload: busyAction });
  }

  function setResult(payload) {
    dispatch({ type: "SET_RESULT", payload: toResultText(payload) });
  }

  async function refreshBackendHealth(silent) {
    try {
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "checking" });
      const api = requireAPI();
      await api.checkBackendHealth();
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "healthy" });
      if (!silent) {
        setStatus("Backend is reachable.");
      }
    } catch (error) {
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "unreachable" });
      if (!silent) {
        setStatus(error.message || "Backend is unreachable.");
      }
    }
  }

  useEffect(() => {
    refreshBackendHealth(true);
  }, []);

  async function selectFolder() {
    try {
      setBusy("select");
      const api = requireAPI();
      const folder = await api.selectFolder();
      dispatch({ type: "SELECT_FOLDER", payload: folder || "" });
      setStatus(folder ? "Folder selected." : "Folder selection canceled.");
    } catch (error) {
      setStatus(error.message || "Folder selection failed.");
    } finally {
      setBusy(null);
    }
  }

  async function scanFolder() {
    try {
      requireFolder(state.selectedFolder);
      setBusy("scan");
      setStatus("Scanning and classifying images...");
      const api = requireAPI();
      const result = await api.scanFolder(state.selectedFolder);
      dispatch({ type: "LOAD_SCAN", payload: result });
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "healthy" });
      setResult(result);
      setStatus(`Scan complete. Found ${result.project_count} projects across ${result.image_count} images.`);
    } catch (error) {
      setStatus(error.message || "Scan failed.");
    } finally {
      setBusy(null);
    }
  }

  async function reviewOrganizePlan() {
    try {
      requireFolder(state.selectedFolder);
      setBusy("review");
      setStatus("Building dry-run organize plan...");
      const api = requireAPI();
      const result = await api.organizeDryRun(state.selectedFolder);
      if (!result.dry_run) {
        throw new Error("Backend returned a non-dry-run response.");
      }

      dispatch({
        type: "LOAD_PLAN",
        payload: {
          plan: result,
          summary: `Dry-run ready: ${result.operations.length} planned move(s) across ${result.project_count} project(s).`,
        },
      });
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "healthy" });
      setResult(result);
      if (result.operations.length === 0) {
        setStatus("Plan generated. No files need to be moved.");
      } else {
        setStatus(`Plan generated. Review ${result.operations.length} move(s), then approve.`);
      }
    } catch (error) {
      setStatus(error.message || "Dry-run plan failed.");
    } finally {
      setBusy(null);
    }
  }

  async function approvePlan() {
    try {
      requireFolder(state.selectedFolder);
      if (!state.pendingPlan) {
        throw new Error("Generate a review plan before approving.");
      }
      if (state.pendingPlan.folder_path !== state.selectedFolder) {
        throw new Error("Selected folder changed. Generate a new review plan.");
      }

      setBusy("approve");
      setStatus("Validating plan consistency before organize...");

      const api = requireAPI();
      const latestPlan = await api.organizeDryRun(state.selectedFolder);
      if (!latestPlan.dry_run) {
        throw new Error("Consistency check failed: backend returned non-dry-run response.");
      }

      const diff = computePlanDiff(state.pendingPlan.operations, latestPlan.operations);
      if (diff.hasDiff) {
        dispatch({
          type: "PLAN_DRIFT",
          payload: {
            latestPlan,
            diff,
            summary: `Plan changed since last review. ${latestPlan.operations.length} move(s) are currently planned.`,
          },
        });
        dispatch({ type: "SET_BACKEND_HEALTH", payload: "healthy" });
        setResult(latestPlan);
        setStatus("Plan changed since last review. Review changes and approve again.");
        return;
      }

      setStatus("Applying approved organize plan...");
      const result = await api.organizeFolder(state.selectedFolder);
      dispatch({
        type: "ORGANIZE_COMPLETE",
        payload: {
          result,
          summary: `Organize complete: moved ${result.operations.length} file(s) into ${result.project_count} project(s).`,
        },
      });
      dispatch({ type: "SET_BACKEND_HEALTH", payload: "healthy" });
      setResult(result);
      setStatus(`Organize complete. Moved ${result.operations.length} files into ${result.project_count} projects.`);
    } catch (error) {
      setStatus(error.message || "Organize failed.");
    } finally {
      setBusy(null);
    }
  }

  function discardPlan() {
    if (!state.pendingPlan) {
      setStatus("No pending plan to discard.");
      return;
    }

    dispatch({ type: "DISCARD_PLAN", payload: 'Plan discarded. Run "Review Organize Plan" to generate a new preview.' });
    setStatus("Pending review plan discarded.");
  }

  function onFilterChanged(event) {
    dispatch({ type: "SET_FILTER", payload: event.target.value });
  }

  function onProjectFilterChanged(event) {
    dispatch({ type: "SET_PROJECT_FILTER", payload: event.target.value });
  }

  function onPageSizeChanged(event) {
    const pageSize = Number.parseInt(event.target.value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) {
      return;
    }
    dispatch({ type: "SET_PAGE_SIZE", payload: pageSize });
  }

  function goToPrevPage() {
    if (currentPage <= 1) {
      return;
    }
    dispatch({ type: "SET_PAGE", payload: currentPage - 1 });
  }

  function goToNextPage() {
    if (currentPage >= totalPages) {
      return;
    }
    dispatch({ type: "SET_PAGE", payload: currentPage + 1 });
  }

  function toggleRawPayload() {
    dispatch({ type: "TOGGLE_RAW" });
  }

  const diff = state.planDiff;
  const lines = diff ? diffLines(diff) : [];
  const hasMoves = state.displayedOperations.length > 0;
  const healthLabel = backendHealthLabel(state.backendHealth);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>FrameSort</h1>
          <p className="subtitle">Review-first photo organization workflow</p>
        </div>
        <div className="topbar-right">
          <div className={`health-chip ${state.backendHealth}`}>Backend: {healthLabel}</div>
          <button onClick={() => refreshBackendHealth(false)} disabled={isBusy}>Refresh Backend</button>
        </div>
      </header>

      <div className="actions">
        <button onClick={selectFolder} disabled={isBusy}>Select Folder</button>
        <button onClick={scanFolder} disabled={!canScan}>Scan Folder</button>
        <button onClick={reviewOrganizePlan} disabled={!canReview}>Review Organize Plan</button>
      </div>

      <div id="folder" className="folder-path">{state.selectedFolder || "No folder selected."}</div>
      <div id="status" className="status-line">{state.statusMessage}</div>

      <section className="panel" id="scan-panel">
        <h2>Scan Insights</h2>
        <div className="scan-summary">
          {state.scanResult
            ? `Last scan: ${state.scanResult.project_count} project(s), ${state.scanResult.image_count} image(s).`
            : DEFAULT_SCAN_SUMMARY}
        </div>

        {state.scanResult ? (
          <>
            <div className="kpi-grid">
              <article className="kpi-card">
                <div className="kpi-label">Projects</div>
                <div className="kpi-value">{state.scanResult.project_count}</div>
              </article>
              <article className="kpi-card">
                <div className="kpi-label">Images</div>
                <div className="kpi-value">{state.scanResult.image_count}</div>
              </article>
              <article className="kpi-card">
                <div className="kpi-label">Categories</div>
                <div className="kpi-value">{categorySummary.length}</div>
              </article>
            </div>

            {categorySummary.length > 0 ? (
              <div className="category-row">
                {categorySummary.map(([category, count]) => (
                  <span key={category} className="category-pill">{category}: {count}</span>
                ))}
              </div>
            ) : null}

            <div className="table-tools">
              <input
                placeholder="Filter projects by name, category, or date"
                value={state.projectFilter}
                onChange={onProjectFilterChanged}
                disabled={scanProjects.length === 0}
              />
            </div>

            {filteredProjects.length === 0 ? (
              <div className="note">No projects match the current filter.</div>
            ) : (
              <div className="project-layout">
                <div className="move-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Images</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map((project) => (
                        <tr
                          key={project.name}
                          className={project.name === state.selectedProjectName ? "row-selected" : ""}
                          onClick={() => dispatch({ type: "SELECT_PROJECT", payload: project.name })}
                        >
                          <td>{project.name}</td>
                          <td>{project.category}</td>
                          <td>{project.capture_date}</td>
                          <td>{project.image_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <aside className="project-detail">
                  <h3>Project Detail</h3>
                  {selectedProject ? (
                    <>
                      <div className="detail-meta">{selectedProject.name}</div>
                      <div className="detail-meta">Category: {selectedProject.category}</div>
                      <div className="detail-meta">Capture Date: {selectedProject.capture_date}</div>
                      <div className="detail-meta">Images: {selectedProject.image_count}</div>

                      <div className="move-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>File</th>
                              <th>Category</th>
                              <th>Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProject.images.slice(0, IMAGE_PREVIEW_LIMIT).map((image, index) => (
                              <tr key={`${selectedProject.name}:${image.source_path}:${index}`}>
                                <td>{index + 1}</td>
                                <td>{image.file_name}</td>
                                <td>{image.category}</td>
                                <td>{image.source_path}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {selectedProject.images.length > IMAGE_PREVIEW_LIMIT ? (
                        <div className="note">Showing first {IMAGE_PREVIEW_LIMIT} image(s) from this project.</div>
                      ) : null}
                    </>
                  ) : (
                    <div className="note">Select a project to inspect image details.</div>
                  )}
                </aside>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section id="review-panel" className="panel">
        <h2>Review Plan</h2>
        <div id="review-summary">{state.reviewSummary}</div>

        <div className="review-actions">
          <button id="approve-button" onClick={approvePlan} disabled={!canApprove}>Approve Plan & Organize</button>
          <button id="discard-button" onClick={discardPlan} disabled={!canDiscard}>Discard Plan</button>
        </div>

        <div className="table-tools">
          <input
            id="move-filter"
            placeholder="Filter source, target, or status"
            value={state.moveFilter}
            onChange={onFilterChanged}
            disabled={!hasMoves}
          />
          <label>
            Rows:
            <select id="page-size" value={state.pageSize} onChange={onPageSizeChanged} disabled={!hasMoves}>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <button id="prev-page" onClick={goToPrevPage} disabled={!hasMoves || currentPage <= 1}>Prev</button>
          <button id="next-page" onClick={goToNextPage} disabled={!hasMoves || currentPage >= totalPages}>Next</button>
          <span id="page-info" className="page-info">Page {currentPage}/{totalPages}</span>
        </div>

        {diff ? (
          <div id="plan-diff-warning">
            <div className="diff-title">Plan drift detected before approval</div>
            <div className="diff-summary">
              Added: {diff.added.length} | Removed: {diff.removed.length} | Re-targeted: {diff.retargeted.length}
            </div>
            <div className="diff-lines">{lines.join("\n")}</div>
          </div>
        ) : null}

        {!hasMoves ? (
          <div className="note">No file moves are needed.</div>
        ) : (
          <>
            <div className="move-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((move, index) => (
                    <tr key={`${move.source_path}:${move.target_path}:${index}`}>
                      <td>{start + index + 1}</td>
                      <td>{move.status}</td>
                      <td>{move.source_path}</td>
                      <td>{move.target_path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note">
              Showing {pageRows.length} of {filteredOperations.length} filtered move(s), {state.displayedOperations.length} total.
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="raw-header">
          <h2>Raw Payload</h2>
          <button onClick={toggleRawPayload}>{state.showRawPayload ? "Hide" : "Show"} JSON</button>
        </div>

        {state.showRawPayload ? <pre>{state.resultText}</pre> : <div className="note">Raw payload is hidden.</div>}
      </section>
    </div>
  );
}
