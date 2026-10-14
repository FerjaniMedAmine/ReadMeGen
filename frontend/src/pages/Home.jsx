import { useEffect, useRef, useState } from "react";
import FileUpload from "../components/FileUpload";
import GitUrlInput from "../components/GitUrlInput";
import projectService from "../services/projectService";
import ConnectionPanel from "../components/ConnectionPanel";
import Icon from "../components/Icon";
import MarkdownDocument from "../components/MarkdownDocument";
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
  const [connectionReady, setConnectionReady] = useState(false);
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
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!projectId) return undefined;
    let stopped = false;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const status = await projectService.getStatus(projectId, controller.signal);
        if (stopped) return;
        setStatusInfo(status);
        if (status.status === "ready") {
          const result = await projectService.getReadme(projectId, controller.signal);
          if (!stopped) setReadme(result);
          return;
        }
        if (status.status === "error") {
          setError(status.detail || "Project processing failed.");
          return;
        }
        pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!stopped) setError("Connection lost while checking progress. Restart the interface and try again.");
      }
    };
    poll();
    return () => {
      stopped = true;
      controller.abort();
      stopPolling();
    };
  }, [projectId]);

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

    if (!connectionReady) {
      setError("Connect a provider and choose a model before generating.");
      return;
    }
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

    } catch (importError) {
      setError(importError.message || "The project could not be imported. Please try again.");
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
          <span className="brand-mark"><Icon name="document" size={21} /></span>
          <span>ReadMeGen<span className="brand-tag">workspace</span></span>
        </div>
        <nav className="header-nav" aria-label="Main navigation">
          <span className="local-badge"><span />Local workspace</span>
          <a href="https://github.com/FerjaniMedAmine/ReadMeGen" target="_blank" rel="noopener noreferrer">GitHub <Icon name="external" size={14} /></a>
        </nav>
      </header>

        <section className={projectId ? "connection-wrap" : "workspace"} aria-label="Project workspace">
          {!projectId && (
          <div className="intro-panel">
            <span className="eyebrow"><span /> A GOOD README GOES A LONG WAY</span>
            <h1>Your code.<br />A clearer <em>story.</em></h1>
            <p className="intro-copy">
              Give your project the introduction it deserves. Turn your source code into thoughtful documentation, ready for your next reader.
            </p>
            <div className="workflow-list" aria-label="How it works">
              <div className="workflow-item"><span><Icon name="upload" /></span><p><strong>Bring your code</strong>Upload an archive or paste a repository.</p></div>
              <div className="workflow-item"><span><Icon name="sparkle" /></span><p><strong>Let the details connect</strong>Focused agents read your project files.</p></div>
              <div className="workflow-item"><span><Icon name="document" /></span><p><strong>Make it yours</strong>Review a formatted draft, then export.</p></div>
            </div>
            <div className="document-sample" aria-hidden="true">
              <div className="sample-toolbar"><span className="sample-dots"><i /><i /><i /></span><span>README.md</span><span className="sample-ready"><Icon name="check" size={12} /> Well documented</span></div>
              <div className="sample-body"><Icon name="document" size={26} /><div><strong>From source to first impression.</strong><p>Overview. Installation. Usage. All in one place.</p></div></div>
            </div>
          </div>
          )}

          <div className="builder-column">
          <ConnectionPanel onReady={setConnectionReady} disabled={loading || isProcessing} />
          {!projectId && (
          <section className="surface import-surface" aria-labelledby="import-title">
            <div className="surface-heading">
              <span className="section-kicker">THE START OF SOMETHING CLEAR</span>
              <h2 id="import-title">Meet your next README.</h2>
              <p>Start with the code. We&apos;ll help with the words.</p>
            </div>

            <div className="source-tabs" aria-label="Project source">
              <button type="button" className={sourceType === "zip" ? "source-tab active" : "source-tab"}
                aria-pressed={sourceType === "zip"} onClick={() => changeSourceType("zip")}>
                <Icon name="upload" size={16} /> ZIP archive
              </button>
              <button type="button" className={sourceType === "git" ? "source-tab active" : "source-tab"}
                aria-pressed={sourceType === "git"} onClick={() => changeSourceType("git")}>
                <Icon name="git" size={16} /> Git repository
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
                  <p className="field-note">Include your source files. Dependencies and build folders can stay behind.</p>
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
                disabled={!connectionReady || loading || (sourceType === "zip" ? !file : !gitUrl.trim())}>
                <Icon name="sparkle" size={17} />{loading ? "Importing project…" : "Generate README"}<Icon name="arrow" size={17} />
              </button>
            </form>
            <p className="privacy-note"><Icon name="lock" size={13} /> Selected files are sent to your chosen AI provider.</p>
          </section>
          )}
          </div>
        </section>

      {isProcessing && (
        <section className="surface progress-surface" aria-live="polite">
          <span className="progress-orbit"><Icon name="sparkle" size={26} /></span>
          <span className="section-kicker">GOOD DOCUMENTATION TAKES A LITTLE READING</span>
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

      {projectId && error && !readme && (
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
              <span className="section-kicker result-kicker"><Icon name="check" size={15} /> READY FOR YOUR NEXT READER</span>
              <h1>Your README is ready</h1>
              <p>Here&apos;s your first draft. Give it a read and make it your own.</p>
            </div>
            <div className="result-actions">
              <button className="text-button" type="button" onClick={handleStartOver}><Icon name="plus" size={16} /> New project</button>
              <button className="secondary-button" type="button" onClick={handleCopyReadme}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Copied!" : "Copy Markdown"}</button>
              <button className="primary-button" type="button" onClick={handleDownloadReadme}><Icon name="download" size={16} /> Download .md</button>
            </div>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="surface preview-surface">
            <div className="preview-heading"><span><Icon name="document" size={16} /> README.md</span><span className="preview-badge">Formatted preview</span></div>
            <article className="readme-preview" aria-label="Formatted README"><MarkdownDocument content={readme} /></article>
          </div>
          <p className="preview-note">A polished preview, a portable file. Copy and download preserve the original Markdown.</p>
        </section>
      )}
      <footer className="site-footer"><span>Made from your code. Written for people.</span><span>ReadMeGen <span aria-hidden="true">/</span> Documentation, thoughtfully.</span></footer>
    </main>
  );
}

export default Home;
