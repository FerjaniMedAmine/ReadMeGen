import { useEffect, useRef, useState } from "react";
import FileUpload from "../components/FileUpload";
import GitUrlInput from "../components/GitUrlInput";
import projectService from "../services/projectService";
import "./Home.css";

const STATUS_LABELS = {
  extracting: "Preparing project files",
  filtering: "Identifying relevant source files",
  planning: "Planning the documentation",
  analyzing: "Reading project files",
  writing: "Writing your README",
  ready: "README ready",
};

const STATUS_STEPS = ["Import", "Analyze", "Write"];
const POLL_INTERVAL_MS = 2500;

function Home() {
  const [sourceType, setSourceType] = useState("zip");
  const [file, setFile] = useState(null);
  const [gitUrl, setGitUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [readme, setReadme] = useState("");
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (id) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const status = await projectService.getStatus(id);
        setStatusInfo(status);

        if (status.status === "ready") {
          stopPolling();
          setReadme(await projectService.getReadme(id));
        } else if (status.status === "error") {
          stopPolling();
          setError(status.detail || "Project processing failed.");
        }
      } catch (pollError) {
        console.error(pollError);
        stopPolling();
        setError("Connection lost while checking project status. Please try again.");
      }
    }, POLL_INTERVAL_MS);
  };

  const changeSourceType = (type) => {
    if (loading) return;
    setSourceType(type);
    setFile(null);
    setGitUrl("");
    setError("");
  };

  const handleStartOver = () => {
    stopPolling();
    setSourceType("zip");
    setFile(null);
    setGitUrl("");
    setError("");
    setProjectId(null);
    setStatusInfo(null);
    setReadme("");
    setCopied(false);
  };

  const handleDownloadReadme = () => {
    const url = URL.createObjectURL(new Blob([readme], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "README.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleCopyReadme = async () => {
    try {
      await navigator.clipboard.writeText(readme);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy the README. You can download it instead.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (sourceType === "zip" && !file) {
      setError("Choose a ZIP archive to continue.");
      return;
    }
    if (sourceType === "git" && !gitUrl.trim()) {
      setError("Enter a Git repository URL to continue.");
      return;
    }

    try {
      setLoading(true);
      const project = sourceType === "zip"
        ? await projectService.uploadZip(file)
        : await projectService.importGit(gitUrl.trim());
      setProjectId(project.project_id);
      startPolling(project.project_id);
    } catch (importError) {
      console.error(importError);
      const detail = importError.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "The project could not be imported. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = Boolean(projectId) && !readme && !error;
  const currentStep = ["extracting", "filtering"].includes(statusInfo?.status)
    ? 0
    : ["planning", "analyzing"].includes(statusInfo?.status)
      ? 1
      : statusInfo?.status === "writing" ? 2 : 0;

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand" aria-label="ReadMeGen home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>ReadMeGen</span>
        </div>
        <span className="header-label">PROJECT DOCUMENTATION</span>
      </header>

      {!projectId && (
        <section className="workspace">
          <div className="intro-panel">
            <span className="eyebrow">README GENERATOR</span>
            <h1>Better documentation starts with your code.</h1>
            <p className="intro-copy">
              Turn an existing project into a clear, structured README. Import your source,
              let focused agents inspect it, and review a draft you can use right away.
            </p>
            <div className="workflow-list" aria-label="How it works">
              <div className="workflow-item"><span>01</span><p><strong>Import</strong> a ZIP archive or Git repository.</p></div>
              <div className="workflow-item"><span>02</span><p><strong>Analyze</strong> the project&apos;s key files.</p></div>
              <div className="workflow-item"><span>03</span><p><strong>Review</strong> and download your README.</p></div>
            </div>
          </div>

          <section className="surface import-surface" aria-labelledby="import-title">
            <div className="surface-heading">
              <span className="section-kicker">NEW PROJECT</span>
              <h2 id="import-title">Import your project</h2>
              <p>Choose how you want to provide the source code.</p>
            </div>

            <div className="source-tabs" aria-label="Project source">
              <button type="button" className={sourceType === "zip" ? "source-tab active" : "source-tab"}
                aria-pressed={sourceType === "zip"} onClick={() => changeSourceType("zip")}>
                ZIP archive
              </button>
              <button type="button" className={sourceType === "git" ? "source-tab active" : "source-tab"}
                aria-pressed={sourceType === "git"} onClick={() => changeSourceType("git")}>
                Git repository
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {sourceType === "zip" ? (
                <div className="source-content">
                  <div className="field-heading">
                    <label htmlFor="project-zip">Project archive</label>
                    <span>ZIP, up to 50 MB</span>
                  </div>
                  <FileUpload file={file} onFileSelected={(selected) => { setFile(selected); setError(""); }}
                    onInvalidFile={setError} disabled={loading} onClear={() => { setFile(null); setError(""); }} />
                  <p className="field-note">The archive must include the files inside your project folder. Archives containing only an empty folder cannot be analyzed.</p>
                </div>
              ) : (
                <div className="source-content">
                  <div className="field-heading">
                    <label htmlFor="git-url">Repository URL</label>
                    <span>Public HTTPS repository</span>
                  </div>
                  <GitUrlInput value={gitUrl} onChange={(value) => { setGitUrl(value); setError(""); }}
                    disabled={loading} onClear={() => { setGitUrl(""); setError(""); }} />
                  <p className="field-note">GitHub, GitLab, and Bitbucket URLs are supported.</p>
                </div>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}
              <button className="primary-button" type="submit"
                disabled={loading || (sourceType === "zip" ? !file : !gitUrl.trim())}>
                {loading ? "Importing project..." : "Generate README"}
              </button>
            </form>
            <p className="privacy-note">Selected source files are sent to the configured AI model for analysis.</p>
          </section>
        </section>
      )}

      {isProcessing && (
        <section className="surface progress-surface" aria-live="polite">
          <span className="section-kicker">IN PROGRESS</span>
          <h1>Creating your README</h1>
          <p className="progress-description">{STATUS_LABELS[statusInfo?.status] || "Starting project analysis"}</p>
          <ol className="progress-list">
            {STATUS_STEPS.map((step, index) => (
              <li key={step} className={index < currentStep ? "step complete" : index === currentStep ? "step current" : "step"}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="progress-track"><span style={{ width: `${(currentStep + 1) * 33.33}%` }} /></div>
          <div className="progress-meta">
            {statusInfo?.file_count != null && <span>{statusInfo.file_count} files found</span>}
            {statusInfo?.agent_count != null && <span>{statusInfo.agent_count} specialist agents</span>}
          </div>
        </section>
      )}

      {projectId && error && (
        <section className="surface state-surface">
          <span className="section-kicker">PROCESSING STOPPED</span>
          <h1>We could not finish this README</h1>
          <p className="error-message" role="alert">{error}</p>
          <button className="secondary-button" type="button" onClick={handleStartOver}>Try another project</button>
        </section>
      )}

      {readme && (
        <section className="result-layout">
          <div className="result-heading">
            <div>
              <span className="section-kicker">READY TO REVIEW</span>
              <h1>Your README is ready</h1>
              <p>Review the draft, then copy or download the Markdown file.</p>
            </div>
            <div className="result-actions">
              <button className="secondary-button" type="button" onClick={handleStartOver}>New project</button>
              <button className="secondary-button" type="button" onClick={handleCopyReadme}>{copied ? "Copied" : "Copy text"}</button>
              <button className="primary-button" type="button" onClick={handleDownloadReadme}>Download README.md</button>
            </div>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="surface preview-surface">
            <div className="preview-heading"><span>README.md</span><span>MARKDOWN PREVIEW</span></div>
            <pre className="readme-preview">{readme}</pre>
          </div>
        </section>
      )}
    </main>
  );
}

export default Home;
