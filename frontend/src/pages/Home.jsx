import { useState } from "react";
import FileUpload from "../components/FileUpload";
import GitUrlInput from "../components/GitUrlInput";
import projectService from "../services/projectService";
import "./Home.css";

function Home() {
  const [file, setFile] = useState(null);
  const [gitUrl, setGitUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setGitUrl("");
    setError("");
  };

  const handleGitUrlChange = (value) => {
    setGitUrl(value);

    // If the user starts using Git import,
    // remove the previously selected ZIP.
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

      console.log("Project created:", project);

      // Later:
      // navigate(`/projects/${project.project_id}`);
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
    </main>
  );
}

export default Home;