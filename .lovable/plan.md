## Goal
Deploy the existing image mirror to GitLab Pages and wire it into the app as Backup B, so the Image Source Indicator can fall back to GitLab if GitHub and Cloudflare are unreachable.

## What we already know
- The mirror contents were pushed to `https://gitlab.com/bewbzz/gpkonwaxbackup.git` (2.31 GiB, 1533 objects).
- GitHub Pages primary mirror is live at `https://gpkonwaxbackup.github.io/gpk-backup/mirror/`.
- Cloudflare Pages backup A is live at `https://gpkonwaxbackup.pages.dev/`.
- The app reads mirror URLs from `src/lib/ipfsGateways.ts` and expects each mirror to serve the same folder structure as the primary (images + `gpk-manifest.json`).

## Steps

### 1. Add GitLab Pages CI config
Create `.gitlab-ci.yml` in the root of `gpkonwaxbackup/gpkonwaxbackup` so GitLab knows to publish the `public/` folder to Pages.

```yaml
pages:
  stage: deploy
  script:
    - echo "Deploying to GitLab Pages"
  artifacts:
    paths:
      - public
  publish: public
  only:
    - main
```

GitLab serves whatever is in the `public/` directory at `https://<user>.gitlab.io/<project>/`.

### 2. Re-organise the repository contents (if needed)
Check whether the pushed files are already inside a `public/` folder. If they are at the repository root, move them into `public/` so GitLab Pages can serve them.

### 3. Commit and push the CI file
```bash
git add .gitlab-ci.yml
git commit -m "Add GitLab Pages deployment"
git push origin main
```

### 4. Wait for the Pages pipeline
- Go to **Project → CI/CD → Pipelines** in GitLab.
- Wait for the `pages` job to finish.
- The site URL will be shown under **Project → Settings → Pages**.

### 5. Verify the GitLab mirror is serving files
Check that these URLs return the expected content:

```text
https://bewbzz.gitlab.io/gpkonwaxbackup/mirror/gpk-manifest.json
https://bewbzz.gitlab.io/gpkonwaxbackup/mirror/1a.png   (or another known image path)
```

### 6. Wire Backup B into the app
Update `src/lib/ipfsGateways.ts`:

- Add `BACKUP_MIRROR_B = 'https://bewbzz.gitlab.io/gpkonwaxbackup/mirror/'`.
- Append it to the mirror fallback list used by `useImageSourceStatus` and the download/verification flows.

### 7. Update the Image Source Indicator
In `src/hooks/useImageSourceStatus.ts` and `src/components/ImageSourceIndicator.tsx`, ensure GitLab is probed as the third fallback and reported correctly (e.g. "Backup B (GitLab) live").

### 8. Update the Backup Panel
In `src/components/BackupPanel.tsx`, add a "Download from GitLab" option alongside the existing GitHub and Cloudflare options.

### 9. Test the full fallback chain
Use the in-app indicator and Backup Panel to confirm:
1. IPFS is preferred when live.
2. GitHub primary mirror is next.
3. Cloudflare is third.
4. GitLab is fourth and reachable.

## Open question before implementation
Please confirm the final GitLab Pages URL you want baked into the app:

- `https://bewbzz.gitlab.io/gpkonwaxbackup/` (matches the push you just did)
- Or `https://gpkonwaxbackup.gitlab.io/gpkonwaxbackup/` (if you move/rename the project)

Once confirmed, I will implement steps 1–9.