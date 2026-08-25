# Supported Eye-Tracker File Formats

GazePlotter visualizes gaze data uploaded from all major eye-tracking software: Tobii Pro Lab, SMI BeGaze, Gazepoint, Pupil Cloud, Varjo, OGAMA, and custom CSV files. Visualizations are built automatically from your eye-tracking data without any manual configuration or data transformation.

The workspace is designed to be easy to use and to provide a quick overview of the data and is available at [gazeplotter.com](https://gazeplotter.com).

On loading the workspace, you will see a demo data visualization. The demo data is a sample from the [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/) software, with _fixations_ (and AOI hits), _saccades_, and _EyesNotFound_ segments.

## Import button

Click **Import** in the workspace to upload your own files. GazePlotter detects the file type automatically and builds the visualizations.

### Supported file types

The workspace supports the following file types:

- [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/)
- [OGAMA](/docs/upload-data/ogama/)
- [GazePoint](/docs/upload-data/gazepoint/)
- [SMI BeGaze](/docs/upload-data/smi-begaze/)
- [Varjo XR](/docs/upload-data/varjo/)
- [Pupil Cloud](/docs/upload-data/pupil-cloud/)
- [Custom CSV](/docs/upload-data/custom-csv/)

### Workspace import

You can also select a GazePlotter workspace file to restore a saved session, which is useful for sharing analyses. A single `.json` file is always treated as a workspace import; workspaces saved with stimulus reference media are `.gazeplotter.zip` archives and import the same way.

### Event files

Include event files (`.xml`, or `.json` alongside other files) in the same selection. GazePlotter detects them and prompts you to map them to stimuli and participants after the eye-tracking data is parsed. See [Event Data](/docs/upload-data/events/) for details.

### Reference media files

Include image or video files in the same selection to attach them to stimuli as reference media, drawn behind gaze data in the [Scanpath](/docs/visualizations/scanpath/) plot. A file whose name (without extension) matches a stimulus name attaches automatically; unmatched files prompt for manual assignment. Media can also be uploaded on their own once eye-tracking data is loaded, or attached per stimulus in the [Stimuli Library](/docs/workspace/stimuli-library/#reference-media).

## Starting over

There is no demo-reload button. To return to the demo data, reload the page; to replace the current data, import new files.
