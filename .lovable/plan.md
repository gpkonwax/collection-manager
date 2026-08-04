# Host the GPK holders manifest on GitHub Pages

This plan assumes the holders manifest file already exists. We will publish it to the existing `bewbzz/gpkonwaxbackup` GitHub repo so the app can load it from `https://bewbzz.github.io/gpkonwaxbackup/manifests/gpk-topps-holders.json`.

## What you need before starting

- The file `gpk-topps-holders.json` somewhere on your computer.
- A GitHub account and access to the repo `https://github.com/bewbzz/gpkonwaxbackup`.
- The repo already has GitHub Pages enabled (it is the primary image mirror).

## Step 1 — Make a local copy of the backup repo

If you already have the backup repo folder on your computer, open it. If not:

1. Go to https://github.com/bewbzz/gpkonwaxbackup
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Unzip it to your Desktop or wherever you keep project files.
5. Open the unzipped folder. This is your backup repo folder.

## Step 2 — Create the `manifests` folder and add the file

Inside the backup repo folder:

1. Create a new folder called `manifests`.
2. Copy your `gpk-topps-holders.json` file into that folder.

Final path should look like this:

```text
gpkonwaxbackup/
  manifests/
    gpk-topps-holders.json
  mirror/
    ...existing image folders...
  manifest.json
  ...other existing files...
```

## Step 3 — Commit and push the change

Open a terminal inside the backup repo folder and run these commands one by one:

```bash
git add manifests/gpk-topps-holders.json
git commit -m "Add GPK holders manifest"
git push origin main
```

If you downloaded the ZIP instead of cloning, you may need to initialize git first:

```bash
git init
git add .
git commit -m "Initial backup mirror + holders manifest"
git branch -M main
git remote add origin https://github.com/bewbzz/gpkonwaxbackup.git
git push -u origin main
```

When git asks for your password, use a GitHub Personal Access Token, not your normal password. If you do not have one:

1. Go to https://github.com/settings/tokens?type=beta
2. Click **Generate new token**.
3. Give it a name like `gpk backup upload`.
4. Under **Repository access**, choose **Only select repositories** and pick `bewbzz/gpkonwaxbackup`.
5. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
6. Click **Generate token** and copy the token.
7. Paste it when git asks for the password.

## Step 4 — Wait for GitHub Pages to update

GitHub Pages usually updates within 1–2 minutes after you push. You can check the status:

1. Go to https://github.com/bewbzz/gpkonwaxbackup/actions
2. Wait for the latest workflow run to show a green checkmark.

## Step 5 — Test the manifest URL

Open this link in your browser:

```text
https://bewbzz.github.io/gpkonwaxbackup/manifests/gpk-topps-holders.json
```

You should see a big JSON object with `generatedAt`, `totals`, and a long `holders` array. If you see a 404 error, wait another minute and refresh.

You can also test it from the terminal:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "https://bewbzz.github.io/gpkonwaxbackup/manifests/gpk-topps-holders.json"
```

It should print `200`.

## Step 6 — Refresh the app

1. Open the GPK collection manager app.
2. Click the wallet input box.
3. Click **Show List**.
4. The dropdown should now populate with the top holders instead of showing "Holders snapshot not published yet".

## If something goes wrong

- **404 after waiting**: Make sure the file path in the repo is exactly `manifests/gpk-topps-holders.json` at the root, not inside another folder.
- **Push fails with authentication**: Use a Personal Access Token as described in Step 3.
- **GitHub Pages not enabled**: Go to https://github.com/bewbzz/gpkonwaxbackup/settings/pages and set Source to **Deploy from a branch**, branch **main**, folder **/(root)**.
