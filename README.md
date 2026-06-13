[![DOI](https://img.shields.io/badge/DOI-10.3758%2Fs13428--026--02959--5-blue)](https://doi.org/10.3758/s13428-026-02959-5)
[![Published in Behavior Research Methods](https://img.shields.io/badge/Published_in-Behavior_Research_Methods-green)](https://link.springer.com/article/10.3758/s13428-026-02959-5)

# GazePlotter

Browser-based, open-source tool for interactive AOI-based visualization and analysis of eye-tracking data. No installation, no registration, no data uploaded to a server — all processing runs entirely client-side.

**Please [cite the GazePlotter paper](https://doi.org/10.3758/s13428-026-02959-5) ([BibTeX](#bibtex)) if you use the tool in research.**

- **[GazePlotter app](https://gazeplotter.com)** — use it now in your browser
- **[Documentation](https://gazeplotter.com/docs)** — guides for upload, plotting, and export
- **[npm package](https://www.npmjs.com/package/gazeplotter)** — embed in your Svelte project

## Features

- **Scarf plots** (sequence charts) rendering fixations, saccades, and AOI-coded segments across multiple participants and stimuli, with absolute, relative, and ordinal timeline modes
- **AOI transition matrices** showing gaze transition probabilities between areas of interest
- **Bar plots** of AOI-based metrics — dwell time, fixation count, visit count, time to first fixation, first fixation duration, hit ratio, and more
- **Time-binned AOI occupancy** charts for temporal distribution of gaze across areas of interest
- **Dynamic AOI visibility layers** to handle time-varying areas of interest
- **Drag-and-drop dashboard** with resizable, repositionable plot panels
- **Client-side processing** — all data stays in the browser; nothing is uploaded to a server
- **CSV export** of computed eye-tracking metrics for further statistical analysis
- **PNG / JPG export** of all visualizations

## Supported eye-tracking software

GazePlotter parses raw data exports from the following eye-tracking platforms:

| Software | Vendor |
| --- | --- |
| Tobii Pro Lab | Tobii |
| SMI BeGaze | SensoMotoric Instruments |
| Pupil Cloud | Pupil Labs |
| GazePoint Analysis | GazePoint |
| OGAMA | — |
| Varjo XR | Varjo |

## Use as Svelte component

```bash
npm install gazeplotter
```

```svelte
<script>
  import { GazePlotter } from 'gazeplotter'
</script>

<GazePlotter />
```

Requires Svelte 5.

## Developing

```bash
npm install
npm run dev
```

Everything inside `src/lib` is the published GazePlotter library; `src/routes` is the web app and documentation site deployed at gazeplotter.com.

### Build

```bash
npm run package    # build the library
npm run build      # build the web app
```

### Test

```bash
npm run test
```

## Citation

Vojtechovska, M. & Popelka, S. (2026). GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data. *Behavior Research Methods*, 58(3), 85. doi: [10.3758/s13428-026-02959-5](https://doi.org/10.3758/s13428-026-02959-5)

### BibTeX

```bibtex
@article{vojtechovska2026gazeplotter,
    author    = {Vojtechovska, Michaela and Popelka, Stanislav},
    title     = {{GazePlotter}: An open-source solution for the automatic generation of scarf plots from eye-tracking data},
    journal   = {Behavior Research Methods},
    volume    = {58},
    number    = {3},
    pages     = {85},
    year      = {2026},
    doi       = {10.3758/s13428-026-02959-5}
}
```
