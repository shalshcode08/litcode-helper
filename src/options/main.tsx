import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DuplicateMode, Settings } from "../shared/types";
import "../ui/styles.css";

const defaultSettings: Settings = {
  owner: "",
  repo: "leetcode-helper",
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

  async function resetSettings() {
    const confirmed = window.confirm("Reset local Litcode Helper settings and clear the upload queue?");
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await chrome.runtime.sendMessage({ type: "RESET_SETTINGS" });
      if (!response?.ok) {
        throw new Error(response?.error || "Could not reset settings.");
      }
      setSettings(defaultSettings);
      setMessage("Settings reset.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function openTokenPage() {
    window.open(
      "https://github.com/settings/personal-access-tokens/new?name=Litcode%20Helper&description=LeetCode%20solution%20logger&contents=write",
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openRepoPage() {
    window.open(
      "https://github.com/new?name=leetcode-helper&description=LeetCode%20solutions%20logged%20by%20Litcode%20Helper&visibility=private&auto_init=1",
      "_blank",
      "noopener,noreferrer"
    );
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

        <section className="surface setup-card">
          <div>
            <h2>GitHub Setup</h2>
            <p className="muted">
              Use one repo named <span className="mono">leetcode-helper</span> for your solution log.
            </p>
          </div>
          <ol className="steps">
            <li>Create a GitHub repo named leetcode-helper.</li>
            <li>
              Turn on <strong>Add a README file</strong> while creating the repo.
            </li>
            <li>Create a fine-grained token for that repo.</li>
            <li>Set Contents to Read and write.</li>
            <li>Paste the token below, then test GitHub.</li>
          </ol>
          <div className="setup-actions">
            <button className="button secondary" type="button" onClick={openRepoPage}>
              1. Create repo
            </button>
            <button className="button secondary" type="button" onClick={openTokenPage}>
              2. Create token
            </button>
          </div>
        </section>

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
                placeholder="leetcode-helper"
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
            <span className="field-hint">
              The token must be fine-grained, repo-limited, and allowed to read/write Contents.
            </span>
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
            Important: check <strong>Add a README file</strong> on GitHub’s new repo page. Without a
            README, GitHub may not create the <span className="mono">main</span> branch, and uploads
            will fail.
          </section>

          <div className="actions">
            <button className="button" disabled={busy} type="submit">
              Save settings
            </button>
            <button className="button secondary" disabled={busy} type="button" onClick={testGitHub}>
              Test GitHub
            </button>
            <button className="button danger" disabled={busy} type="button" onClick={resetSettings}>
              Reset settings
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
