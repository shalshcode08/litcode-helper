import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DuplicateMode, Settings } from "../shared/types";
import "../ui/styles.css";

const defaultSettings: Settings = {
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  timezone: "Asia/Kolkata",
  duplicateMode: "update"
};

function Options() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_DASHBOARD" })
      .then((dashboard) => {
        setSettings({
          ...defaultSettings,
          ...(dashboard?.settings ?? {})
        });
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_SETTINGS",
        settings
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Could not save settings.");
      }
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testGitHub() {
    setBusy(true);
    setMessage("");

    try {
      await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
      const response = await chrome.runtime.sendMessage({ type: "TEST_GITHUB" });
      if (!response?.ok) {
        throw new Error(response?.error || "GitHub test failed.");
      }
      setMessage(`Connected to ${response.result.repo}. Default branch: ${response.result.defaultBranch}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="options-panel stack">
        <header className="masthead">
          <div className="brand">
            <span className="mark">LH</span>
            <div>
              <h1>Litcode Helper</h1>
              <p className="muted">Configure the GitHub repo that receives your solved problems.</p>
            </div>
          </div>
        </header>

        <form className="surface stack" onSubmit={save}>
          <div className="grid">
            <label>
              <span className="label-text">GitHub owner</span>
              <input
                autoComplete="off"
                placeholder="your-username"
                value={settings.owner}
                onChange={(event) => update("owner", event.target.value)}
              />
            </label>

            <label>
              <span className="label-text">Repository</span>
              <input
                autoComplete="off"
                placeholder="leetcode-solutions-log"
                value={settings.repo}
                onChange={(event) => update("repo", event.target.value)}
              />
            </label>

            <label>
              <span className="label-text">Branch</span>
              <input
                autoComplete="off"
                placeholder="main"
                value={settings.branch}
                onChange={(event) => update("branch", event.target.value)}
              />
            </label>

            <label>
              <span className="label-text">Timezone</span>
              <input
                autoComplete="off"
                placeholder="Asia/Kolkata"
                value={settings.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              />
            </label>
          </div>

          <label>
            <span className="label-text">Fine-grained GitHub token</span>
            <input
              autoComplete="off"
              placeholder="github_pat_..."
              type="password"
              value={settings.token}
              onChange={(event) => update("token", event.target.value)}
            />
          </label>

          <label>
            <span className="label-text">Same problem on same day</span>
            <select
              value={settings.duplicateMode}
              onChange={(event) => update("duplicateMode", event.target.value as DuplicateMode)}
            >
              <option value="update">Update the existing file</option>
              <option value="skip">Keep the existing file</option>
              <option value="version">Create a numbered file</option>
            </select>
          </label>

          <div className="divider" />

          <section className="notice muted">
            Use a fine-grained token that can access only this repo and has Contents read/write
            permission. Create the repo with a README so the default branch exists.
          </section>

          <div className="actions">
            <button className="button" disabled={busy} type="submit">
              Save settings
            </button>
            <button className="button secondary" disabled={busy} type="button" onClick={testGitHub}>
              Test GitHub
            </button>
          </div>
        </form>

        {message ? <p className="surface muted">{message}</p> : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
