# Docs dev & build

The GazePlotter documentation is integrated directly into the main application codebase. The files are written in Markdown (`.md`) and preprocessed using **MDsveX**, allowing them to be compiled as Svelte components and prerendered by **SvelteKit** at build time.

More about the dev & build process of the main app can be found in the [App dev & build](/docs/advanced/app-dev-build) section.

## File Locations

- **Content files**: All documentation pages are located in the `docs/` directory at the root of the project (e.g., `docs/setup/workspace.md`).
- **Sidebar Configuration**: The sidebar menu and descriptions are managed in `src/routes/docs/sidebarConfig.ts`.
- **Routing**: SvelteKit dynamic routing is configured in `src/routes/docs/[...slug]`.

## Quick Start

To preview the documentation locally:

1. In the terminal, make sure you are in the project's root directory.
2. Run the main development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173/docs` (or the port specified by Vite) in your browser. The documentation pages will reload automatically as you edit the `.md` files.

## Adding or Modifying Pages

When adding a new documentation page:

1. Create a new `.md` file inside the appropriate subfolder under the root `docs/` directory.
2. Add standard Markdown headers and content.
3. Open `src/routes/docs/sidebarConfig.ts` and add the page to the `SIDEBAR` array under the correct section, specifying its `name`, `href` (matching `/docs/...`), and a short `description`.

## Building the Docs

Since the documentation is part of the SvelteKit app, it is built automatically when compiling the main application:

```bash
npm run build
```

The production assets, including the prerendered HTML for all documentation routes, will be placed in the `build/` directory. To preview the production build locally, run:

```bash
npm run preview
```
