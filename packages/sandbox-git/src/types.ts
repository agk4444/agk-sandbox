// Unified git API for AGK sandbox.
// Two backends: isomorphic-git (browser/WebContainer) and native git binary (Electron/desktop).
// The sandbox picks the backend based on environment.

export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitBackend {
  init(dir: string): Promise<void>;
  add(dir: string, filepath: string): Promise<void>;
  commit(dir: string, message: string, author?: GitAuthor): Promise<string>;
  branchCreate(dir: string, name: string): Promise<void>;
  branchList(dir: string): Promise<string[]>;
  branchDelete(dir: string, name: string): Promise<void>;
  checkout(dir: string, ref: string): Promise<void>;
  currentBranch(dir: string): Promise<string>;
  merge(dir: string, theirs: string, message?: string): Promise<void>;
  log(dir: string, depth?: number): Promise<Array<{ oid: string; message: string }>>;
  status(dir: string): Promise<Array<{ path: string; status: string }>>;
  // Optional: requires network + auth
  push(dir: string, remote?: string, ref?: string): Promise<void>;
  pull(dir: string, remote?: string, ref?: string): Promise<void>;
  clone(url: string, dir: string, opts?: { depth?: number; ref?: string }): Promise<void>;
}

export interface ShipOptions {
  dir: string;
  branch: string;
  project?: string;       // e.g. "projects/myapp" for build check
  buildCommand?: string;  // default: auto-detect from package.json
  pushAfter?: boolean;    // push to remote after merge (default false)
  author?: GitAuthor;
}

export interface ShipResult {
  shipped: boolean;
  mergedBranch: string;
  mergeCommit: string;
  buildPassed: boolean;
  buildOutput?: string;
  pushed?: boolean;
}
