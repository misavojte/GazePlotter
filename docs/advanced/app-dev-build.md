---
title: App dev & build
order: 5
---

# App dev & build

GazePlotter uses Vite.js to build the app from Svelte components and TypeScript modules. The development set-up requires that you have Node (16 or higher) installed.

The project uses VitePress for documentation, more in the [Docs dev & build](/docs/advanced/docs-dev-build) section.

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

In the terminal, make sure you are in the project's root directory. Then, to start Vite server and run dev version of project locally on `http://localhost:5174/`, use:

```bash
npm install
npm run dev
```

## Build the app

To build the app, use:

```bash
npm run build
```

Production build is located in the `dist` directory. For its preview on `http://localhost:4173/`, use:

```bash
npm run preview
```

## Before commit

Make sure you comply with the standards of projects (implementing MVC interfaces to Front components) and there are no errors and warnings produced by ESLint:

```
npx eslint src/ts
```

You can automatically beautify code by using --fix flag:

```
npx eslint src/ts --fix
```

Make sure there are no errors and warnings produced by TypeScript and try to comply with the coding standards of projects.
