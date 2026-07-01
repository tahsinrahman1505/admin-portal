# Branching

```
feature/*  →  dev  →  staging  →  main
```

- **`feature/*`** — one branch per change. Branch off `dev`, PR back into `dev`.
- **`dev`** — active integration.
- **`staging`** — dress rehearsal. Vercel builds a Preview Deployment for any
  push here (`vercel deploy` also works locally if the branch's build needs a
  manual check before pushing). Review the preview before promoting.
- **`main`** — production. Protected: direct pushes are blocked (see below).
  Vercel deploys `main` to production automatically.

**Branch protection:** GitHub's branch protection (classic rules and the newer
Rulesets) requires a **GitHub Pro** upgrade for private repos on a personal
account — confirmed via the API. Where this repo is private and unprotected
server-side, `.githooks/pre-push` (wired via `git config core.hooksPath
.githooks`) blocks direct pushes to `main`/`staging` from this machine
instead. That's a local safety net, not a server-side guarantee — a fresh
clone needs `git config core.hooksPath .githooks` run once.

Emergency override: `ALLOW_PROTECTED_PUSH=1 git push origin main`.

**Rollback:** Vercel keeps every deployment — `vercel rollback` (or re-promote
a previous deployment from the dashboard) is instant and doesn't need a git
revert.
