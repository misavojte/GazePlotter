---
title: Source Metadata
order: 2
---

# Eye-tracking Source Metadata

The Source Metadata panel in GazePlotter provides comprehensive information about your uploaded eye-tracking data, processing details, and system resource usage.

## Accessing Source Metadata

Click the **Source Metadata** button (document icon) in the [workspace toolbar](/docs/basic/workspace/#workspace-toolbar) to view detailed information about your data and processing.

## Information Displayed

### Data Overview

- **Number of Stimuli** - Count of stimuli/trials in your dataset
- **Number of Participants** - Total participant count
- **Total Number of AOIs** - Sum of all Areas of Interest across all stimuli
- **AOIs per Stimulus** - Breakdown showing AOI count for each individual stimulus

### Current Parsing (if applicable)

When processing workspace files that differ from original uploads:

- **Files Being Processed** - Count of files currently being processed
- **File Names and Sizes** - Individual file details with sizes
- **Total File Size** - Combined size of all files being processed
- **Parse Date** - When the current processing occurred

### Source Parsing (Original Eye Tracking Export)

Information about the original data files:

- **Files Processed** - Count of original uploaded files
- **File Names and Sizes** - Details of each original file
- **Total File Size** - Combined size of all original files
- **Parse Duration** - Time taken to process the original files
- **Parse Date** - When original processing occurred
- **GazePlotter Version** - Version used for original processing
- **Client** - Browser/system information from original processing
- **Parse Settings** - Technical details including:
  - Type of data format
  - Row delimiter used
  - Column delimiter used
  - User input settings (if applicable)

### RAM Usage

Real-time memory usage information:

- **Current JS Heap Size (used)** - Memory currently in use
- **Total JS Heap Size (allocated)** - Memory allocated to the application
- **JS Heap Size Limit (max available)** - Maximum memory available
- **Memory Utilization** - Percentage of available memory being used

## Export Functionality

Use the **Export Metadata** button to download a comprehensive CSV file containing all metadata information. This is useful for:

- **Documentation** - Keep records of your data processing
- **Troubleshooting** - Share technical details when seeking support
- **Research Records** - Maintain audit trails for your analysis

## Legacy Data Support

For data processed before GazePlotter version 1.7.0, source parsing metadata may not be available, as this feature was introduced in later versions.

## Privacy & Security

All metadata is processed and stored locally in your browser. Memory usage monitoring and metadata export operate entirely client-side, ensuring complete privacy of your research data.
