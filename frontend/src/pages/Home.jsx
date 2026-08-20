import { useEffect, useRef, useState } from "react";
import FileUpload from "../components/FileUpload";
import GitUrlInput from "../components/GitUrlInput";
import projectService from "../services/projectService";
import "./Home.css";

const STATUS_LABELS = {
  extracting: "Extracting project files...",
  filtering: "Filtering relevant files...",
  indexing: "Indexing code...",
  generating_readme: "Generating documentation...",
  ready: "Done!",
};

const POLL_INTERVAL_MS = 2500;

function Home() {
  const [file, setFile] = useState(null);
  const [gitUrl, setGitUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [projectId, setProjectId] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [readme, setReadme] = useState("");

  const pollingRef = useRef(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const startPolling = (id) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const status = await projectService.getStatus(id);
        setStatusInfo(status);

        if (status.status === "ready") {
          stopPolling();
          const readmeContent = await projectService.getReadme(id);
          setReadme(readmeContent);
        } else if (status.status === "error") {
          stopPolling();
          setError(status.detail || "Project processing failed.");
        }
      } catch (pollError) {
        console.error(pollError);
        stopPolling();
        setError("Lost connection while checking project status.");
      }
    }, POLL_INTERVAL_MS);
  };

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setGitUrl("");
    setError("");
  };

  const handleGitUrlChange = (value) => {
    setGitUrl(value);

    if (value.trim()) {
      setFile(null);
    }

    setError("");
  };

  const handleClearFile = () => {
    setFile(null);
    setError("");
  };

  const handleClearGitUrl = () => {
    setGitUrl("");
    setError("");
  };

  const handleStartOver = () => {
    stopPolling();
    setFile(null);
    setGitUrl("");
    setError("");
    setProjectId(null);
    setStatusInfo(null);
    setReadme("");
  };

  const handleDownloadReadme = () => {
    const blob = new Blob([readme], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "README.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!file && !gitUrl.trim()) {
      setError(
        "Please upload a ZIP file or provide a Git repository URL."
      );
      return;
    }

    try {
      setLoading(true);

      let project;

      if (file) {
        project = await projectService.uploadZip(file);
      } else {
        project = await projectService.importGit(gitUrl.trim());
      }

      setProjectId(project.project_id);
      startPolling(project.project_id);
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.detail ||
          "Something went wrong while importing the project."
      );
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = Boolean(projectId) && !readme && !error;

  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>DocuGen</h1>

          <p className="hero-description">
            Generate technical documentation automatically
            from your software project.
          </p>
        </div>
      </section>

      {!projectId && (
        <section className="import-card">
          <div className="card-header">
            <h2>Import your project</h2>
            <p>
              Upload a ZIP archive or import a Git repository.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="import-option">
              <h3>ZIP archive</h3>

              <FileUpload
                file={file}
                onFileSelected={handleFileSelected}
                disabled={Boolean(gitUrl.trim()) || loading}
                onClear={handleClearFile}
              />
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <div className="import-option">
              <h3>Git repository</h3>

              <GitUrlInput
                value={gitUrl}
                onChange={handleGitUrlChange}
                disabled={Boolean(file) || loading}
                onClear={handleClearGitUrl}
              />
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={loading || (!file && !gitUrl.trim())}
            >
              {loading ? "Importing project..." : "Generate documentation"}
            </button>
          </form>
        </section>
      )}

      {isProcessing && (
        <section className="status-card">
          <h2>Processing your project</h2>
          <p className="status-step">
            {STATUS_LABELS[statusInfo?.status] || "Starting..."}
          </p>
          {statusInfo?.file_count != null && (
            <p className="status-detail">{statusInfo.file_count} files found</p>
          )}
          {statusInfo?.chunk_count != null && (
            <p className="status-detail">{statusInfo.chunk_count} chunks indexed</p>
          )}
        </section>
      )}

      {error && projectId && (
        <section className="status-card error-card">
          <h2>Something went wrong</h2>
          <p className="error-message" role="alert">{error}</p>
          <button className="submit-button" onClick={handleStartOver}>
            Try again
          </button>
        </section>
      )}

      {readme && (
        <section className="readme-card">
          <div className="card-header">
            <h2>Generated README</h2>
            <div className="readme-actions">
              <button className="submit-button" onClick={handleDownloadReadme}>
                Download README.md
              </button>
              <button className="secondary-button" onClick={handleStartOver}>
                Start over
              </button>
            </div>
          </div>
          <pre className="readme-content">{readme}</pre>
        </section>
      )}
    </main>
  );
}

export default Home;