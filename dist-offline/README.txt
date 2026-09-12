GPK Collection Manager — Offline copy
=====================================

This folder is a self-contained copy of the viewer. It works with no
internet as long as you also load the image backup ZIP once it's open.

WHAT WORKS OFFLINE
  - Browsing the collection, filtering, puzzle builder, binder view,
    card detail, animations — everything image-driven.

WHAT DOES NOT WORK OFFLINE
  - Connecting your WAX wallet, live NFT ownership, transfers, burns,
    price alerts, donations. These need the internet and will just
    fail silently. That's expected.

HOW TO OPEN
-----------

Easiest — double-click:
  1. Double-click open-me.html (or index.html) in this folder.
  2. When the app opens, click "Offline backup" in the top-left and
     load your gpk-image-mirror.zip.

If that looks broken or blank, use the local-server option below.
Some browsers restrict what a page opened from a file:// URL can do.

Reliable — run the tiny local server:
  Open a terminal in this folder, then run ONE of these:

  Windows (needs Python — check with:  python --version):
      python -m http.server 8080

  Mac / Linux:
      python3 -m http.server 8080

  Or with Node.js (any OS):
      npx serve . -l 8080

  Then open http://localhost:8080 in your browser.
  Stop the server with Ctrl+C when you're done.

YOU ALSO NEED THE IMAGE BACKUP ZIP
----------------------------------

This app folder does NOT include the card images — those live in a
separate file (~1.2 GB) called gpk-image-mirror.zip. Download it once
from the GitHub release page while it's still online:

    https://github.com/bewbzz/gpkonwaxbackup/releases/latest

Keep the ZIP next to this folder so you always have both.
