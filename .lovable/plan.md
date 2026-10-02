# Add the BACKUP_REPO_TOKEN secret so the monthly uploads work

## What this is for

Two automatic jobs in your main app repo (`gpkonwax/collection-manager`) need
permission to save files into your **backup** repo (`gpkonwaxbackup/gpk-backup`):

1. **Offline app bundle** — publishes `gpk-collection-manager-offline.zip`
2. **Monthly records ZIP** — publishes `gpk-records.zip` (holders + mint numbers)
   on the 10th of each month

GitHub runs these jobs as a robot with no account of its own, so we create a
special key (a **token**) that says "you may write to the backup repo", and we
hand that key to the workflows under the name `BACKUP_REPO_TOKEN`.

You will do two things: **create the token** (part A), then **paste it into the
repo's secrets** (part B). Roughly 5 minutes plus the wait for GitHub to email
you.

---

## Part A — Create the GitHub token (the key)

1. Go to **https://github.com** and make sure you are signed in as the account
   that owns both repos (the same account you already use).

2. Click your **profile picture** (top-right corner) → click **Settings**
   (near the bottom of the dropdown). **Note:** this is *your account's*
   Settings, not a repo's Settings.

3. In the left sidebar, scroll all the way down and click the last item:
   **Developer settings**.

4. In the left sidebar click **Personal access tokens** → then
   **Fine-grained tokens**. (Use fine-grained — it lets us limit the token to
   just the one backup repo.)

5. Click the blue **Generate new token** button, then choose
   **Generate new token (fine-grained)**.

6. Fill in the form:
   - **Token name:** `gpk-backup-upload`
   - **Expiration:** choose **Custom…** and set it to roughly one year from
     today. (When it expires, the uploads silently stop — you'll need to
     create a fresh token the same way and update the secret. GitHub emails
     you before it expires.)
   - **Resource owner:** select **gpkonwax** (your account/organization that
     owns the backup repo).
   - **Repository access:** select **Only select repositories**, then in the
     dropdown that appears choose **gpkonwaxbackup/gpk-backup**. This is the
     key point: the token can only ever touch that one backup repo — your
     main repo stays untouchable by it.

7. Scroll down to the big **Permissions** section. Click **Repository
   permissions**, find **Contents** in the list, and change its dropdown from
   "No access" to **Read and write**.
   - This is the only permission needed: the workflows create releases and
     upload files, and releases live in "Contents".
   - Leave every other permission at "No access".

8. Click the green **Generate token** button at the bottom.

9. GitHub now shows a long code starting with `github_pat_...` in a green
   box. **Copy it now with the copy button** — this is the only time GitHub
   ever shows it. If you close the page without copying, you must create a
   new token. Don't paste it into chat, email, or anywhere else — it goes
   into GitHub's secret form only (next part).

---

## Part B — Save the token in the main app repo

1. Open your main app repo directly:
   **https://github.com/gpkonwax/collection-manager**

2. Click **Settings** (in the row of tabs along the top of the repo — Code,
   Issues, Pull requests, … **Settings**).

3. In the left sidebar click **Secrets and variables**, then **Actions**.

4. Click the green **New repository secret** button.

5. Fill in the two fields **exactly**:
   - **Name:** `BACKUP_REPO_TOKEN`
     (must be exactly this, all capitals with underscores — the workflows
     look it up by this exact name)
   - **Secret:** paste the `github_pat_...` token you copied in Part A

6. Click **Add secret**. You'll see `BACKUP_REPO_TOKEN` listed under
   "Repository secrets". That's it — nothing in the app code changes.

---

## Part C — Run the workflow once to publish everything now

The secret only takes effect from the next workflow run, so trigger one:

1. In the same repo, click the **Actions** tab.

2. In the left sidebar click **Refresh GPK holders manifest**.

3. Click the **Run workflow** dropdown on the right, leave the branch as
   `main`, and click the green **Run workflow** button.

4. Wait for the run to finish (it scans the blockchain and takes roughly
   25–30 minutes; the page updates itself — you can leave it open or come
   back).

5. When it's green, check that both uploads landed:
   - Open **https://github.com/gpkonwaxbackup/gpk-backup/releases** — the
     latest release should now list `gpk-records.zip` **and**
     `gpk-collection-manager-offline.zip` among its attached files.
   - In the app, the Offline backup section should show the
     **Download records ZIP** button with a current date.

---

## Troubleshooting

- **Run goes green but the release has no `gpk-records.zip`:** the token
  wasn't accepted. Open the finished run in Actions, click the workflow step
  that mentions the release/upload, and read its warning — "not set" means
  the secret name is misspelled (re-check `BACKUP_REPO_TOKEN`, capitals
  exactly); a `403`/`Bad credentials` means the token lacks the
  **Contents: Read and write** permission or it was pasted incompletely.
- **Token expired months from now:** create a new token (Part A) and update
  the existing secret (Settings → Secrets → click the pencil icon next to
  `BACKUP_REPO_TOKEN` — you don't need to delete it).
- **Nothing else needed:** the Cloudflare steps (`CF_API_TOKEN`,
  `CF_ACCOUNT_ID`) are separate and only matter for the gpk-data mirror; they
  don't affect these ZIP uploads.
