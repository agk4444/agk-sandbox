// Native git backend for Electron/desktop.
// Spawns the `git` binary. Faster and more feature-complete than isomorphic-git.
// Requires git to be installed on the user's machine.

import { execFile } from "child_process";
import { promisify } from "util";
import type { GitAuthor, GitBackend } from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_AUTHOR: GitAuthor = { name: "AGK Sandbox", email: "sandbox@agk.local" };

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, timeout: 60000 });
  return stdout.trim();
}

export class NativeGitBackend implements GitBackend {
  async init(dir: string): Promise<void> {
    await git(["init", "-b", "main"], dir);
  }

  async add(dir: string, filepath: string): Promise<void> {
    await git(["add", filepath], dir);
  }

  async commit(dir: string, message: string, author: GitAuthor = DEFAULT_AUTHOR): Promise<string> {
    await git(["-c", `user.name=${author.name}`, "-c", `user.email=${author.email}`, "commit", "-m", message], dir);
    return git(["rev-parse", "HEAD"], dir);
  }

  async branchCreate(dir: string, name: string): Promise<void> {
    await git(["checkout", "-b", name], dir);
  }

  async branchList(dir: string): Promise<string[]> {
    const out = await git(["branch", "--format=%(refname:short)"], dir);
    return out.split("\n").filter(Boolean);
  }

  async branchDelete(dir: string, name: string): Promise<void> {
    await git(["branch", "-D", name], dir);
  }

  async checkout(dir: string, ref: string): Promise<void> {
    await git(["checkout", ref], dir);
  }

  async currentBranch(dir: string): Promise<string> {
    return git(["rev-parse", "--abbrev-ref", "HEAD"], dir);
  }

  async merge(dir: string, theirs: string, message?: string): Promise<void> {
    const msg = message || `Merge ${theirs}`;
    await git(["merge", "--no-ff", "-m", msg, theirs], dir);
  }

  async log(dir: string, depth: number = 10): Promise<Array<{ oid: string; message: string }>> {
    const out = await git(["log", `--max-count=${depth}`, "--format=%H%x00%s"], dir);
    return out.split("\n").filter(Boolean).map((line) => {
      const [oid, message] = line.split("\x00");
      return { oid, message };
    });
  }

  async status(dir: string): Promise<Array<{ path: string; status: string }>> {
    const out = await git(["status", "--porcelain"], dir);
    return out.split("\n").filter(Boolean).map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3),
    }));
  }

  async push(dir: string, remote: string = "origin", ref?: string): Promise<void> {
    const args = ["push", remote];
    if (ref) args.push(ref);
    await git(args, dir);
  }

  async pull(dir: string, remote: string = "origin", ref?: string): Promise<void> {
    const args = ["pull", remote];
    if (ref) args.push(ref);
    await git(args, dir);
  }

  async clone(url: string, dir: string, opts: { depth?: number; ref?: string } = {}): Promise<void> {
    const args = ["clone"];
    if (opts.depth) args.push("--depth", String(opts.depth));
    if (opts.ref) args.push("--branch", opts.ref);
    args.push(url, dir);
    // clone runs in parent dir, not the target
    const { stdout } = await execFileAsync("git", args, { timeout: 300000 });
    return stdout.trim() as unknown as void;
  }
}
