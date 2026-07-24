## What should happen

Your assumption is correct: **after you load the ZIP parts and turn on “Remember on this device”, you should not have to select the ZIPs again every time.**

On future page loads, the manager should automatically restore the already-loaded image backup from the browser’s IndexedDB storage.

## What is wrong now

The current code only saves the ZIP contents if “Remember on this device” was already turned on **before** the ZIPs were loaded.

So if you did this:

1. Load ZIP part 1, 2, and 3
2. Then click “Remember on this device”
3. Reload the page

…the app remembers the switch setting, but it may not have actually saved the already-loaded ZIP data into IndexedDB. That makes you load the ZIPs again.

## Fix plan

1. **Make the remember switch actually save what is already loaded**
   - When you turn “Remember on this device” ON, immediately persist the currently loaded offline mirror into IndexedDB.
   - Show a toast like “Offline backup saved on this device”.

2. **Make ZIP loading save automatically when remember is enabled**
   - If “Remember on this device” is already ON, loading ZIP parts will continue to save automatically after ingesting them.

3. **Make reload restore reliable**
   - Keep the existing startup restore from IndexedDB.
   - After restore completes, refresh the visible image-source status so “Offline ZIP” shows reachable immediately instead of stale/unreachable.

4. **Improve the wording**
   - Change the label from `Remember on this device (IndexedDB)` to something clearer, such as:
     - `Remember loaded ZIPs on this device`
   - Add a short note that this uses the browser’s local storage and will be lost if browser site data is cleared.

5. **Verify**
   - Load the ZIP parts.
   - Turn on remember.
   - Reload the page.
   - Confirm the Offline Backup section still says the files are loaded without selecting ZIPs again.
   - Confirm the header status shows Offline ZIP as reachable when needed.
