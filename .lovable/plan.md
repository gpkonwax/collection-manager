

## Deploy to GitHub Pages

### What I'll Do
1. **Update `vite.config.ts`** — Set `base: '/collection-manager/'` so all assets load correctly from the GitHub Pages subpath
2. **Create `.github/workflows/deploy.yml`** — Automated workflow that builds and deploys on every push

### What You Need to Do (Step by Step)

**Step 1: Connect to GitHub**
- In the Lovable editor sidebar, click **Connectors** → **GitHub** → **Connect project**
- Authorize Lovable when prompted
- Select your **gpkonwax** GitHub account
- Name the repo **collection-manager** and click **Create Repository**

**Step 2: Tell me it's connected**
- Once the repo is created, come back and let me know — I'll then push the config changes

**Step 3: Enable GitHub Pages**
- Go to https://github.com/gpkonwax/collection-manager/settings/pages
- Under **Source**, select **GitHub Actions**
- Click **Save**

**Step 4: Wait ~1-2 minutes**
- The workflow will run automatically after the next push
- Your site will be live at: **https://gpkonwax.github.io/collection-manager/**

### Technical Details
- `base` in Vite ensures JS/CSS/image paths include `/collection-manager/` prefix
- The GitHub Actions workflow uses Node 20, installs dependencies, runs `npm run build`, and deploys the `dist/` folder
- React Router paths will work thanks to a `404.html` redirect trick for SPA routing on GitHub Pages

