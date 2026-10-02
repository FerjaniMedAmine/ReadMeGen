import PropTypes from "prop-types";
import "./GitUrlInput.css";

function GitUrlInput({ value, onChange, disabled, onClear }) {
  return (
    <div className="git-input-wrapper">
      <input id="git-url" type="url" placeholder="https://github.com/owner/project"
        value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      {value && <button type="button" className="input-clear-button" onClick={onClear}
        disabled={disabled} aria-label="Clear repository URL">Clear</button>}
    </div>
  );
}

GitUrlInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default GitUrlInput;
