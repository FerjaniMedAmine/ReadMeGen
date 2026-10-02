import { useState } from "react";
import PropTypes from "prop-types";
import "./FileUpload.css";

function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function FileUpload({ file, onFileSelected, onInvalidFile, disabled, onClear }) {
  const [dragging, setDragging] = useState(false);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      onInvalidFile("Please choose a ZIP archive.");
      return;
    }
    onFileSelected(selectedFile);
  };

  if (file) {
    return (
      <div className="selected-file">
        <div className="file-info">
          <span className="file-badge" aria-hidden="true">ZIP</span>
          <div>
            <strong title={file.name}>{file.name}</strong>
            <span className="file-status">{formatSize(file.size)} · Ready to import</span>
          </div>
        </div>
        <button type="button" className="text-button" onClick={onClear} disabled={disabled}>Remove</button>
        {file.size < 256 && <p className="file-warning">This archive is very small. Check that it contains your project files.</p>}
      </div>
    );
  }

  return (
    <label className={`file-dropzone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) selectFile(event.dataTransfer.files[0]);
      }}>
      <input id="project-zip" type="file" accept=".zip,application/zip"
        onChange={(event) => selectFile(event.target.files[0])} disabled={disabled} />
      <span className="upload-symbol" aria-hidden="true">ZIP</span>
      <strong>Choose a ZIP file or drag it here</strong>
      <span>Include the project files and folders in the archive.</span>
    </label>
  );
}

FileUpload.propTypes = {
  file: PropTypes.shape({ name: PropTypes.string, size: PropTypes.number }),
  onFileSelected: PropTypes.func.isRequired,
  onInvalidFile: PropTypes.func.isRequired,
  disabled: PropTypes.bool.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default FileUpload;
