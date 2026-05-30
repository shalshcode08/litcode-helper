type LitcodeWindow = Window & {
  monaco?: {
    editor?: {
      getModels?: () => Array<{ getValue?: () => string; getLanguageId?: () => string }>;
    };
  };
};

const SOURCE = "litcode-helper-injected";
const CONTENT_SOURCE = "litcode-helper-content";

function getEditorSnapshot() {
  const page = window as LitcodeWindow;
  const models = page.monaco?.editor?.getModels?.() ?? [];
  const model = models.find((candidate) => candidate.getValue?.().trim());

  return {
    code: model?.getValue?.() ?? "",
    language: model?.getLanguageId?.() ?? ""
  };
}

function postAcceptedSignal(reason: string, submissionId?: string) {
  window.postMessage(
    {
      source: SOURCE,
      type: "ACCEPTED_SUBMISSION",
      reason,
      submissionId
    },
    window.location.origin
  );
}

function inspectPayload(payload: unknown): { accepted: boolean; submissionId?: string } {
  const seen = new WeakSet<object>();

  function walk(value: unknown): { accepted: boolean; submissionId?: string } {
    if (!value || typeof value !== "object") {
      return { accepted: false };
    }

    if (seen.has(value)) {
      return { accepted: false };
    }
    seen.add(value);

    const record = value as Record<string, unknown>;
    const status = String(
      record.status_msg ?? record.statusDisplay ?? record.status ?? record.state ?? ""
    ).toLowerCase();
    const statusCode = Number(record.status_code ?? record.statusCode);
    const accepted = status === "accepted" || statusCode === 10;
    const submissionId =
      typeof record.submission_id === "number" || typeof record.submission_id === "string"
        ? String(record.submission_id)
        : typeof record.id === "number" || typeof record.id === "string"
          ? String(record.id)
          : undefined;

    if (accepted) {
      return { accepted: true, submissionId };
    }

    for (const child of Object.values(record)) {
      const result = walk(child);
      if (result.accepted) {
        return result;
      }
    }

    return { accepted: false };
  }

  return walk(payload);
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";

  if (url.includes("leetcode.com") || url.includes("/graphql") || url.includes("/submissions")) {
    response
      .clone()
      .json()
      .then((payload) => {
        const result = inspectPayload(payload);
        if (result.accepted) {
          postAcceptedSignal("network", result.submissionId);
        }
      })
      .catch(() => undefined);
  }

  return response;
};

const NativeXMLHttpRequest = window.XMLHttpRequest;
window.XMLHttpRequest = class extends NativeXMLHttpRequest {
  open(method: string, url: string | URL): void;
  open(
    method: string,
    url: string | URL,
    async: boolean,
    username?: string | null,
    password?: string | null
  ): void;
  open(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.addEventListener("load", () => {
      const responseText = this.responseText;
      if (!responseText || responseText.length > 600_000) {
        return;
      }

      try {
        const result = inspectPayload(JSON.parse(responseText));
        if (result.accepted) {
          postAcceptedSignal("xhr", result.submissionId);
        }
      } catch {
        // Non-JSON responses are expected on a large app page.
      }
    });

    if (typeof async === "boolean") {
      return super.open(method, url, async, username, password);
    }

    return super.open(method, url);
  }
} as typeof XMLHttpRequest;

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.data?.source !== CONTENT_SOURCE) {
    return;
  }

  if (event.data.type === "GET_EDITOR_SNAPSHOT") {
    window.postMessage(
      {
        source: SOURCE,
        type: "EDITOR_SNAPSHOT",
        requestId: event.data.requestId,
        ...getEditorSnapshot()
      },
      window.location.origin
    );
  }
});
