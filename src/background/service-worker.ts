type DuplicateMode = "update" | "skip" | "version";

type Settings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  timezone: string;
  duplicateMode: DuplicateMode;
};

type SolvedProblem = {
  title: string;
  slug: string;
  url: string;
  difficulty: string;
  language: string;
  extension: string;
  code: string;
  statement: string;
  solvedAt: string;
  dateDir: string;
  submissionId?: string;
};

type QueueItem = {
  id: string;
  problem: SolvedProblem;
  attempts: number;
  lastError: string;
  queuedAt: string;
};

type UploadStatus = {
  state: "idle" | "saving" | "success" | "error";
  message: string;
  path?: string;
  updatedAt?: string;
};

type GitHubContent = {
  sha?: string;
  type?: string;
};

const DEFAULT_SETTINGS: Settings = {
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  timezone: "Asia/Kolkata",
  duplicateMode: "update"
};

const DEFAULT_STATUS: UploadStatus = {
  state: "idle",
  message: "Waiting for an accepted LeetCode submission."
};

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(["settings", "status"]).then((stored) => {
    const updates: Record<string, unknown> = {};
    if (!stored.settings) {
      updates.settings = DEFAULT_SETTINGS;
    }
    if (!stored.status) {
      updates.status = DEFAULT_STATUS;
    }
    if (Object.keys(updates).length) {
      return chrome.storage.local.set(updates);
    }
    return undefined;
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SAVE_SOLUTION") {
    saveProblem(message.problem)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  if (message?.type === "CAPTURE_FAILED") {
    void setStatus({
      state: "error",
      message: String(message.error || "Could not capture the current problem."),
      updatedAt: new Date().toISOString()
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_DASHBOARD") {
    getDashboard().then(sendResponse);
    return true;
  }

  if (message?.type === "SAVE_SETTINGS") {
    saveSettings(message.settings)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  if (message?.type === "TEST_GITHUB") {
    testGitHub()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  if (message?.type === "RETRY_QUEUE") {
    retryQueue()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  return false;
});

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...(stored.settings ?? {})
  };
}

async function saveSettings(input: Partial<Settings>) {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...input,
    owner: cleanPathPart(input.owner),
    repo: cleanPathPart(input.repo),
    branch: String(input.branch || "main").trim(),
    token: String(input.token || "").trim(),
    timezone: String(input.timezone || DEFAULT_SETTINGS.timezone).trim(),
    duplicateMode: isDuplicateMode(input.duplicateMode) ? input.duplicateMode : "update"
  };

  await chrome.storage.local.set({ settings });
  return {
    ...settings,
    token: maskToken(settings.token)
  };
}

async function getQueue(): Promise<QueueItem[]> {
  const stored = await chrome.storage.local.get("queue");
  return Array.isArray(stored.queue) ? stored.queue : [];
}

async function setQueue(queue: QueueItem[]) {
  await chrome.storage.local.set({ queue });
}

async function setStatus(status: UploadStatus) {
  await chrome.storage.local.set({ status });
}

async function getDashboard() {
  const [settings, stored, queue] = await Promise.all([
    getSettings(),
    chrome.storage.local.get(["status", "processed"]),
    getQueue()
  ]);

  return {
    settings: {
      ...settings,
      token: settings.token
    },
    status: stored.status ?? DEFAULT_STATUS,
    queueCount: queue.length,
    processedCount: Array.isArray(stored.processed) ? stored.processed.length : 0
  };
}

async function saveProblem(problem: SolvedProblem) {
  const settings = await getSettings();
  assertConfigured(settings);
  validateProblem(problem);

  const duplicateKey = await getDuplicateKey(problem);
  if (await isProcessed(duplicateKey)) {
    await setStatus({
      state: "success",
      message: "Already logged this accepted solution.",
      path: getBasePath(problem),
      updatedAt: new Date().toISOString()
    });
    return { skipped: true, path: getBasePath(problem) };
  }

  await setStatus({
    state: "saving",
    message: `Saving ${problem.title} to GitHub...`,
    updatedAt: new Date().toISOString()
  });

  try {
    const path = await writeProblem(settings, problem);
    await markProcessed(duplicateKey);
    await setStatus({
      state: "success",
      message: `Saved ${problem.title}.`,
      path,
      updatedAt: new Date().toISOString()
    });
    return { skipped: false, path };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await enqueue(problem, message);
    await setStatus({
      state: "error",
      message: `Queued ${problem.title}: ${message}`,
      path: getBasePath(problem),
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
}

async function writeProblem(settings: Settings, problem: SolvedProblem) {
  const basePath = getBasePath(problem);
  const content = formatSolution(problem);

  if (settings.duplicateMode === "version") {
    const availablePath = await findAvailablePath(settings, problem);
    await putContent(settings, availablePath, content);
    return availablePath;
  }

  const existing = await getContent(settings, basePath);
  if (existing?.sha && settings.duplicateMode === "skip") {
    return basePath;
  }

  await putContent(settings, basePath, content, existing?.sha);
  return basePath;
}

async function retryQueue() {
  const queue = await getQueue();
  if (!queue.length) {
    return { retried: 0, remaining: 0 };
  }

  const settings = await getSettings();
  assertConfigured(settings);

  const remaining: QueueItem[] = [];
  let retried = 0;

  for (const item of queue) {
    try {
      await writeProblem(settings, item.problem);
      await markProcessed(await getDuplicateKey(item.problem));
      retried += 1;
    } catch (error) {
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await setQueue(remaining);
  await setStatus({
    state: remaining.length ? "error" : "success",
    message: remaining.length
      ? `Retried ${retried}; ${remaining.length} upload still pending.`
      : `Retried and uploaded ${retried} queued solution${retried === 1 ? "" : "s"}.`,
    updatedAt: new Date().toISOString()
  });

  return { retried, remaining: remaining.length };
}

async function testGitHub() {
  const settings = await getSettings();
  assertConfigured(settings);
  const response = await githubFetch(settings, `/repos/${settings.owner}/${settings.repo}`);
  return {
    repo: response.full_name,
    private: Boolean(response.private),
    defaultBranch: response.default_branch
  };
}

async function getContent(settings: Settings, path: string): Promise<GitHubContent | undefined> {
  try {
    return await githubFetch(
      settings,
      `/repos/${settings.owner}/${settings.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(
        settings.branch
      )}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("GitHub 404")) {
      return undefined;
    }
    throw error;
  }
}

async function putContent(settings: Settings, path: string, content: string, sha?: string) {
  return githubFetch(settings, `/repos/${settings.owner}/${settings.repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Log ${path}`,
      branch: settings.branch,
      content: encodeBase64(content),
      ...(sha ? { sha } : {})
    })
  });
}

async function githubFetch(settings: Settings, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${settings.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.message || detail;
    } catch {
      // Keep the status text.
    }
    throw new Error(`GitHub ${response.status}: ${detail}`);
  }

  return response.status === 204 ? undefined : response.json();
}

async function findAvailablePath(settings: Settings, problem: SolvedProblem) {
  const basePath = getBasePath(problem);
  const existing = await getContent(settings, basePath);
  if (!existing?.sha) {
    return basePath;
  }

  const extension = sanitizeExtension(problem.extension);
  for (let index = 2; index < 100; index += 1) {
    const path = `${problem.dateDir}/${sanitizeSlug(problem.slug)}-${index}.${extension}`;
    const candidate = await getContent(settings, path);
    if (!candidate?.sha) {
      return path;
    }
  }

  throw new Error("Could not find an available versioned file name.");
}

function formatSolution(problem: SolvedProblem) {
  const header = [
    `Date: ${problem.dateDir}`,
    `Problem: ${problem.title}`,
    `Link: ${problem.url}`,
    problem.difficulty ? `Difficulty: ${problem.difficulty}` : "",
    `Language: ${problem.language}`,
    "",
    "Problem statement:",
    problem.statement || "Statement could not be captured from the page."
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `${commentBlock(header, problem.extension)}\n\n${problem.code.trim()}\n`;
}

function commentBlock(text: string, extension: string) {
  const lines = text.split("\n");

  if (["py", "rb"].includes(extension)) {
    return `"""\n${text}\n"""`;
  }

  if (["sql"].includes(extension)) {
    return lines.map((line) => `-- ${line}`.trimEnd()).join("\n");
  }

  if (["hs", "erl"].includes(extension)) {
    return lines.map((line) => `-- ${line}`.trimEnd()).join("\n");
  }

  return `/*\n${lines.map((line) => ` * ${line}`.trimEnd()).join("\n")}\n */`;
}

function getBasePath(problem: SolvedProblem) {
  return `${problem.dateDir}/${sanitizeSlug(problem.slug)}.${sanitizeExtension(problem.extension)}`;
}

function sanitizeSlug(value: string) {
  return String(value || "unknown-problem")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeExtension(value: string) {
  return String(value || "txt")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "txt";
}

function cleanPathPart(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function assertConfigured(settings: Settings) {
  if (!settings.owner || !settings.repo || !settings.branch || !settings.token) {
    throw new Error("Open Litcode Helper settings and configure GitHub first.");
  }
}

function validateProblem(problem: SolvedProblem) {
  if (!problem?.slug || !problem?.code || !problem?.dateDir) {
    throw new Error("Captured problem data is incomplete.");
  }
}

function isDuplicateMode(value: unknown): value is DuplicateMode {
  return value === "update" || value === "skip" || value === "version";
}

async function enqueue(problem: SolvedProblem, lastError: string) {
  const queue = await getQueue();
  const id = `${problem.dateDir}:${problem.slug}:${problem.submissionId ?? hashText(problem.code)}`;
  const filtered = queue.filter((item) => item.id !== id);
  filtered.push({
    id,
    problem,
    attempts: 0,
    lastError,
    queuedAt: new Date().toISOString()
  });
  await setQueue(filtered.slice(-50));
}

async function isProcessed(key: string) {
  const stored = await chrome.storage.local.get("processed");
  const processed = Array.isArray(stored.processed) ? stored.processed : [];
  return processed.some((entry) => entry.key === key);
}

async function markProcessed(key: string) {
  const stored = await chrome.storage.local.get("processed");
  const processed = Array.isArray(stored.processed) ? stored.processed : [];
  const next = [
    ...processed.filter((entry) => entry.key !== key),
    {
      key,
      savedAt: new Date().toISOString()
    }
  ];
  await chrome.storage.local.set({ processed: next.slice(-300) });
}

async function getDuplicateKey(problem: SolvedProblem) {
  return `${problem.dateDir}:${problem.slug}:${problem.submissionId ?? hashText(problem.code)}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function maskToken(token: string) {
  if (!token) {
    return "";
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
