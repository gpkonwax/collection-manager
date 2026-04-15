
## Fix for the GitHub Pages 404

I checked the live URL and the app is loading, but it is rendering your app's own `NotFound` page instead of the homepage. That means deployment is mostly working — the issue is React Router configuration for the GitHub Pages subpath.

### What’s causing it
Your site is hosted at:

```text
https://gpkonwax.github.io/collection-manager/
```

But the router is currently configured like this:

```text
<BrowserRouter>
```

with only:

```text
<Route path="/" ... />
```

So when the app loads at `/collection-manager/`, React Router treats that as an unmatched path and sends users to the 404 screen.

I also found one hardcoded link in `src/pages/NotFound.tsx`:

```text
<a href="/">
```

On GitHub Pages that points to `https://gpkonwax.github.io/` instead of your app subpath.

### What I’ll change
1. Update `src/App.tsx` to use a router basename for GitHub Pages:
   ```tsx
   <BrowserRouter basename="/collection-manager">
   ```
   This makes `/collection-manager/` map correctly to your app’s `/`.

2. Update `src/pages/NotFound.tsx` so the “Return to Home” link respects the repo subpath instead of going to the GitHub root.
   Preferred fix:
   - use React Router `Link to="/"`, or
   - use `import.meta.env.BASE_URL`

3. Keep your existing Vite `base: '/collection-manager/'` as-is, since that part already looks correct.

### Expected result
After the change and a fresh deployment:
- `https://gpkonwax.github.io/collection-manager/` should open the real homepage
- refreshes should still work because your workflow already copies `index.html` to `404.html`
- the fallback page’s home link will stay inside the app

### Technical details
Current confirmed state:
- `vite.config.ts` already has `base: '/collection-manager/'`
- workflow already builds and deploys `dist/`
- fetched live page shows rendered app HTML with your custom `404` component
- `src/App.tsx` uses `BrowserRouter` without `basename`
- `src/pages/NotFound.tsx` uses `href="/"`

### After implementation
You should trigger a fresh deployment and then test:
1. the main URL
2. refresh on the main URL
3. the NotFound page’s “Return to Home” link
4. one mobile-sized viewport check to confirm no routing regressions

<lov-actions>
<lov-suggestion message="Test the GitHub Pages deployment end-to-end after the router basename fix, including refresh and the Return to Home link.">Verify that it works</lov-suggestion>
<lov-suggestion message="Update the React Router setup for GitHub Pages by adding a BrowserRouter basename for /collection-manager and fix any hardcoded root links.">Fix router basename</lov-suggestion>
<lov-suggestion message="Replace hardcoded root URLs in the app with React Router links or import.meta.env.BASE_URL so navigation works correctly on GitHub Pages.">Fix hardcoded links</lov-suggestion>
<lov-suggestion message="Add a favicon and social sharing image so the deployed GitHub Pages site looks polished when bookmarked or shared.">Add branding assets</lov-suggestion>
</lov-actions>
