import "./GitUrlInput.css";
function GitUrlInput({value,onChange,disabled,onClear,}) {
  return (
    <div className="git-input-container">
      <div className="git-input-wrapper">
        <input
          id="git-url"
          type="url"
          placeholder="https://github.com/user/project"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />

        {value && (
          <button
            type="button"
            className="input-clear-button"
            onClick={onClear}
            disabled={disabled}
            aria-label="Clear Git URL"
          >
            ×
          </button>
        )}
      </div>

      {disabled && (
        <span className="input-hint">
          Remove the ZIP file to use Git import
        </span>
      )}
    </div>
  );
}

export default GitUrlInput;