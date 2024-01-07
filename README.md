# GazePlotter

GazePlotter is a Svelte application for visualizing eye-tracking data. It automatically transforms eye gaze data to interactive scarf plots.

You can use it in your Svelte project as it can be imported as Svelte component via npm package `gazeplotter`.

Go to:
- [Working GazePlotter app](https://gazeplotter.com)
- [Guide](https://docs.gazeplotter.com)
- [Guide repo](https://github.com/misavojte/GazePlotterDocs/)
- [npm package] (https://www.npmjs.com/package/gazeplotter)

## Developing

Once you've cloned a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is part of the GazepLOTTER library, everything inside `src/routes` is used as a showcase or preview app.

## Building

To build GazePlotter library:

```bash
npm run package
```

To create a production version of your showcase app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> For deploy on GH Pages, there is a static [adapter](https://kit.svelte.dev/docs/adapters).

## Publishing

To publish library to [npm](https://www.npmjs.com):

```bash
npm publish
```
