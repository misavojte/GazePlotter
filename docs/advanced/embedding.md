# Embedding GazePlotter

GazePlotter is also a Svelte component library. The whole workspace (canvas,
rail, settings pane, modals) ships as one `<GazePlotter>` component for use
in your own application: Tauri or Electron shells, web apps, other
eye-tracking software.

The component is self-contained: it injects its own design tokens into the
document head and needs no server.

## Requirements

- Svelte 5 and a Vite-based build.
- `worker: { format: 'es' }` in your Vite config (parsing runs in a module
  web worker).
- Peer dependencies: `jszip`, `lucide-svelte`.

## License

GazePlotter is
[GPL-3.0](https://github.com/misavojte/GazePlotter/blob/main/LICENSE). The
GPL restricts distribution, not use:

- Pointing a webview, iframe, or browser at a hosted GazePlotter: no
  obligations on your application.
- Shipping the built app as a separate program (own webview, data exchanged
  via files, URLs, or messages): aggregation. Keep the license notices and
  link the source repository; your application keeps its own license.
- Distributing a modified GazePlotter: publish the modifications under
  GPL-3.0.
- Importing the library into your codebase, as shown on this page: the
  combined application must be GPL-3.0.

Summary, not legal advice; the license text governs.

## Minimal usage

```svelte
<script>
  import { GazePlotter } from 'gazeplotter'
</script>

<GazePlotter load={async () => []} />
```

`load` prepares the initial files: an async function returning `File[]`.
`[]` opens an empty workspace; returned files parse immediately. Bytes from
anywhere can be wrapped:

```ts
const load = async () => {
  const bytes = await fetchRecordingFromMyApp()
  return [new File([bytes], 'recording.csv')]
}
```

A ready-made loader for URLs:

```svelte
<script>
  import { GazePlotter, fromUrl } from 'gazeplotter'
  const load = fromUrl('https://example.com/recording.csv')
</script>

<GazePlotter {load} />
```

## The options prop

Everything else is one optional `options` object (`GazePlotterOptions`).
Every field is optional; every default is the plain web behavior.

```svelte
<GazePlotter
  {load}
  options={{
    defaultLayout: [{ type: 'scarf', x: 0, y: 0 }],
    saveFile: (content, fileName, extension) => mySave(content, fileName),
    openFiles: async () => myFilePicker(),
    colors: { brand: '#0055ff' },
  }}
/>
```

- `defaultLayout: GridItemSnapshot[]`: layout used when loaded data carries
  none (fresh parses, empty workspace). Workspace files keep their saved
  layout; omitted snapshot fields get per-plot defaults.
- `saveFile: (content, fileName, extension) => void`: delivers one export
  file. Default: browser download. `fileName` arrives with the extension
  applied; `extension` is separate for native save-dialog filters.
- `openFiles: () => Promise<File[]>`: what the upload button opens. Default:
  browser file picker. `[]` means cancelled. Drag-and-drop is unaffected.
- `colors: GazePlotterColors`: partial palette override; unset keys keep the
  builtin, borders and shadows follow `black`. Applies reactively, so themes
  switch without remounting.

The web defaults are exported for wrapping instead of replacing:
`triggerDownload`, `openFilesViaBrowser`, `INGEST_FILE_ACCEPT`.

## Instance and session

```svelte
<script>
  let plotter
</script>

<GazePlotter bind:this={plotter} {load} />
```

- `plotter.resetLayout()`: re-runs `load`.
- `plotter.getSession()`: the session object. Useful entries:
  `ingest.loadFiles(files)` (same pipeline as drag-and-drop),
  `ingest.openAndLoadFiles()` (what the upload button calls),
  `ingest.applyEmpty()` (clear all data).

## Desktop shells (Tauri, Electron)

Electron works with the defaults: Chromium handles anchor downloads and the
file input opens a native dialog.

In Tauri, anchor downloads do nothing on macOS, so wire `saveFile` to the
dialog and fs plugins (sketch):

```ts
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'

const saveFile = async (content, fileName, extension) => {
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: extension.slice(1).toUpperCase(), extensions: [extension.slice(1)] }],
  })
  if (!path) return
  if (typeof content === 'string') await writeTextFile(path, content)
  else await writeFile(path, new Uint8Array(await content.arrayBuffer()))
}
```

Tauri configuration:

- Window `dragDropEnabled: false`, so HTML5 drag-and-drop reaches the
  webview.
- CSP must allow `blob:` URLs and workers.

The `__APP_VERSION__` build define is optional; without it, the citation
line and workspace metadata report `unknown`. To set it:

```ts
define: { __APP_VERSION__: JSON.stringify('your-app 1.0') }
```
