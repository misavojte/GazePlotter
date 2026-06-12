# Eye-Tracking Source Metadata

The persistent Source Metadata dashboard inside GazePlotter grants analysts complete operational visibility over ingested eye-tracking datasets. It exposes deep technical processing logs, architectural file sizing, and real-time computation memory utilization.

## Accessing the Dashboard

To command the Source Metadata system:

1. Locate the persistent left [Workspace Toolbar](/docs/setup/workspace/#workspace-toolbar).
2. Click the specialized **Source Metadata button** (represented by a document icon).

## Exposed Structural Information

The dashboard systematically categorizes telemetry and processing logs.

### Active Data Overview

Core volumetric totals mapping the active workspace session.

- **Stimuli Count**: Absolute integer total of distinct stimuli sequences.
- **Participant Total**: Absolute integer total of distinct subject arrays.
- **Global AOI Footprint**: Total aggregation of all unique Areas of Interest dynamically mapped across all instantiated stimuli.
- **Stimulus Density Map**: A granular breakdown directly exposing the exact quantity of mapped AOIs logically bound to each specific individual stimulus string.

### Origin Ingestion Telemetry

Precise hardware parsing parameters captured mechanically during the initial file upload sequence.

_(Note: Data structures processed by GazePlotter firmware prior to version 1.7.0 will logically return NULL for these tracking values)._

- **Ingestion Scale**: Count of original raw files parsed.
- **File Architecture**: The specific explicit filenames alongside calculated byte footprint sizes.
- **Processing Payload**: The total mathematical byte weight of the ingested array.
- **Engine Execution Delay**: Explicit millisecond duration required for the parsing engine to successfully execute.
- **Timestamp Log**: Server-normalized ingestion timestamp.
- **Parser Constraints**: Deep technical variables utilized by the conversion engine, including:
  - Base target formatting protocol.
  - Hardcoded row serialization delimiters.
  - Hardcoded column separation matrices.
  - Defined explicit client manual overrides.

### Real-Time System Resources (RAM)

Live memory analytics directly reporting the browser-level JavaScript heap implementation. All computations operate entirely locally within your client architecture.

- **Allocated Memory Surface**: The absolute ceiling limits granted to the environment by the host OS.
- **Active Heap Footprint**: Live measurement of aggressively active computational memory currently consumed by analytical parsing.
- **Architectural Limit**: Hard JS structural memory limits.
- **Execution Utilization**: Live percentage calculation mapping memory consumption against the available memory ceiling.

## Metadata Serialization

Analysts maintaining strict chain-of-custody tracking or laboratory quality control logs can serialize this telemetry data.

### Generating Audit Logs

- **Action**: Click the active **Export Metadata** command button.
- **Behavior**: The engine generates a comprehensive, aggregated `.csv` text array encapsulating all currently visible telemetry elements. Use this strictly formatted array for support troubleshooting or rigid protocol documentation logs.
