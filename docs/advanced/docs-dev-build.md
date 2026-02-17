---
title: Docs dev & build
order: 6
outline: deep
---

# Docs dev & build

GazePlotterDocs uses VitePress to build and serve the documentation site from `.md` files. The development set-up requires that you have Node (14 or higher) installed.

More about the dev & build process of the main app can be found [here](./app-dev-build).

## Download the source code

The code can be downloaded as a zip file, but it is highly recommended to either fork the repository or clone it.

### Fork the repository

To fork the repository, click the `Fork` button in the top-right corner of the [GitHub repository](https://github.com/misavojte/GazePlotterDocs).

### Clone the repository

To clone the repository, open the terminal and run the following command:

```bash
git clone https://github.com/misavojte/GazePlotterDocs.git
```

## Quick start

In the terminal, make sure you are in the project's root directory. Then, to start Vite server and run dev version of project locally on `http://localhost:5174/`, use:

```bash
npm install
npm run dev
```

## Build the docs

To build the docs, use:

```bash
npm run build
```

Production build is located in the `.vitepress/dist` directory. For its preview on `http://localhost:4173/`, use:

```bash
npm run preview
```
