type EditorSnapshot = {
  code: string;
  language: string;
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

type PageDiagnostic = {
  isProblemPage: boolean;
  slug: string;
  title: string;
  url: string;
  difficulty: string;
  language: string;
  extension: string;
  codeLength: number;
  statementLength: number;
};

const CONTENT_SOURCE = "litcode-helper-content";
const INJECTED_SOURCE = "litcode-helper-injected";
const AUTO_CAPTURE_COOLDOWN_MS = 7000;
const languageExtensionMap: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  dart: "dart",
  elixir: "ex",
  erlang: "erl",
  golang: "go",
  java: "java",
  javascript: "js",
  kotlin: "kt",
  mysql: "sql",
  mssql: "sql",
  oraclesql: "sql",
  php: "php",
  python: "py",
  python3: "py",
  racket: "rkt",
  ruby: "rb",
  rust: "rs",
  scala: "scala",
  swift: "swift",
  typescript: "ts"
};

let lastAutoCaptureAt = 0;
let lastAcceptedKey = "";

function injectPageScript() {
  const url = chrome.runtime.getURL("injected.js");
  const script = document.createElement("script");
  script.src = url;
  script.type = "text/javascript";
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function getSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match?.[1] ?? "unknown-problem";
}

function getProblemUrl(slug: string) {
  return `${window.location.origin}/problems/${slug}/`;
}

function titleCaseSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findTextBySelectors(selectors: string[]) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function getTitle(slug: string) {
  const title = findTextBySelectors([
    '[data-cy="question-title"]',
    'a[href^="/problems/"] div',
    "div.text-title-large",
    "div[class*='title']"
  ]);

  if (title && !/leetcode/i.test(title)) {
    return title.replace(/^\d+\.\s*/, "").trim();
  }

  const browserTitle = document.title.split("-")[0]?.trim();
  if (browserTitle && !/leetcode/i.test(browserTitle)) {
    return browserTitle.replace(/^\d+\.\s*/, "").trim();
  }

  return titleCaseSlug(slug);
}

function getDifficulty() {
  const direct = findTextBySelectors([
    '[diff]',
    '[data-degree]',
    '.text-difficulty-easy',
    '.text-difficulty-medium',
    '.text-difficulty-hard'
  ]);

  if (/easy|medium|hard/i.test(direct)) {
    return direct.match(/easy|medium|hard/i)?.[0] ?? "";
  }

  const body = document.body.innerText;
  return body.match(/\b(Easy|Medium|Hard)\b/)?.[1] ?? "";
}

function htmlToPlainText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script, style, svg").forEach((node) => node.remove());
  container.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  container.querySelectorAll("p, div, li, pre, table, tr, h1, h2, h3").forEach((node) => {
    node.appendChild(document.createTextNode("\n"));
  });

  return normalizeStatement(container.textContent ?? "");
}

function normalizeStatement(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function deepFindProblemContent(value: unknown, seen = new WeakSet<object>()): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  if (seen.has(value)) {
    return "";
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  if (typeof record.content === "string" && /<p|<pre|Example|Constraints/i.test(record.content)) {
    return record.content;
  }
  if (
    typeof record.question === "object" &&
    record.question &&
    typeof (record.question as Record<string, unknown>).content === "string"
  ) {
    return String((record.question as Record<string, unknown>).content);
  }

  for (const child of Object.values(record)) {
    const found = deepFindProblemContent(child, seen);
    if (found) {
      return found;
    }
  }

  return "";
}

function getStatement() {
  const nextData = document.querySelector<HTMLScriptElement>("#__NEXT_DATA__")?.textContent;
  if (nextData) {
    try {
      const html = deepFindProblemContent(JSON.parse(nextData));
      if (html) {
        return htmlToPlainText(html);
      }
    } catch {
      // Fall through to DOM extraction.
    }
  }

  const candidates = [
    'div[data-track-load="description_content"][class^="HTMLContent_html__"]',
    'div[data-track-load="description_content"][class*="HTMLContent_html__"]',
    '[data-track-load="description_content"]',
    'div[class*="question-content"]',
    'div[class*="description"]',
    'div[class*="elfjS"]',
    ".content__u3I1"
  ];

  for (const selector of candidates) {
    const element = document.querySelector<HTMLElement>(selector);
    const text = normalizeStatement(element?.innerText ?? "");
    if (text.length > 80) {
      return text;
    }
  }

  return "";
}

function getDateDir(timezone?: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getEditorSnapshot(timeoutMs = 1500): Promise<EditorSnapshot> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ code: "", language: "" });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.source !== INJECTED_SOURCE ||
        event.data?.type !== "EDITOR_SNAPSHOT" ||
        event.data?.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve({
        code: String(event.data.code ?? ""),
        language: String(event.data.language ?? "")
      });
    }

    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        source: CONTENT_SOURCE,
        type: "GET_EDITOR_SNAPSHOT",
        requestId
      },
      window.location.origin
    );
  });
}

function mapExtension(language: string) {
  const normalized = language.toLowerCase().replace(/[^a-z0-9]/g, "");
  return languageExtensionMap[normalized] ?? "txt";
}

async function captureAndSave(reason: "automatic" | "manual", submissionId?: string) {
  const settings = await chrome.storage.local.get("settings");
  const timezone =
    typeof settings.settings?.timezone === "string" ? settings.settings.timezone : undefined;
  const slug = getSlug();
  const editor = await getEditorSnapshot();
  const language = editor.language || findTextBySelectors(["button[aria-haspopup='listbox']"]);
  const code = editor.code.trim();

  if (!code) {
    await chrome.runtime.sendMessage({
      type: "CAPTURE_FAILED",
      error: "Could not read the LeetCode editor content."
    });
    return;
  }

  const problem: SolvedProblem = {
    title: getTitle(slug),
    slug,
    url: getProblemUrl(slug),
    difficulty: getDifficulty(),
    language: language || "text",
    extension: mapExtension(language),
    code,
    statement: getStatement(),
    solvedAt: new Date().toISOString(),
    dateDir: getDateDir(timezone),
    submissionId
  };

  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SOLUTION",
    reason,
    problem
  });

  if (!response?.ok) {
    throw new Error(response?.error || "GitHub upload failed.");
  }
}

async function getPageDiagnostic(): Promise<PageDiagnostic> {
  const slug = getSlug();
  const editor = await getEditorSnapshot();
  const language = editor.language || findTextBySelectors(["button[aria-haspopup='listbox']"]);
  const statement = getStatement();

  return {
    isProblemPage: window.location.pathname.startsWith("/problems/") && slug !== "unknown-problem",
    slug,
    title: getTitle(slug),
    url: getProblemUrl(slug),
    difficulty: getDifficulty(),
    language: language || "text",
    extension: mapExtension(language),
    codeLength: editor.code.trim().length,
    statementLength: statement.length
  };
}

function maybeAutoCapture(submissionId?: string) {
  const now = Date.now();
  const key = `${getSlug()}:${submissionId ?? "dom"}:${Math.floor(now / AUTO_CAPTURE_COOLDOWN_MS)}`;

  if (now - lastAutoCaptureAt < AUTO_CAPTURE_COOLDOWN_MS || key === lastAcceptedKey) {
    return;
  }

  lastAutoCaptureAt = now;
  lastAcceptedKey = key;
  window.setTimeout(() => {
    void captureAndSave("automatic", submissionId);
  }, 650);
}

function startDomAcceptedObserver() {
  const observer = new MutationObserver(() => {
    const text = document.body.innerText;
    if (/\bAccepted\b/.test(text) && /Runtime|Memory|Beats|submitted/i.test(text)) {
      maybeAutoCapture();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.data?.source !== INJECTED_SOURCE) {
    return;
  }

  if (event.data.type === "ACCEPTED_SUBMISSION") {
    maybeAutoCapture(event.data.submissionId ? String(event.data.submissionId) : undefined);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MANUAL_SAVE") {
    captureAndSave("manual")
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  if (message?.type === "CHECK_PAGE") {
    getPageDiagnostic()
      .then((diagnostic) => sendResponse({ ok: true, diagnostic }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
    return true;
  }

  return false;
});

injectPageScript();
startDomAcceptedObserver();
