import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PageDiagnostic, Settings, UploadStatus } from "../shared/types";
import "../ui/styles.css";

type Dashboard = {
  settings: Settings;
  status: UploadStatus;
  queueCount: number;
  processedCount: number;
};

const fallbackStatus: UploadStatus = {
  state: "idle",
  message: "Waiting for an accepted LeetCode submission."
};

function Popup() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [diagnostic, setDiagnostic] = useState<PageDiagnostic | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await chrome.runtime.sendMessage({ type: "GET_DASHBOARD" });
    setDashboard(response);
  }

  useEffect(() => {
    void refresh();
    void checkPage(true);
  }, []);

  async function sendToActiveProblemTab(message: unknown) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id || !tab.url?.startsWith("https://leetcode.com/problems/")) {
      throw new Error("Open a LeetCode problem tab first.");
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("Receiving end does not exist")) {
        throw error;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      return chrome.tabs.sendMessage(tab.id, message);
    }
  }

  async function checkPage(silent = false) {
    setBusy(true);
    if (!silent) {
      setMessage("");
    }

    try {
      const response = await sendToActiveProblemTab({ type: "CHECK_PAGE" });
      if (!response?.ok) {
        throw new Error(response?.error || "Could not inspect this LeetCode page.");
      }
      setDiagnostic(response.diagnostic);
      if (!silent) {
        setMessage(
          `Page check passed: code ${response.diagnostic.codeLength} chars, statement ${response.diagnostic.statementLength} chars.`
        );
      }
    } catch (error) {
      setDiagnostic(null);
      if (!silent) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function manualSave() {
    setBusy(true);
    setMessage("");

    try {
      const response = await sendToActiveProblemTab({ type: "MANUAL_SAVE" });
      if (!response?.ok) {
        throw new Error(response?.error || "Manual save failed.");
      }

      setMessage("Saved. Check the status below.");
      await refresh();
      await checkPage();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function retryQueue() {
    setBusy(true);
    setMessage("");

    try {
      const response = await chrome.runtime.sendMessage({ type: "RETRY_QUEUE" });
      if (!response?.ok) {
        throw new Error(response?.error || "Retry failed.");
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  const status = dashboard?.status ?? fallbackStatus;
  const configured = Boolean(dashboard?.settings?.owner && dashboard?.settings?.repo);

  return (
    <main className="shell popup-shell">
      <section className="panel stack">
        <header className="masthead">
          <div className="brand">
            <span className="mark">LH</span>
            <div>
              <h1>Litcode Helper</h1>
              <p className="muted">LeetCode to GitHub logger</p>
            </div>
          </div>
        </header>

        <section className={`surface status ${status.state}`}>
          <strong>{status.state.toUpperCase()}</strong>
          <p className="muted">{status.message}</p>
          {status.path ? <p className="mono">{status.path}</p> : null}
        </section>

        {configured ? (
          <section className="surface stack">
            <div>
              <h2>
                {dashboard?.settings.owner}/{dashboard?.settings.repo}
              </h2>
              <p className="muted">
                Branch {dashboard?.settings.branch || "main"} · Queue {dashboard?.queueCount ?? 0}
              </p>
            </div>
            {diagnostic ? (
              <div className="notice muted">
                <p>
                  Page: <span className="mono">{diagnostic.slug}</span>
                </p>
                <p>
                  Code {diagnostic.codeLength} chars · Statement {diagnostic.statementLength} chars
                </p>
              </div>
            ) : null}
            <div className="actions">
              <button className="button" disabled={busy} onClick={manualSave}>
                Save current problem
              </button>
              <button className="button secondary" disabled={busy} onClick={() => checkPage()}>
                Check page
              </button>
              <button
                className="button secondary"
                disabled={busy || !dashboard?.queueCount}
                onClick={retryQueue}
              >
                Retry queue
              </button>
            </div>
          </section>
        ) : (
          <section className="surface stack">
            <div>
              <h2>Setup Required</h2>
              <p className="muted">Connect a GitHub repo before Litcode Helper can save solutions.</p>
            </div>
            <ol className="steps compact">
              <li>Create a repo named leetcode-helper with a README.</li>
              <li>Create a fine-grained token for that repo.</li>
              <li>Paste the token in settings and test GitHub.</li>
            </ol>
            <div className="actions">
              <button className="button" onClick={openOptions}>
                Open settings
              </button>
            </div>
          </section>
        )}

        {message ? <p className="notice muted">{message}</p> : null}

        <div className="actions">
          <button className="button secondary" onClick={refresh} disabled={busy}>
            Refresh
          </button>
          <button className="button secondary" onClick={openOptions}>
            Settings
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
