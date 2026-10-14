import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { request } from "../services/api";
import Icon from "./Icon";
import "./ConnectionPanel.css";

const preferences = (connection, model = connection.model) => ({
  auth_mode: connection.auth_mode,
  provider: connection.provider,
  profile_id: connection.profile_id,
  model,
  max_agents: connection.max_agents || 8,
  max_agent_files: connection.max_agent_files || 12,
  generation_timeout: connection.generation_timeout || 900,
});

const errorMessage = (error) => error.message || "Could not connect. Check that the local server is running.";

function ConnectionPanel({ onReady, disabled }) {
  const [connection, setConnection] = useState(null);
  const [mode, setMode] = useState("api-key");
  const [provider, setProvider] = useState("gemini");
  const [key, setKey] = useState("");
  const [save, setSave] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [profileId, setProfileId] = useState("");
  const [login, setLogin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshModels = useCallback(async () => {
    try {
      const response = await request("/models");
      setModels(response);
    } catch (failure) {
      setModels([]);
      setNotice(errorMessage(failure));
    }
  }, []);

  const refresh = useCallback(async () => {
    const response = await request("/connection");
    const current = response;
    setConnection(current);
    setMode(current.auth_mode);
    setProvider(current.provider);
    setModel(current.model);
    setProfileId(current.profile_id || "");
    return current;
  }, []);

  useEffect(() => {
    let mounted = true;
    refresh().then((current) => {
      if (mounted && current.connected) refreshModels();
    }).catch((failure) => { if (mounted) setError(errorMessage(failure)); });
    return () => { mounted = false; };
  }, [refresh, refreshModels]);

  useEffect(() => {
    onReady(Boolean(connection?.connected && connection.model && !busy && !login));
  }, [connection, onReady, busy, login]);

  useEffect(() => {
    if (!login) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const response = await request(`/auth/chatgpt/${login.login_id}`);
        if (stopped) return;
        if (response.status === "connected") {
          setLogin(null);
          await refresh();
          await refreshModels();
          setNotice("ChatGPT connected. Choose a model to continue.");
        } else {
          timer = setTimeout(poll, 1200);
        }
      } catch (failure) {
        if (!stopped) { setError(errorMessage(failure)); setLogin(null); }
      }
    };
    timer = setTimeout(poll, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [login, refresh, refreshModels]);

  const connect = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "chatgpt") {
        const response = await request("/auth/chatgpt", { method: "POST", body: { profile_id: profileId || null, save_session: save } });
        setLogin(response);
        window.open(response.url, "_blank", "noopener,noreferrer");
      } else {
        const response = await request("/connection", { method: "PUT", body: {
          auth_mode: "api-key", provider, model: "", api_key: key || null, save_key: save,
        } });
        setConnection(response); setModel(""); setKey("");
        await refreshModels();
        setNotice("Choose a model with tool-calling support. Catalog availability does not guarantee access.");
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const saveModel = async () => {
    setBusy(true); setError("");
    try {
      const response = await request("/connection", { method: "PUT", body: preferences(connection, model.trim()) });
      setConnection(response);
      setNotice("Model saved. You can now generate a README.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError("");
    try {
      const response = await request("/connection", { method: "DELETE" });
      await refresh(); setModels([]);
      setNotice(response.remote_revocation_confirmed
        ? "Saved credentials cleared. Environment variables can still provide a connection."
        : "Local credentials cleared. Remote revocation was not confirmed; disconnect ReadMeGen in ChatGPT settings.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  return (
    <details className="surface connection-panel" open={Boolean(error || login || (connection?.connected && !connection.model)) || undefined}>
      <summary><span className="connection-label"><span className="connection-icon"><Icon name="sparkle" size={16} /></span><span>AI connection<small>{connection?.connected
        ? `${connection.auth_mode === "chatgpt" ? "ChatGPT" : connection.provider} · ${connection.model || "Choose a model"}`
        : "Bring your provider. Choose your model."}</small></span></span><span className="connection-summary-end"><span className={`connection-badge${connection?.connected && connection.model ? " connected" : ""}`}>{connection?.connected && connection.model ? "Connected" : "Set up"}</span><Icon className="connection-chevron" name="chevron" size={16} /></span></summary>
      <div className="connection-content">
        <form onSubmit={connect}>
          <fieldset disabled={disabled || busy || Boolean(login)}>
            <label>Authentication
              <select value={mode} onChange={(event) => { setMode(event.target.value); setError(""); }}>
                <option value="api-key">API key</option>
                <option value="chatgpt">Sign in with ChatGPT</option>
              </select>
            </label>
            {mode === "api-key" ? <>
              <label>Provider
                <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>
              <label>API key
                <input type="password" autoComplete="off" spellCheck="false" value={key}
                  placeholder="Your provider API key"
                  onChange={(event) => setKey(event.target.value)} />
              </label>
            </> : <>
              <p>Authorize ReadMeGen in your browser to use your eligible ChatGPT plan. Requests count toward your plan limits.</p>
              <label>ChatGPT account
                <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                  <option value="">Add an account or workspace</option>
                  {connection?.profiles?.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
            </>}
            <label className="credential-choice"><input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} />
              Save credentials in the OS credential store
            </label>
            <p className="field-note">Without saving, credentials last until this ReadMeGen session closes.</p>
            <button className="secondary-button" type="submit">{busy ? "Connecting…" : mode === "chatgpt" ? "Continue with ChatGPT" : "Connect provider"}</button>
          </fieldset>
        </form>
        {login && <div className="login-pending" aria-live="polite">
          <p>Finish sign-in in your browser. <a href={login.url} target="_blank" rel="noreferrer">Open sign-in</a></p>
          <button className="text-button" type="button" onClick={async () => {
            try { await request(`/auth/chatgpt/pending/${login.login_id}`, { method: "DELETE" }); setLogin(null); }
            catch (failure) { setError(errorMessage(failure)); }
          }}>Cancel sign-in</button>
        </div>}
        {connection?.connected && <div className="model-picker">
          <label>Model for {connection.auth_mode === "chatgpt" ? "ChatGPT" : connection.provider}
            <input list="available-models" value={model} onChange={(event) => setModel(event.target.value)}
              placeholder="Choose a model or enter its ID" disabled={disabled || busy || Boolean(login)} />
            <datalist id="available-models">{models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</datalist>
          </label>
          <div className="connection-actions">
            <button className="secondary-button" type="button" onClick={saveModel} disabled={disabled || busy || !model.trim() || Boolean(login)}>Save model</button>
            <button className="text-button" type="button" onClick={refreshModels} disabled={disabled || busy}>Refresh models</button>
            <button className="text-button" type="button" onClick={disconnect} disabled={disabled || busy}>Disconnect</button>
          </div>
          {connection.auth_mode === "chatgpt" && <p className="field-note"><a href="https://chatgpt.com/#settings/Usage" target="_blank" rel="noreferrer">Manage ChatGPT usage and limits</a></p>}
        </div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {notice && <p className="field-note" role="status">{notice}</p>}
      </div>
    </details>
  );
}

ConnectionPanel.propTypes = { onReady: PropTypes.func.isRequired, disabled: PropTypes.bool.isRequired };
export default ConnectionPanel;
