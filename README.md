# AGK Sandbox

User-based sandbox for AGK OS and Hanuman. The user owns everything: compute, storage, git. No servers, no quota, no GitHub required.

## Product Strategy (2026-10-07)

**Two-tier:**

|  | Web (agkfireos.com) | Electron (desktop) |
|---|---|---|
| **Role** | Demo / teaser | Real product |
| **Compute** | Plesk + Codespace (existing) | User's machine |
| **Git** | GitHub (existing) | Local (this repo) |
| **Limits** | Quota, feature-limited | None |
| **CTA** | "Download the desktop app" | — |

The web demo drives downloads. Electron is where users work.

## Decision: Electron Only

No WebContainer browser sandbox. The demo doesn't need code execution (just chat). Electron has native Node.js — no browser sandbox needed.

## Packages

| Package | What | Status |
|---|---|---|
| `@agk/sandbox-protocol` | Op types: orchestrator ↔ sandbox | ✅ Defined |
| `@agk/sandbox-git` | Local git: native (Electron) + isomorphic (fallback) | ✅ Built |
| `@agk/sandbox-electron` | Desktop app: orchestrator + sandbox + UI | 🚧 Building |

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
