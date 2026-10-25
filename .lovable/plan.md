# Staged tidy-up plan (nothing breaks)

Each stage is small, separate, and checked before the next starts. After every stage: all 375 checks run, the app builds, and I look at the preview. If anything changes behaviour, that stage is undone before moving on. You approve each stage before I start it.

## Stage 1 — Old notes (done)
Removed 91 finished planning notes. No app changes.

## Stage 2 — Memory and notes tidy (no app changes)
- Show you the 43 saved memory notes grouped as: keep, merge, or retire (already enforced by the app's checks or long finished). Nothing is removed until you tick the list.
- Trim the to-do list: keep the 5 open items, archive finished ones in one short "done" line each.
- Remove duplicated rules that are written in both the project rules and memory, keeping one copy.

## Stage 3 — Fix the test setup warnings (no app changes)
- Update the outdated test settings flagged as deprecated, so the checks keep working with future tool updates.
- Add a note that the correct way to run checks is the Vitest command (the other runner gives false failures).

## Stage 4 — Faster first load (low risk)
Load the rarely used windows only when they are opened: Puzzle Builder, pack reveal, pack history, messages, trade/bridge windows. Same windows, same behaviour; the first page gets much lighter (about 2.1 MB to an estimated 0.6–1 MB).
- One window at a time, each with a preview check that it opens and works.

## Stage 5 — Split the main page file, in small slices (careful)
The main page is one 4,175-line file. Move self-contained pieces into their own files, one slice per step, with no change in behaviour:
1. Front page (pre-login) content
2. Offline backup section
3. Filter and sort bar
4. Selection action bar (transfer/burn/bridge)
5. Header and wallet controls
6. Shared state helpers last, only if still worthwhile
After each slice: all checks, build, and a preview check of that area (logged out and logged in as a wallet view).

## Stage 6 — Unused code sweep (careful)
Run an unused-code scanner, list findings to you, and remove only items confirmed unused by search plus checks. Anything doubtful stays.

## Not included
No visual changes, no feature changes, no changes to the GitHub workflows or backup data formats.

## Technical details
- Gate per stage: `bunx vitest run` (375/375), production build, Playwright preview check of affected areas.
- Stage 3: vitest `environmentMatchGlobs` -> `test.projects`.
- Stage 4: `React.lazy` + `Suspense` with null fallback at existing open-state mount points; dialogs mount only when open, preserving existing state resets.
- Stage 5: pure extraction (move JSX + handlers, pass props); no state ownership changes until slice 6.
- Stage 6: knip needs the playwright config excluded to run.
