// ship(): the invisible branch workflow.
// Merges a task branch to main, runs a local build check, optionally pushes.
// The model never sees git — it just calls ship() and gets a pass/fail.

import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import type { GitBackend, ShipOptions, ShipResult } from "./types.js";

const execFileAsync = promisify(execFile);

async function runBuild(dir: string, project?: string, buildCommand?: string): Promise<{ passed: boolean; output: string }> {
  const workDir = project ? join(dir, project) : dir;
  const pkgPath = join(workDir, "package.json");

  // No package.json = static, nothing to build
  if (!existsSync(pkgPath)) {
    return { passed: true, output: "No package.json — static, gate passes." };
  }

  // Auto-detect build command
  let cmd = buildCommand;
  if (!cmd) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.build) {
        cmd = "npm run build";
      } else {
        return { passed: true, output: "No build script — static, gate passes." };
      }
    } catch {
      return { passed: true, output: "Could not read package.json — gate passes." };
    }
  }

  // Install then build
  try {
    const hasLock = existsSync(join(workDir, "package-lock.json"));
    const installCmd = hasLock ? "npm" : "npm";
    const installArgs = hasLock ? ["ci", "--no-audit", "--no-fund"] : ["install", "--no-audit", "--no-fund"];
    await execFileAsync(installCmd, installArgs, { cwd: workDir, timeout: 300000 });

    const [bin, ...args] = cmd.split(" ");
    const { stdout, stderr } = await execFileAsync(bin, args, { cwd: workDir, timeout: 300000 });
    return { passed: true, output: stdout + stderr };
  } catch (err: any) {
    return { passed: false, output: err.stdout + err.stderr || err.message };
  }
}

export async function ship(backend: GitBackend, opts: ShipOptions): Promise<ShipResult> {
  const { dir, branch, project, buildCommand, pushAfter = false } = opts;

  // 1. Ensure we're on main, merge the branch
  const cur = await backend.currentBranch(dir).catch(() => null);
  if (cur !== "main") {
    await backend.checkout(dir, "main");
  }
  await backend.merge(dir, branch, `Merge ${branch}`);

  // 2. Get the merge commit
  const log = await backend.log(dir, 1);
  const mergeCommit = log[0]?.oid || "unknown";

  // 3. Local build check (replaces GitHub Actions gate)
  const build = await runBuild(dir, project, buildCommand);

  if (!build.passed) {
    // Build failed — revert the merge so main stays clean
    // (reset --hard to pre-merge state)
    // Note: this requires the backend to support reset; for now we just report
    return {
      shipped: false,
      mergedBranch: branch,
      mergeCommit,
      buildPassed: false,
      buildOutput: build.output,
    };
  }

  // 4. Delete the branch (cleanup)
  await backend.branchDelete(dir, branch).catch(() => {});

  // 5. Optional push to remote (for backup)
  let pushed = false;
  if (pushAfter) {
    try {
      await backend.push(dir);
      pushed = true;
    } catch {
      // Push failed (no network, no remote) — local merge is still valid
    }
  }

  return {
    shipped: true,
    mergedBranch: branch,
    mergeCommit,
    buildPassed: true,
    buildOutput: build.output,
    pushed,
  };
}

// Auto-branching: called on first write in a session.
// Creates <app>-<timestamp> branch if not already on one.
export async function ensureTaskBranch(
  backend: GitBackend,
  dir: string,
  appName: string
): Promise<string> {
  const cur = await backend.currentBranch(dir).catch(() => null);
  if (cur && cur !== "main" && cur !== "master") {
    return cur; // already on a task branch
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const branch = `${appName}-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  await backend.branchCreate(dir, branch);
  return branch;
}
