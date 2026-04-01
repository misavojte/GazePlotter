---
title: Scanpath Similarity Export
order: 5
---

# Scanpath Similarity Export

The Scanpath Similarity Export generates a similarity matrix computed from participant scanpath sequences for a selected stimulus and group. It uses the same algorithms as the Scanpath Similarity visualization.

## Data Structure

- CSV matrix with rows and columns for each participant.
- First two columns are `Participant_ID` and `Participant_Label`.
- Remaining columns are labeled as `Name (ID X)` and align with the matrix columns.
- Similarity values are normalized to the 0 to 1 range and rounded to three decimals.

## Export Configuration

- **File name**: Output file name without extension.
- **Stimulus**: Target stimulus used to build scanpaths.
- **Participant Group**: Participant cohort to include in the matrix.
- **Similarity Method**: Choose **Levenshtein** or **Needleman-Wunsch**.
- **Delimiter**: Choose **Comma (,)** or **Semicolon (;)**.
- **Decimal Separator**: Choose **Dot (.)** or **Comma (,)**.
- **Collapse consecutive AOIs**: Collapses repeated AOI hits before similarity is computed.

## Execution Workflow

1. Click the **Export workspace or data** button in the [Workspace Toolbar](/docs/basic/workspace/#workspace-toolbar).
2. In the **Research Data Formats** section, click the **Scanpath Similarity (CSV)** card.
3. Configure **File name**, **Stimulus**, **Participant Group**, and **Similarity Method**.
4. Click **Export Similarity Matrix** to download the CSV.
