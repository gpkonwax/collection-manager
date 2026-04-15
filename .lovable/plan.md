

## Fix GitHub Actions Workflow

The "Multiple artifacts" error happens when you **re-run** a failed workflow job — GitHub creates duplicate artifacts. The fix is to trigger a **fresh run** instead. I'll also update the workflow to address the Node.js 20 deprecation warnings.

### Changes to `.github/workflows/deploy.yml`
1. Remove `actions/setup-node@v4` — not needed since we use Bun
2. Update action versions to latest (v5 where available) to avoid Node.js 20 deprecation
3. Add `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env to future-proof

### After the update
- The push to GitHub will automatically trigger a **fresh** workflow run
- Do NOT click "Re-run jobs" on the old failed run — that causes the duplicate artifact error
- Just wait for the new run triggered by this commit

