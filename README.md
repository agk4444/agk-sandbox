# AGK Sandbox

User-based sandbox for AGK OS and Hanuman. Replaces GitHub Codespaces with compute on the user's own device.

## Why

GitHub Codespaces is a rented VM with a meter: quota limits, sleep/wake failures, "VM is down" errors. Every fallback in the orchestrator exists because GitHub can pull the plug.

The sandbox runs on the **user's device**:
- **Browser WebContainer** (Tier 1): Node.js in the browser tab. Zero install.
- **Electron app** (Tier 2): Full desktop app. Any language. Optional.
- **Local git**: isomorphic-git does branching/merging locally. GitHub is optional backup, not required.

No quota. No "VM is down." User owns their compute and their code.

## Packages

| Package | What | Status |
|---|---|---|
| `@agk/sandbox-protocol` | Op types: orchestrator ↔ sandbox | ✅ Defined |
| `@agk/sandbox-client` | Browser WebContainer client | 🚧 Phase 2 |
| `@agk/sandbox-git` | isomorphic-git wrapper, auto-branching | 🚧 Phase 2 |
| `@agk/sandbox-electron` | Desktop app (Mode A: connect to Plesk) | 📋 Phase 5 |

## Op Protocol

The orchestrator sends ops; the sandbox executes:

```json
// Request
{ "id": "op-123", "op": "fs.write", "args": { "path": "x.js", "content": "..." } }

// Response
{ "id": "op-123", "ok": true, "result": { "path": "x.js" } }
```

See `packages/sandbox-protocol/src/index.ts` for all op types.

## Branch Policy (Invisible)

The model never sees git. The sandbox handles it:
1. First `fs.write` → auto-create branch `<app>-<timestamp>`
2. All writes → commit to that branch
3. `ship` → local `git.merge()` to main, optional `git.push()`, local build check

## License

MIT. WebContainer client forks code from [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT).
