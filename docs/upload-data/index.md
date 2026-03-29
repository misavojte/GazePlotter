---
title: Import options
order: 1
---

# Getting started with GazePlotter

GazePlotter is a web application for visualizing gaze data from eye-tracking software. It uses interactive scarf plots (or sequence charts) which are built automatically from your eye-tracking data without any manual configuration and data transformation.

The workspace is designed to be easy to use and to provide a quick overview of the data and is available at [gazeplotter.com](https://gazeplotter.com).

On loading the workspace, you will see a demo data visualization. The demo data is a sample of the data from the [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/) software. The demo data contains information about _fixations_ (and AOI hits) and _saccades_. Only other eye-movement category is _EyesNotFound_.

## Upload data button

You can upload your own eye-tracking data files to the GazePlotter workspace. The platform will automatically detect the file type and start a visualization of your data.

### Supported file types

The workspace supports the following file types:

- [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/)
- [OGAMA](/docs/upload-data/ogama/)
- [GazePoint](/docs/upload-data/gazepoint/)
- [SMI BeGaze](/docs/upload-data/smi-begaze/)
- [Varjo XR](/docs/upload-data/varjo/)
- [Pupil Cloud](/docs/upload-data/pupil-cloud/)
- [Custom CSV](/docs/upload-data/custom-csv/)

### workspace data import

You can also select `.json` data from the GazePlotter workspace for data upload. This is useful if you want to share your data with someone else.

## Reload Demo button

To revert the workspace to its initial state, hit `Reload Demo` button. This will remove all the data from the workspace and load the demo data again.
