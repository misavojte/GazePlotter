---
title: ScanGraph export
order: 5
---

# ScanGraph Export

The specialized ScanGraph Export format serializes standard spatial gaze tracking data strictly into letter-coded sequence strings. This structural transformation bridges native GazePlotter analysis directly into the algorithmic sequence-matching software provided by the ScanGraph suite.

## Analytical Purpose

Abstracting coordinate plots into letter-coded syntax allows automated computational architectures to perform:

- Granular scanpath parity algorithms.
- Massive scale fixation sequence juxtaposition between independent participants.
- The creation of intricate algorithmic-derived similarity matrices.

## File Architecture

A generated ScanGraph export strictly utilizes basic `.txt` syntax formatted specifically for external ingestion.

- **Letter Encoding**: Every single independent fixation registered inside a defined AOI is computed and assigned an alphabetical character ID.
- **Sequence Mapping**: The sequential temporal flow of fixations is explicitly mapped as long literal strings of these alphabetical characters.
- **Index Header**: The internal matrix key logically linking the specific alphabetical characters back to the semantic human-readable AOI names is definitively printed on lines 4 and 5 of the generated file header.

## Execution Workflow

To serialize your active data into ScanGraph compliance strings:

1. Locate the master **Export Format** configuration section.
2. Select the explicit **ScanGraph** system integration option.
3. Utilize the dropdown constraints to target a desired active stimulus parameter.
4. Define your preferred output prefix in the file name input.
5. Depress **Download** to actively compute the algorithmic `.txt` file and serialize it to your local machine.

## Integration Guidelines

GazePlotter is capable of directly feeding the [ScanGraph Cloud Platform](http://eyetracking.upol.cz/scangraph).

1. Retrieve the successfully downloaded `.txt` text file.
2. Upload the raw text file directly into the ScanGraph web application.
3. Command ScanGraph to process the serialized logical sequence matrices.
4. Utilize ScanGraph's external algorithms to generate advanced heatmap parity networks and similarity visualizations.

![](/docs/images/scangraph-1.png)

## Development Roadmap

Deep API-based integration between the GazePlotter application and the external ScanGraph engine is currently slated for deployment in future iterations. This technical bridge will eliminate the requirement for manual `.txt` handoff procedures, providing direct pipeline analytics.

_Developers or researchers interested in augmenting or utilizing this integration topology should contact the core team via [mail@vojtechovska.com](mailto:mail@vojtechovska.com)._
