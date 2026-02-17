---
title: Pupil Cloud upload
order: 7
---

# Pupil Cloud Data Upload

GazePlotter supports importing eye-tracking data from **Pupil Cloud** exports. This format allows you to import multiple experimental conditions (surfaces) as separate stimuli in a single upload.

## Prerequisites

Before uploading to GazePlotter, you need to prepare your data in Pupil Cloud:

1. **Gaze Mapping**: Map gaze data to surfaces in Pupil Cloud
2. **AOI Definition**: Draw Areas of Interest (AOIs) on each surface
3. **Export**: Export the data as ZIP files from Pupil Cloud

## Data Preparation in Pupil Cloud

### 1. Gaze Mapping

- In Pupil Cloud, map your gaze data to the appropriate surfaces
- Each surface represents one experimental condition or stimulus
- Ensure gaze data is properly calibrated and mapped

### 2. AOI Definition

- Draw Areas of Interest (AOIs) on each surface
- Name your AOIs clearly for easy identification in GazePlotter
- AOIs can overlap and have different shapes

### 3. Export Format

- Export each surface as a separate ZIP file
- Each ZIP contains three key CSV files:
  - `sections.csv` - Recording metadata and participant information
  - `aoi_fixations.csv` - Fixation data with AOI associations
  - `fixations.csv` - Raw fixation data with timestamps

## Upload Process

### Single Surface Upload

1. Click **"Import workspace or data"** button
2. Select your Pupil Cloud ZIP file
3. GazePlotter will automatically:
   - Extract the three CSV files
   - Parse fixation data and AOI associations
   - Create a stimulus from the ZIP filename
   - Process participant names (timestamps are automatically stripped if unique)

### Multiple Surfaces Upload

1. Click **"Import workspace or data"** button
2. **Multi-select** multiple ZIP files (each representing a different surface/condition)
3. GazePlotter will:
   - Process each ZIP as a separate stimulus
   - Combine participants across all surfaces
   - Maintain AOI namespaces per stimulus
   - Normalize timing per participant per stimulus
