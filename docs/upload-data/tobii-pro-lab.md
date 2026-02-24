---
title: Tobii Pro Lab upload
order: 2
outline: deep
---

# Tobii Pro Lab Synchronization

To integrate gaze arrays natively exported from Tobii Pro Lab architecture directly into GazePlotter, the raw data structures must be serialized into the `.tsv` file extension protocol.

::: warning Structural Limitations
Due to the strict proprietary nature of Tobii's export engines, their natively generated `.tsv` files completely fail to export dynamic AOI visibility matrices or moving spatial parameters.
:::

## Pre-Processing Workflow (Tobii Pro Lab)

Execute these technical steps securely within the native Tobii interface prior to importing.

### Navigating the Engine

1. **Locate Tool**: Engage the overarching `Analyze` tab within the primary header nav.
2. **Access Module**: Execute the `Data Export` sub-module command.

### Configuring Parameters

1. **Data Architecture**: Within the right-hand properties panel, explicitly force the `Format` directive strictly to `Single standard file (.tsv)`.
2. **Column Constraints**: To optimize internal ingestion speeds and prevent parsing footprint bloat, exclusively select only these 7 precise column metrics. All others are recommended to be deselected:

| System Target Column Name |
| :------------------------ |
| Participant name          |
| Recording name            |
| Presented Stimulus name   |
| Eye movement type         |
| Eye movement type index   |
| Event                     |
| AOI hit                   |

### Execution

3. **Execution**: Fire the **Export** button to serialize the finalized `.tsv` to local storage.

## Ingestion Workflow (GazePlotter)

Once safely serialized, the array can be imported seamlessly into the spatial canvas.

### Upload Routine

1. **Target Area**: Ensure you are occupying the main [GazePlotter GUI dashboard](/docs/basic/).
2. **Command Interaction**: Depress the primary **Upload data** action button.
3. **Selection Details**: Utilize your local OS modal window to target the recently configured `.tsv` file generated directly from the Tobii system.

### Stimulus Parsing Prompt

Once the structural `.tsv` is successfully received, the GazePlotter engine will actively prompt you to define how it should computationally extract stimulus delineations. Select the explicit methodology that matches your hardware and experimental architecture:

- **Media Column**: Instructs the engine to extract default stimulus strings directly from the `Presented Stimulus name` column. Used exclusively for classic **Screen-based experiments**.
- **Interval Events**: Instructs the engine to isolate stimuli computationally based upon explicit `IntervalStart` and `IntervalEnd` markers nested within the Event column. Used predominantly for mobile/wearable **Glasses experiments**.
- **Web Stimulus Events**: Instructs the engine to isolate individual dynamic URLs as independent stimuli matrices.
- **Custom Markers**: Allows you to explicitly define and input your own custom delimiter string markers (e.g., `_start;_end`) to force temporal stimulus boxing.

## Data Reference Standard

Engineers or technicians seeking properly formatted source architecture tests can clone standardized sample files safely from our Open Science repositories.

- [OSF Sample Data Storage](https://osf.io/j58v3)
