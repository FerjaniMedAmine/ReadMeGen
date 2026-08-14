import "./FileUpload.css";
function FileUpload({
  file,
  onFileSelected,
  disabled,
  onClear,
}) {
  const handleChange = (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      alert("Please select a ZIP file.");
      return;
    }

    onFileSelected(selectedFile);
  };

  if (file) {
    return (
      <div className="selected-file">
        <div className="file-info">
          <span className="file-icon">ZIP</span>

          <div>
            <strong>{file.name}</strong>
            <span className="file-status">
              Ready to import
            </span>
          </div>
        </div>

        <button
          type="button"
          className="clear-button"
          onClick={onClear}
          disabled={disabled}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <label
      className={`file-dropzone ${
        disabled ? "file-dropzone-disabled" : ""
      }`}
    >
      <input
        type="file"
        accept=".zip"
        onChange={handleChange}
        disabled={disabled}
      />

      <span className="upload-icon">+</span>

      <strong>Choose a ZIP file</strong>

      <span>
        {disabled
          ? "Clear the Git URL to use ZIP upload"
          : "ZIP archives only"}
      </span>
    </label>
  );
}

export default FileUpload;