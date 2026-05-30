export type DuplicateMode = "update" | "skip" | "version";

export type Settings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  timezone: string;
  duplicateMode: DuplicateMode;
};

export type SolvedProblem = {
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
};

export type UploadStatus = {
  state: "idle" | "saving" | "success" | "error";
  message: string;
  path?: string;
  updatedAt?: string;
};

export type QueueItem = {
  id: string;
  problem: SolvedProblem;
  attempts: number;
  lastError: string;
  queuedAt: string;
};
