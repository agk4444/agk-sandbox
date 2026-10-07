// isomorphic-git backend for browser/WebContainer.
// Pure JavaScript, no binary needed. Works in WebContainer's virtual FS.
// Note: merge() is less battle-tested than native git for complex conflicts,
// but handles fast-forward and simple merges (our use case) reliably.

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import type { GitAuthor, GitBackend } from "./types.js";

const DEFAULT_AUTHOR: GitAuthor = { name: "AGK Sandbox", email: "sandbox@agk.local" };

// isomorphic-git needs an fs implementation. In WebContainer, we pass their fs.
// This is injected at construction time.
export class IsomorphicGitBackend implements GitBackend {
  private fs: any;
  private http: any;

  constructor(fsImpl: any) {
    this.fs = fsImpl;
    this.http = http;
  }

  async init(dir: string): Promise<void> {
    await git.init({ fs: this.fs, dir, defaultBranch: "main" });
  }

  async add(dir: string, filepath: string): Promise<void> {
    await git.add({ fs: this.fs, dir, filepath });
  }

  async commit(dir: string, message: string, author: GitAuthor = DEFAULT_AUTHOR): Promise<string> {
    return git.commit({
      fs: this.fs,
      dir,
      message,
      author: { name: author.name, email: author.email },
    });
  }

  async branchCreate(dir: string, name: string): Promise<void> {
    await git.branch({ fs: this.fs, dir, ref: name, checkout: true });
  }

  async branchList(dir: string): Promise<string[]> {
    return git.listBranches({ fs: this.fs, dir });
  }

  async branchDelete(dir: string, name: string): Promise<void> {
    await git.deleteBranch({ fs: this.fs, dir, ref: name });
  }

  async checkout(dir: string, ref: string): Promise<void> {
    await git.checkout({ fs: this.fs, dir, ref });
  }

  async currentBranch(dir: string): Promise<string> {
    const b = await git.currentBranch({ fs: this.fs, dir });
    if (!b) throw new Error("not on a branch (detached HEAD?)");
    return b;
  }

  async merge(dir: string, theirs: string, message?: string): Promise<void> {
    await git.merge({
      fs: this.fs,
      dir,
      theirs,
      author: { name: DEFAULT_AUTHOR.name, email: DEFAULT_AUTHOR.email },
    });
    // isomorphic-git merge doesn't take a custom message; it auto-generates
  }

  async log(dir: string, depth: number = 10): Promise<Array<{ oid: string; message: string }>> {
    const commits = await git.log({ fs: this.fs, dir, depth });
    return commits.map((c) => ({ oid: c.oid, message: c.commit.message.trim() }));
  }

  async status(dir: string): Promise<Array<{ path: string; status: string }>> {
    const matrix = await git.statusMatrix({ fs: this.fs, dir });
    return matrix
      .filter((row) => row[1] !== row[2] || row[2] !== row[3])
      .map((row) => ({ path: row[0], status: `${row[1]}${row[2]}${row[3]}` }));
  }

  async push(dir: string, remote: string = "origin", ref?: string): Promise<void> {
    // Requires token in headers — passed via httpHeaders option by caller
    throw new Error("push() via isomorphic-git needs auth headers — use pushWithAuth()");
  }

  async pushWithAuth(dir: string, opts: { remote?: string; ref?: string; token: string }): Promise<void> {
    await git.push({
      fs: this.fs,
      http: this.http,
      dir,
      remote: opts.remote || "origin",
      ref: opts.ref,
      onAuth: () => ({ username: opts.token }),
    });
  }

  async pull(dir: string, remote: string = "origin", ref?: string): Promise<void> {
    throw new Error("pull() via isomorphic-git needs auth headers — use pullWithAuth()");
  }

  async clone(url: string, dir: string, opts: { depth?: number; ref?: string } = {}): Promise<void> {
    await git.clone({
      fs: this.fs,
      http: this.http,
      url,
      dir,
      depth: opts.depth,
      ref: opts.ref,
      singleBranch: true,
    });
  }
}
