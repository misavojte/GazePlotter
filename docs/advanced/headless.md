# Headless GazePlotter

The analysis engine runs without the workspace, on the command line. It is
the same code the app runs, so a
table computed headlessly equals the app's
[Metric Data export](/docs/export/metric-data/) for the same settings.

The intended workflow: configure a study once in the app (rename AOIs, merge
participants, save selections, build the metric library), export its
**Analysis**, and replay that Analysis on every further recording from a
script or a pipeline.

## The Analysis

An Analysis is everything a workspace adds to raw recordings to turn them
into a study's analysis, keyed by displayed name so it carries over to other
recordings of the same study. It is a JSON file. In a Methods section, call
it the analysis specification.

| Field | What it holds |
| --- | --- |
| `gazeplotter`, `schema` | The version that wrote it and the schema version (currently 1) |
| `renames` | Source name to displayed name, for stimuli, participants, eye-movement types, and per stimulus for AOIs and event channels |
| `merges` | Folds of participants or stimuli into a representative, by displayed name |
| `selections` | Named selections and their members, for every library |
| `noAoi` | The name and colour of the No AOI treatment, as shown in the app |
| `metrics` | The metric library: every instance with its parameters, projection, window, and label |

A small one, for a study with two renamed AOIs and one saved group:

```json
{
  "gazeplotter": "1.10.3",
  "schema": 1,
  "renames": {
    "stimuli": [], "participants": [], "categories": [],
    "aois": { "Scene": [{ "from": "AOI 1", "to": "Face" }, { "from": "AOI 2", "to": "Text" }] },
    "events": {}
  },
  "merges": [],
  "selections": {
    "participants": [{ "name": "Experts", "members": ["P03", "P07"] }],
    "stimuli": [], "categories": [], "aois": [], "events": []
  },
  "noAoi": { "displayedName": "No AOI", "color": "#cbd5e1" },
  "metrics": [
    { "id": "absoluteTime", "baseId": "absoluteTime", "params": {}, "label": "Dwell time",
      "projection": { "kind": "identity-aoi-vector" } }
  ]
}
```

Three places produce it:

- **Export** then **Analysis (JSON)** in the app.
- The ZIP of a [Metric Data export](/docs/export/metric-data/#sidecar-codebook) with the codebook enabled, beside the codebook.
- The command line writes it beside every table it exports.

Replaying an Analysis renames by source name, then merges and selects by
displayed name, then installs the metric library through the same
constructor the app uses, so parameters are resolved and a metric this
version does not know is reported. A name that matches nothing is reported
and skipped, never guessed. A merge joins one entity that was split across
files; a merge whose members record on the same stimulus is refused, as it
is in the app, because pooling repeated sessions would be a different
analysis.

### What the Analysis does not contain

Everything upstream of GazePlotter: fixation classification, AOI geometry,
sampling rate, coordinate space, and the vendor's export settings. A Methods
section states those separately. AOI, event, and eye-movement selections are
plot settings; the metrics table always ranges over every AOI, with the
`No_AOI` and `Any_Fixation` columns, as the app's export does.

## Command line

Requires Node 20 or later. Pin the version you cite:

```bash
npx gazeplotter@1.10.3 inspect  recordings/*.tsv
npx gazeplotter@1.10.3 analysis study.gazeplotter > study.analysis.json
npx gazeplotter@1.10.3 metrics  recordings/*.tsv --analysis study.analysis.json --out metrics.csv
npx gazeplotter@1.10.3 catalog
```

| Command | Output |
| --- | --- |
| `inspect <files...>` | What the recordings contain: participants, stimuli with their AOIs, event channels, recorded participants and time span, selections, and the metric instances with their ids, parameters, and projections |
| `analysis <workspace>` | The workspace's Analysis |
| `metrics <files...>` | The metrics table as CSV, to stdout or to `--out` |
| `catalog` | Every base metric in the library: id, unit, shape, parameters, description |

Files are eye-tracker exports in any [supported format](/docs/upload-data/),
CSV event files, or one `.gazeplotter` workspace. A saved workspace opens
with its merges applied, as in the app.

A metric in the table is a configured instance: a base metric from the
library (`catalog` lists them, with their parameters), its parameter values,
and a projection that picks the output shape (per AOI, one AOI, a summary,
a window). Two instances of one base can differ entirely, so `metrics`
never assumes which ones you want: name them with `--metrics`, take every
instance with `--metrics all`, or pass the Analysis that defines them.
`inspect` lists the dataset's instances with their ids, parameters, and
projections; a fresh recording carries the app's starter library.

Options for `metrics`:

| Option | Meaning |
| --- | --- |
| `--analysis <file>` | An Analysis JSON, or a workspace whose Analysis is replayed first |
| `--metrics <ids>` or `all` | The configured metric instances to compute, by id or label, or every one the layout can hold. Required unless `--analysis` names them. A label shared by several instances is an error; use the id |
| `--participants <names>` | A saved participants selection, or participant names, comma-separated. Default: all |
| `--stimuli <names>` | A saved stimuli selection, or stimulus names, comma-separated. Default: all |
| `--format long` or `wide` | Table layout, as in the app. Default: long |
| `--start <ms>`, `--end <ms>` | Time range in milliseconds of recording time. Omitting `--end` means the recording end; `--start` alone is allowed |
| `--codebook` | Also write the codebook beside the table |
| `--decimal ,` | Decimal comma instead of point |
| `--out <file.csv>` | Write there; the Analysis that was applied goes beside it as `<stem>.analysis.json`, and `<stem>.run.json` records the run |
| `--prompt <id=value>` | Answer a format prompt. Tobii exports with an Event column ask `tobii-parsing-input`; see below |
| `--lenient` | Exit 0 even when a name matched nothing or the table is empty |

The run record lists the input files with their size and SHA-256, the
Analysis file and its SHA-256, the participants, stimuli, and metric ids
used, the time range, the layout, the row count, and every name that
matched nothing. Attach it with the table.

Warnings go to stderr, prefixed `warning:`. Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Done |
| 1 | An error: a file could not be read or parsed, an option is invalid, a metric id is unknown |
| 2 | The run completed but not over what was asked for: a name in the Analysis or an option matched nothing, or the table has no rows |

The Tobii prompt takes a JSON parsing configuration: `""` for stimuli from
the media column, `{"stimulusStartSuffix":"_start","stimulusEndSuffix":"_end"}`
for interval markers in the Event column, `{"stimulusWeb":true}` for web
recordings. Headlessly it must be answered; the app asks in a dialog.

From R or Python, call the command and read the table (on Windows the
executable is `npx.cmd`):

```r
status <- system2("npx", c("gazeplotter@1.10.3", "metrics", "rec.tsv", "--analysis", "study.analysis.json", "--out", "metrics.csv"))
stopifnot(status == 0)
metrics <- read.csv("metrics.csv")
```

```python
import subprocess, pandas as pd
subprocess.run(["npx", "gazeplotter@1.10.3", "metrics", "rec.tsv", "--analysis", "study.analysis.json", "--out", "metrics.csv"], check=True)
metrics = pd.read_csv("metrics.csv")
```

## Not headless

Figures need a browser canvas, so they stay in the app. Reference media is
not loaded headlessly; metrics do not use it. Legacy XML and JSON event
files are mapped in the app's dialog; CSV event files work headlessly.
