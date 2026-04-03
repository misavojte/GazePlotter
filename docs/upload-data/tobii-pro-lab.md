# Tobii Pro Lab Synchronization

To integrate gaze arrays natively exported from Tobii Pro Lab architecture directly into GazePlotter, the raw data structures must be serialized into the `.tsv` file extension protocol.

## Pre-Processing Workflow (Tobii Pro Lab)

Execute these technical steps securely within the native Tobii interface prior to importing.

### Navigating the Engine

1. **Locate Tool**: Engage the overarching `Analyze` tab within the primary header nav.
2. **Access Module**: Execute the `Data Export` sub-module command.

### Configuring Parameters

1. **Data Architecture**: Within the right-hand properties panel, explicitly force the `Format` directive strictly to `Single standard file (.tsv)`.
2. **Column Constraints**: To optimize internal ingestion speeds and prevent parsing footprint bloat, include these core metrics. Spatial columns are optional:

| System Target Column Name |
| :------------------------ |
| Recording timestamp       |
| Participant name          |
| Recording name            |
| Presented Stimulus name   |
| Eye movement type         |
| Eye movement type index   |
| Event                     |
| Event value               |
| AOI hit                   |

Optional spatial columns:

| Spatial Target Column Name |
| :------------------------- |
| Mapped fixation X          |
| Mapped fixation Y          |
| Fixation point X           |
| Fixation point Y           |

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

## Spatial Coordinate Parsing

When Tobii coordinate columns are available, GazePlotter stores a segment-level spatial coordinate for fixation segments.

Priority order:

1. `Mapped fixation X` + `Mapped fixation Y` (preferred)
2. `Fixation point X` + `Fixation point Y` (fallback)
3. If neither complete pair is available, no spatial coordinate is stored for that segment

Notes:

- Both X and Y are required as a pair.
- If only one value is present, the row is treated as no spatial data.
- The first valid coordinate pair within a segment is used for that segment.

## Data Reference Standard

Engineers or technicians seeking properly formatted source architecture tests can clone standardized sample files safely from our Open Science repositories.

- [OSF Sample Data Storage](https://osf.io/j58v3)
