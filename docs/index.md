# GazePlotter Guide

GazePlotter is a free, open-source tool for eye-tracking visualization and analysis, developed at Palacký University Olomouc and described in a [peer-reviewed article](#how-to-cite). It runs entirely in your browser: no installation, no registration, and your data never leaves your device.

![The GazePlotter workspace with the demo data: a scarf plot, transition matrix, AOI comparison and AOI timeline.](/images/gazeplotter_workspace.jpg)

## Start here

1. **[Load your data](/docs/upload-data/)** exported from your eye tracker, or try the built-in demo first.
2. **[Set up the workspace](/docs/workspace/)**: arrange plots, rename AOIs, and build participant selections to compare.
3. **[Choose visualizations](/docs/visualizations/)** that answer your research question.
4. **[Calculate metrics](/docs/metrics/)** per AOI, participant, or stimulus.
5. **[Export](/docs/export/)** figures, metric tables for R, SPSS, or Python, and the workspace to continue later.

## What you can analyze

### Supported data

- [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/)
- [SMI BeGaze](/docs/upload-data/smi-begaze/)
- [Gazepoint](/docs/upload-data/gazepoint/)
- [Pupil Labs Pupil Cloud](/docs/upload-data/pupil-cloud/)
- [Varjo](/docs/upload-data/varjo/)
- [OGAMA](/docs/upload-data/ogama/)
- [Custom CSV](/docs/upload-data/custom-csv/) from any other eye tracker
- [Event files](/docs/upload-data/events/) to add key presses or stimulus changes

### Visualizations

- [Scarf plot](/docs/visualizations/scarf-plot/): AOI sequences over time, one row per participant
- [Scanpath](/docs/visualizations/scanpath/): fixations and saccades over the stimulus image or video
- [Transition matrix](/docs/visualizations/transition-matrix/): how often gaze moves between AOIs
- [AOI timeline](/docs/visualizations/aoi-timeline/): how attention shifts between AOIs over time
- [Recurrence plot](/docs/visualizations/recurrence-plot/): where a scanpath returns to itself
- [Scanpath similarity](/docs/visualizations/scanpath-similarity/): which participants looked in a similar order
- [AOI comparison](/docs/visualizations/aoi-comparison/): bar charts of any metric across AOIs
- [Metric correlation](/docs/visualizations/metric-correlation/): correlation heatmaps and scatter plot matrices
- [All visualizations](/docs/visualizations/), including metric timelines and eye-movement and event comparisons

### Metrics

- [Dwell time and fixation durations](/docs/metrics/durations/)
- [Fixation counts and time to first fixation (TTFF)](/docs/metrics/counts-latency/)
- [AOI transitions and Markov probabilities](/docs/metrics/transitions/)
- [Recurrence quantification analysis (RQA)](/docs/metrics/rqa/)
- [Scanpath similarity](/docs/metrics/scanpath-similarity/): Levenshtein distance and Needleman-Wunsch alignment
- [Fixations, saccades, and blinks](/docs/metrics/eye-movement/)
- [Event metrics](/docs/metrics/events/): key presses, stimulus changes, and other logged events

## Fully private

Your files open in your browser and are never sent to a server. Everything, from parsing to every plot and metric, is computed on your own device, so GazePlotter is safe to use with participant data. Because the [source code](https://github.com/misavojte/GazePlotter) is open, anyone can verify this.

You can also [install GazePlotter as an app](/docs/advanced/download-gazeplotter/) and work offline.

## How to cite

GazePlotter is described in a peer-reviewed article in *Behavior Research Methods*. If it helps your research, please cite it. Citations help the project continue and help other researchers find it.

> Vojtechovska, M., Popelka, S. GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data. *Behav Res* **58**, 85 (2026). [https://doi.org/10.3758/s13428-026-02959-5](https://doi.org/10.3758/s13428-026-02959-5)

```bibtex
@article{vojtechovska2026gazeplotter,
  author  = {Vojtechovska, Michaela and Popelka, Stanislav},
  title   = {GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data},
  journal = {Behavior Research Methods},
  volume  = {58},
  pages   = {85},
  year    = {2026},
  doi     = {10.3758/s13428-026-02959-5}
}
```

## Report a problem

Found a bug, or missing a feature? Let us know.

- **With a GitHub account:** open an issue on [GitHub Issues](https://github.com/misavojte/GazePlotter/issues). Reports there are public, so others with the same problem can find them.
- **Without one:** email [mail@vojtechovska.com](mailto:mail@vojtechovska.com). Describe what you did, what you expected, and which eye tracker the data came from. Please do not attach participant data unless asked.

## Who makes GazePlotter

GazePlotter is developed by [Michaela Vojtechovska](https://vojtechovska.com) and [Stanislav Popelka](https://www.geoinformatics.upol.cz/lide/stanislav-popelka/?lang=en) at the [Eye-tracking Laboratory](https://eyetracking.upol.cz) of the Department of Geoinformatics, Palacký University Olomouc.

It started in 2022 as Michaela's master's project and was vastly expanded during the PhD that followed, under Stanislav's supervision. Today it supports the department's own eye-tracking research as well as commercial eye-tracking applications, so it will keep being maintained and expanded. The tool is and will remain free.

Its publication and conference presentations were supported by the Czech Science Foundation (GAČR) project *Identification of barriers in the process of communication of spatial socio-demographic information* (23-06187S).

Want to collaborate, need a feature for your study, or teach with GazePlotter? Write to [mail@vojtechovska.com](mailto:mail@vojtechovska.com). We don't track who uses GazePlotter, so we are always glad to hear where it helped.

![Michaela presenting GazePlotter at the Cognition and Artificial Life conference.](/images/gazeplotter_presentation.png)

## Open source

GazePlotter is licensed under [GNU GPL v3](https://github.com/misavojte/GazePlotter/blob/main/LICENSE).

- [Source code on GitHub](https://github.com/misavojte/GazePlotter)
- [npm package](https://www.npmjs.com/package/gazeplotter) for [embedding GazePlotter](/docs/advanced/embedding/) in your own application
- [Changelog](/docs/changelog/)
