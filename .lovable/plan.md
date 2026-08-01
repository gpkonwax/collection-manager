# Rename `_headers.txt` to `_headers` in Command Prompt

## Why this matters

Netlify only reads a file literally named `_headers` (no `.txt` on the end). Your screenshot shows `_headers.txt`, so the CORS rules inside it are being ignored.

## What you will do

1. Open Command Prompt in the `mirror-output` folder.
2. Run one command to rename the file.
3. Check that the `.txt` is gone.
4. Re-deploy the whole folder to Netlify.

## Step-by-step (explained)

### 1. Open Command Prompt in the right folder

Press the Windows key, type `cmd`, and press Enter.

In the black window that appears, type this and press Enter:

```cmd
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

That tells Command Prompt: "do everything from this folder."

### 2. Rename the file

Type this exact command and press Enter:

```cmd
ren _headers.txt _headers
```

What this means:
- `ren` is short for rename.
- `_headers.txt` is the current name.
- `_headers` is the new name.

### 3. Check it worked

Type this and press Enter:

```cmd
dir _headers*
```

You should see a file named `_headers` only. If you still see `_headers.txt`, the rename did not work.

### 4. Re-deploy to Netlify

Type this and press Enter:

```cmd
netlify deploy --prod --dir .
```

This uploads the whole folder again, including the correctly-named `_headers` file.

If Netlify asks you to pick a build command, press Escape or choose the option that says no build / static deploy only.

### 5. Verify the fix

After the deploy finishes, type this and press Enter:

```cmd
curl.exe -I https://gpkonwaxbackup.netlify.app/manifests/manifest.json
```

Look for a line that says:

```text
access-control-allow-origin: *
```

If you see that, the mirror is fixed. Hard-refresh the Collection Manager (Ctrl+F5) and check Backup A again.

## Code changes

None. This is a file-naming fix on your computer and a re-deploy to Netlify.
