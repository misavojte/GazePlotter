# App dev & build

GazePlotter uses Vite to build the app from Svelte components and TypeScript modules. The development set-up requires Node 20.19+ (or 22.12+), as required by Vite 8.

The project integrates documentation directly in the codebase as `.md` files, which are prerendered by SvelteKit. More details can be found in the [Docs dev & build](/docs/advanced/docs-dev-build) section.

## Download the source code

The code can be downloaded as a zip file, but it is highly recommended to either fork the repository or clone it.

### Fork the repository

To fork the repository, click the `Fork` button in the top-right corner of the [GitHub repository](https://github.com/misavojte/gazeplotter).

### Clone the repository

To clone the repository, open the terminal and run the following command:

```bash
git clone https://github.com/misavojte/GazePlotter.git
```

## Quick start

In the terminal, make sure you are in the project's root directory. Then, to start the Vite dev server (default `http://localhost:5173/`), use:

```bash
npm install
npm run dev
```

## Build the app

To build the app, use:

```bash
npm run build
```

Production build is located in the `build` directory. For its preview on `http://localhost:4173/` (or the port specified by Vite), use:

```bash
npm run preview
```

## Code Quality & Types

Before committing, run type checking and Svelte verification:

```bash
npm run check
```

This ensures there are no Svelte compilation errors, TypeScript type mismatch issues, or compiler warnings.
