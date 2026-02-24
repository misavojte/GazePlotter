---
title: Segmented data export
order: 3
---

# Segmented Data Export

The Segmented Data Export pipeline serializes raw eye-tracking vectors into structured CSV files meticulously formatted for advanced manipulation in spreadsheet software (Excel, Google Sheets) or command-line scripting architectures (Python, R).

## Data Structure

Segmented CSV file outputs contain highly granular, row-level sequential eye-tracking logic exposing:

- Unified participant identifiers.
- Stimulus metadata connections.
- Raw fixation coordinates (X, Y) and localized duration metrics.
- Hardcoded AOI collision assignments.
- Absolute micro-second timestamp delineations.
- Computed gaze event classifications.

## Export Architectures

To accommodate varied programmatic ingestion requirements, the exporter natively supports two distinct structural outputs.

### Architecture 1: Single Unified CSV

Exports the entire target dataset into one monolithic `.csv` file. Every single recording from every active participant is sequentially appended inside this singular file structure.

**Analytical Use Case:**

- Best suited for programmatic ingestion (R, SPSS, Python `pandas`) where algorithmic filtering of massive monolithic dataframes is trivial.
- Preferable when running continuous batch scripts or constructing unified deep-learning training sets.

#### Execution Workflow

1. Navigate to the principal **Export Format** parameter group.
2. Select the base **CSV** toggle option.
3. Define the root identifier text in the **Export Options** filename field.
4. Depress the **Download** command button to compute and localize the monolithic CSV.

### Architecture 2: Individual Sharded CSVs

Automatically shards the export into dozens of individual, isolated `.csv` files dedicated to every single participant. The entire collection is securely archived and delivered as a compressed `.zip` package.

**Analytical Use Case:**

- Optimal for manual spreadsheet analysis or environments requiring isolation of subject data arrays.
- Ideal when rapidly distributing singular participant datasets to secondary researchers.

#### Execution Workflow

1. Navigate to the principal **Export Format** parameter group.
2. Select the specialized **Individual CSV** toggle option.
3. Define the root identifier text for the zip file inside the **Export Options** parameter.
4. Depress the **Download** command button to authorize the loop. The system will iterate across every participant, create the separated CSVs, package them natively in standard `.zip` architecture, and instantiate the download.
