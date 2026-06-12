export interface SidebarLink {
  name: string
  href: string
  breadcrumbName?: string
  description?: string
  slug?: string
}

export interface SidebarSection {
  title: string
  links: SidebarLink[]
}

export type SidebarItem = SidebarSection | SidebarLink

export const SIDEBAR: readonly SidebarItem[] = [
  {
    name: 'Getting Started',
    href: '/docs',
    description: 'Learn how to use GazePlotter, a free, browser-based tool for analyzing and visualizing eye-tracking data without uploads or registration.'
  },
  {
    title: 'Uploading Data',
    links: [
      {
        name: 'Upload Data',
        href: '/docs/upload-data',
        description: 'Discover GazePlotter\'s data ingestion suite. Learn how to import eye-tracking coordinate, fixation, and event logs from diverse files.'
      },
      {
        name: 'Custom CSV',
        href: '/docs/upload-data/custom-csv',
        description: 'Import eye-tracking data using GazePlotter\'s custom CSV parser. Learn the required columns, headers, and delimiter settings for format compatibility.'
      },
      {
        name: 'Gazepoint',
        href: '/docs/upload-data/gazepoint',
        description: 'Guidelines for importing Gazepoint eye-tracker data. Map fixations, pupil size, and timestamp data from Gazepoint output files directly.'
      },
      {
        name: 'Ogama',
        href: '/docs/upload-data/ogama',
        description: 'Import eye-tracking data exported from OGAMA. Map participant gaze logs and coordinate systems to GazePlotter\'s analytical workspace.'
      },
      {
        name: 'Pupil Cloud',
        href: '/docs/upload-data/pupil-cloud',
        description: 'Learn to import Pupil Labs cloud data. Load fixations, gaze vectors, and surface mapping files into GazePlotter for advanced analysis.'
      },
      {
        name: 'SMI BeGaze',
        href: '/docs/upload-data/smi-begaze',
        description: 'Import SMI BeGaze eye-tracking logs. Learn how to process overlapping AOIs, fixations, and event datasets from SMI hardware exports.'
      },
      {
        name: 'Tobii Pro Lab',
        href: '/docs/upload-data/tobii-pro-lab',
        description: 'Guide to loading Tobii Pro Lab exports. Support dynamic AOIs, participant metrics, and visual sequence logs seamlessly in GazePlotter.'
      },
      {
        name: 'Varjo',
        href: '/docs/upload-data/varjo',
        description: 'Guidelines for importing VR/AR eye-tracking data from Varjo headsets. Map 3D gaze vectors and timestamps to GazePlotter templates.'
      },
      {
        name: 'Events',
        href: '/docs/upload-data/events',
        description: 'Learn to format and upload event logs for stimulus overlays, enabling dynamic timeline visualization alongside participant gaze data.'
      },
    ],
  },
  {
    title: 'Workspace & Setup',
    links: [
      {
        name: 'Overview',
        breadcrumbName: 'Workspace & Setup',
        href: '/docs/setup',
        description: 'Master the GazePlotter workspace. Learn to add, arrange, configure, and customize layout settings for all eye-tracking plots.'
      },
      {
        name: 'Workspace',
        href: '/docs/setup/workspace',
        description: 'Understand layout controls, drag-and-drop operations, and configurations for GazePlotter\'s flexible multi-plot analysis workspace.'
      },
      {
        name: 'AOI Library',
        href: '/docs/setup/aoi-library',
        description: 'Configure Areas of Interest (AOIs). Learn how to set labels, custom colors, and coordinates to isolate specific regions of a stimulus.'
      },
      {
        name: 'Event Library',
        href: '/docs/setup/event-library',
        description: 'Define, name, and color-code custom event categories in GazePlotter to overlay timeline events on top of raw gaze recordings.'
      },
      {
        name: 'Participant Groups',
        href: '/docs/setup/participant-groups',
        description: 'Create and edit participant groups. Perform comparative analyses across cohorts, demographics, or experimental conditions.'
      },
      {
        name: 'Participant Library',
        href: '/docs/setup/participant-library',
        description: 'Manage participant lists, metadata, and active datasets. Toggle participant visibility across different visualization panels.'
      },
      {
        name: 'Stimuli Library',
        href: '/docs/setup/stimuli-library',
        description: 'Import, scale, and manage stimulus images in your project. Align coordinates for precise Areas of Interest (AOI) overlays.'
      },
    ],
  },
  {
    title: 'Metrics Library',
    links: [
      {
        name: 'Overview',
        breadcrumbName: 'Metrics',
        href: '/docs/metrics',
        description: 'Introduction to the GazePlotter Metrics Library. Customize and configure parameters for a comprehensive suite of eye-tracking metrics.'
      },
      {
        name: 'Fixation & Dwell Durations',
        href: '/docs/metrics/durations',
        description: 'Analyze absolute, relative, and average dwell times. Learn the formulas and options for calculating temporal eye-movement metrics.'
      },
      {
        name: 'Gaze Counts & Latency',
        href: '/docs/metrics/counts-latency',
        description: 'Calculate visit counts, fixation counts, and Time to First Fixation (TTFF) to measure visual salience and participant attention.'
      },
      {
        name: 'Transitions & Markov Metrics',
        href: '/docs/metrics/transitions',
        description: 'Model gaze transitions using Markov chains. Measure directional probability patterns between Areas of Interest (AOIs).'
      },
      {
        name: 'Recurrence Quantitative Analysis (RQA)',
        href: '/docs/metrics/rqa',
        description: 'Apply non-linear dynamics to scanpaths. Measure determinism, laminarity, and recurrence rates in visual search patterns.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/metrics/scanpath-similarity',
        description: 'Compare gaze sequences using Levenshtein distance and Needleman-Wunsch alignment algorithms to compute pairwise similarity.'
      },
    ],
  },
  {
    title: 'Visualizations',
    links: [
      {
        name: 'Eye-tracking Visualizations',
        breadcrumbName: 'Visualizations',
        href: '/docs/visualizations',
        description: 'Explore GazePlotter\'s visualization dashboard. View interactive tools for scarf plots, scanpaths, correlation matrices, and metrics.'
      },
      {
        name: 'Scarf Plot',
        href: '/docs/visualizations/scarf-plot',
        description: 'Configure and interpret Scarf Plots. Visualize chronological gaze sequences, fixations, and event layers across multiple participants.'
      },
      {
        name: 'AOI Metrics',
        href: '/docs/visualizations/aoi-metrics',
        description: 'Generate interactive bar charts for AOI metrics, including dwell durations, fixation counts, and latency comparisons.'
      },
      {
        name: 'Transition Matrix',
        href: '/docs/visualizations/transition-matrix',
        description: 'Create transition matrix heatmaps showing the frequency and probability of gaze shifts between different Areas of Interest.'
      },
      {
        name: 'AOI Occupancy Plot',
        href: '/docs/visualizations/aoi-occupancy',
        description: 'Render temporal stacked distributions, ridgelines, and heatmaps showing how participant attention flows across AOIs over time.'
      },
      {
        name: 'Recurrence Plot',
        href: '/docs/visualizations/recurrence-plot',
        description: 'Generate N×N recurrence plots to reveal temporal self-similarity and patterns within an individual\'s eye-movement path.'
      },
      {
        name: 'Scanpath Plot',
        href: '/docs/visualizations/scanpath',
        description: 'Overlay 2D spatial scanpaths on stimulus images, visualizing fixation location, duration, order, and directional saccades.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/visualizations/scanpath-similarity',
        description: 'Visualize sequence alignment matrices and construct ScanGraph networks to map structural similarity across participant groups.'
      },
      {
        name: 'Evolving Metrics',
        href: '/docs/visualizations/evolving-metrics',
        description: 'Track eye-tracking metrics over time using rolling heatmaps or line charts to evaluate dynamic temporal trends in gaze behaviors.'
      },
      {
        name: 'Metric Correlation',
        href: '/docs/visualizations/metric-correlation',
        description: 'Analyze correlations between different eye-tracking metrics using Pearson/Spearman heatmaps and Scatter Plot Matrices (SPLOM).'
      },
    ],
  },
  {
    title: 'Export',
    links: [
      {
        name: 'Export',
        href: '/docs/export',
        description: 'Overview of GazePlotter\'s data export tools. Save workspace states, high-resolution plots, and aggregated statistical data.'
      },
      {
        name: 'Workspace',
        href: '/docs/export/workspace',
        description: 'Export GazePlotter workspace states as files to save your configuration, customized plots, and group libraries for future sessions.'
      },
      {
        name: 'Scangraph',
        href: '/docs/export/scangraph',
        description: 'Export similarity network datasets in GraphML format for advanced network analysis of visual search paths in tools like Gephi.'
      },
      {
        name: 'Aggregated Data',
        href: '/docs/export/aggregated-data',
        description: 'Download aggregated metric summaries in CSV or Excel formats, formatted for statistical analysis in external tools like R, SPSS, or Python.'
      },
      {
        name: 'Segmented Data',
        href: '/docs/export/segmented-data',
        description: 'Export raw fixation and saccade sequences segmented by stimulus, participant, and temporal window to custom CSV files.'
      },
    ],
  },
  {
    title: 'Advanced',
    links: [
      {
        name: 'Advanced',
        href: '/docs/advanced',
        description: 'Explore advanced tools in GazePlotter, including raw source metadata inspection and segmented data workflow pipelines.'
      },
      {
        name: 'Source Metadata',
        href: '/docs/advanced/source-metadata',
        description: 'Inspect raw file headers, parser configurations, and ingestion logs to troubleshoot eye-tracking import compatibility.'
      },
      {
        name: 'Segmented Data Workflows',
        href: '/docs/advanced/segmented-data-workflows',
        description: 'Perform complex data splitting, cropping, and sequence partitioning to refine timelines for precise statistical comparisons.'
      },
      {
        name: 'App Dev Build',
        href: '/docs/advanced/app-dev-build',
        description: 'Developer guidelines for setting up, building, running, and contributing to the core GazePlotter application codebase locally.'
      },
      {
        name: 'Docs Dev Build',
        href: '/docs/advanced/docs-dev-build',
        description: 'Developer guidelines for running, writing, and formatting the GazePlotter documentation pages locally using markdown and mdsvex.'
      },
      {
        name: 'Download GazePlotter',
        href: '/docs/advanced/download-gazeplotter',
        description: 'Install GazePlotter as a Progressive Web App (PWA) on your desktop or mobile device for completely offline data analysis support.'
      },
    ],
  },
]
