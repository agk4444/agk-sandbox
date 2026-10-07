// Op protocol: orchestrator ↔ sandbox communication.
// The orchestrator (Plesk) sends ops; the sandbox (browser/Electron) executes.

export type OpId = string;

export interface OpRequest {
  id: OpId;
  op: OpType;
  args: Record<string, unknown>;
}

export interface OpResponse {
  id: OpId;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type OpType =
  // Filesystem
  | "fs.write"
  | "fs.read"
  | "fs.list"
  | "fs.delete"
  | "fs.exists"
  // Git (isomorphic-git, local-first)
  | "git.init"
  | "git.clone"
  | "git.add"
  | "git.commit"
  | "git.branch"
  | "git.checkout"
  | "git.merge"
  | "git.log"
  | "git.status"
  | "git.push"    // optional: requires network + auth
  | "git.pull"    // optional: requires network + auth
  // Execution (WebContainer or local daemon)
  | "exec.run"
  // App lifecycle
  | "app.start"
  | "app.stop"
  | "app.logs"
  | "app.list";

// --- Filesystem args ---

export interface FsWriteArgs {
  path: string;      // e.g. "projects/myapp/x.js" (relative to sandbox root)
  content: string;
}

export interface FsReadArgs {
  path: string;
}

export interface FsListArgs {
  path: string;      // directory to list
}

export interface FsDeleteArgs {
  path: string;
}

// --- Git args ---

export interface GitInitArgs {
  dir: string;       // e.g. "/sandbox/myapp"
}

export interface GitAddArgs {
  dir: string;
  filepath: string;  // relative to dir, or "." for all
}

export interface GitCommitArgs {
  dir: string;
  message: string;
  author?: { name: string; email: string };
}

export interface GitBranchArgs {
  dir: string;
  action: "create" | "list" | "delete";
  name?: string;     // for create/delete
  checkout?: boolean; // for create: switch to it immediately
}

export interface GitCheckoutArgs {
  dir: string;
  ref: string;
}

export interface GitMergeArgs {
  dir: string;
  theirs: string;    // branch to merge in
  message?: string;
}

export interface GitLogArgs {
  dir: string;
  depth?: number;
  ref?: string;
}

// --- Exec args ---

export interface ExecRunArgs {
  dir: string;       // working directory
  command: string;   // e.g. "npm run build"
  timeout?: number;  // ms, default 120000
  env?: Record<string, string>;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

// --- App args ---

export interface AppStartArgs {
  name: string;
  dir: string;
  command: string;   // e.g. "node server.js"
  port: number;
  env?: Record<string, string>;
}

export interface AppStopArgs {
  name: string;
}

export interface AppLogsArgs {
  name: string;
  lines?: number;
}
