# Getting started with GazePlotter

GazePlotter is a web application for visualizing gaze data from eye-tracking software. It uses interactive scarf plots (or sequence charts) which are built automatically from your eye-tracking data without any manual configuration and data transformation.

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

You can also select a GazePlotter workspace `.json` file to restore a saved session — useful for sharing analyses. A single `.json` file is always treated as a workspace import.

### Event files

Include event files (`.xml`, or `.json` alongside other files) in the same selection. GazePlotter detects them and prompts you to map them to stimuli and participants after the eye-tracking data is parsed. See [Event Data](/docs/upload-data/events/) for details.

## Starting over

There is no demo-reload button. To return to the demo data, reload the page; to replace the current data, import new files.
