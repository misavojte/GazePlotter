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
    description: 'Step-by-step introduction to GazePlotter. Learn to upload data files, manage participant groups, and configure eye-movement plots.'
  },
  {
    title: 'Uploading Data',
    links: [
      {
        name: 'Upload Data',
        href: '/docs/upload-data',
        description: 'Overview of GazePlotter\'s file ingestion adapters. Supports raw gaze coordinates, fixation event logs, and dynamic timeline event files.'
      },
      {
        name: 'Custom CSV',
        href: '/docs/upload-data/custom-csv',
        description: 'Upload Custom CSV files using three strict formats (time-series, segmented from/to, or duration-based) with optional x/y coordinate columns.'
      },
      {
        name: 'Gazepoint',
        href: '/docs/upload-data/gazepoint',
        description: 'Import Gazepoint CSV exports. Parses fixation segments and blink events from time-series columns (FPOGS, FPOGD, BKID, BKDUR) and maps stimulus media.'
      },
      {
        name: 'Ogama',
        href: '/docs/upload-data/ogama',
        description: 'Import OGAMA scanpath similarity exports. Parses character-mapped scanpath strings (e.g., A, B, C) with ordinal durations and maps them to AOI sequences.'
      },
      {
        name: 'Pupil Cloud',
        href: '/docs/upload-data/pupil-cloud',
        description: 'Import Pupil Cloud ZIP archives containing sections.csv, fixations.csv, and aoi_fixations.csv to parse normalized fixation intervals and AOI hit sets.'
      },
      {
        name: 'SMI BeGaze',
        href: '/docs/upload-data/smi-begaze',
        description: 'Ingest SMI BeGaze event-statistics TSV exports. Parses event start and end trial times, participant, stimulus, category (fixation/saccade), and AOI name.'
      },
      {
        name: 'Tobii Pro Lab',
        href: '/docs/upload-data/tobii-pro-lab',
        description: 'Import Tobii Pro Lab TSV exports. Supports coordinate mapping, AOI column hits, and suffix-driven Event-column interval parsing for web/stimulus timelines.'
      },
      {
        name: 'Varjo',
        href: '/docs/upload-data/varjo',
        description: 'Import Varjo semicolon-delimited CSV exports. Parses formatted date-time strings and maps the Actor Label column to AOI events under a default VarjoScene.'
      },
      {
        name: 'Events',
        href: '/docs/upload-data/events',
        description: 'Format and upload external event files (e.g., user triggers or stimulus change indicators) to overlay dynamic timelines on gaze sequences.'
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
        description: 'Workspace configuration guide. Learn to manage layout sections, arrange visualization panels, and configure coordinate mapping settings.'
      },
      {
        name: 'Workspace',
        href: '/docs/setup/workspace',
        description: 'Learn to arrange, drag-and-drop, and resize visualization cards. Manages plot panels, stimulus bindings, and synchronization states.'
      },
      {
        name: 'AOI Library',
        href: '/docs/setup/aoi-library',
        description: 'Manage Areas of Interest (AOIs). Customize display names, edit color palettes, hide specific AOIs, and configure No-AOI fallback treatment.'
      },
      {
        name: 'Event Library',
        href: '/docs/setup/event-library',
        description: 'Register and color-code event channels (e.g. key presses, video changes) to render overlay markers alongside gaze sequence data.'
      },
      {
        name: 'Participant Groups',
        href: '/docs/setup/participant-groups',
        description: 'Group participants by demographics, condition, or performance to enable cross-group comparisons in charts and metrics.'
      },
      {
        name: 'Participant Library',
        href: '/docs/setup/participant-library',
        description: 'Manage participant records. Rename participant IDs individually or in bulk using regex patterns, and reorder or sort the active participant sequence.'
      },
      {
        name: 'Stimuli Library',
        href: '/docs/setup/stimuli-library',
        description: 'Manage stimulus display records. Rename stimulus labels individually or in bulk using regex patterns, and reorder or sort the active stimulus sequence.'
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
        description: 'Introduction to the GazePlotter Metrics Library. Configure calculation variables and output formats for statistical analysis.'
      },
      {
        name: 'Fixation & Dwell Durations',
        href: '/docs/metrics/durations',
        description: 'Calculate absolute dwell duration, percentage-based relative time, and average fixation length for individual Areas of Interest (AOIs).'
      },
      {
        name: 'Gaze Counts & Latency',
        href: '/docs/metrics/counts-latency',
        description: 'Track visual salience by measuring total visit counts, fixation frequencies, and Time to First Fixation (TTFF) for specific target regions.'
      },
      {
        name: 'Transitions & Markov Metrics',
        href: '/docs/metrics/transitions',
        description: 'Compute transition probabilities and k-step Markov chain matrices to quantify directional scanning tendencies between stimulus elements.'
      },
      {
        name: 'Recurrence Quantitative Analysis (RQA)',
        href: '/docs/metrics/rqa',
        description: 'Quantify scanpath complexity with non-linear dynamics, extracting metrics like determinism, laminarity, entropy, and recurrence rates.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/metrics/scanpath-similarity',
        description: 'Mathematical specifications for sequence comparison algorithms, including string edit distance and global Needleman-Wunsch alignments.'
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
        description: 'Interactive visualization suite. Compare scarf timelines, 2D scanpaths, transition matrices, and correlation SPLOMs.'
      },
      {
        name: 'Scarf Plot',
        href: '/docs/visualizations/scarf-plot',
        description: 'Timeline visualization mapping gaze sequences over time. Overlays time-coded events, highlights specific categories, and compares participant rows.'
      },
      {
        name: 'AOI Metrics',
        href: '/docs/visualizations/aoi-metrics',
        description: 'Generate comparative bar charts of dwell times, fixation counts, and latencies across Areas of Interest, filtered by custom participant groups.'
      },
      {
        name: 'Transition Matrix',
        href: '/docs/visualizations/transition-matrix',
        description: 'Model visual search paths with probability matrices. Visualizes gaze shift frequencies and Markov transition rates between Areas of Interest.'
      },
      {
        name: 'AOI Occupancy Plot',
        href: '/docs/visualizations/aoi-occupancy',
        description: 'Trace temporal attention trends with stacked distributions, ridgelines, and heatmaps showing participant gaze distribution across AOIs over time.'
      },
      {
        name: 'Recurrence Plot',
        href: '/docs/visualizations/recurrence-plot',
        description: 'N×N recurrence matrices mapping temporal self-similarity in individual scanpaths. Reveals repeating visual check patterns and search loops.'
      },
      {
        name: 'Scanpath Plot',
        href: '/docs/visualizations/scanpath',
        description: 'Plot 2D spatial scanpaths on coordinate axes. Visualizes fixation coordinates, chronological sequence, durations (via circle radius), and saccade paths.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/visualizations/scanpath-similarity',
        description: 'Compute sequence alignments using Levenshtein distance and Needleman-Wunsch. Visualizes networks to cluster similar search behaviors.'
      },
      {
        name: 'Evolving Metrics',
        href: '/docs/visualizations/evolving-metrics',
        description: 'Analyze temporal changes in scalar metrics (such as fixation duration or count) over time using rolling windowed charts and heatmaps.'
      },
      {
        name: 'Metric Correlation',
        href: '/docs/visualizations/metric-correlation',
        description: 'Evaluate statistical relationships between eye-tracking metrics using Pearson/Spearman correlation heatmaps and Scatter Plot Matrices (SPLOM).'
      },
    ],
  },
  {
    title: 'Export',
    links: [
      {
        name: 'Export',
        href: '/docs/export',
        description: 'Data export center. Save workspace files, export high-resolution vector plots, and extract raw metrics for statistical programs.'
      },
      {
        name: 'Workspace',
        href: '/docs/export/workspace',
        description: 'Export session states in GazePlotter format. Save active plots, layout styles, groups, and stimulus libraries to resume work later.'
      },
      {
        name: 'Scangraph',
        href: '/docs/export/scangraph',
        description: 'Export scanpath sequences as character-mapped strings (e.g., A, B, C) in a tab-separated text format compatible with OGAMA similarity analysis.'
      },
      {
        name: 'Aggregated Data',
        href: '/docs/export/aggregated-data',
        description: 'Export summarized statistical tables in CSV or XLSX format, structured for import into R, SPSS, Jamovi, or Python Pandas.'
      },
      {
        name: 'Segmented Data',
        href: '/docs/export/segmented-data',
        description: 'Export raw gaze metrics partitioned by stimulus, participant, and time window, formatted for custom pipeline processing.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/export/scanpath-similarity',
        description: 'Export a scanpath similarity matrix as CSV for comparing participant scanpaths.'
      },
    ],
  },
  {
    title: 'Advanced',
    links: [
      {
        name: 'Advanced',
        href: '/docs/advanced',
        description: 'Advanced configurations, metadata inspection tools, crop workflows, and pipeline options for developers and heavy users.'
      },
      {
        name: 'Source Metadata',
        href: '/docs/advanced/source-metadata',
        description: 'Inspect raw text file headers, parse configurations, and execution logs to troubleshoot hardware file adapter compatibility.'
      },
      {
        name: 'Segmented Data Workflows',
        href: '/docs/advanced/segmented-data-workflows',
        description: 'Create timeline crops, split trials, and set custom onset/offset buffers to isolate specific epochs in raw eye-tracking runs.'
      },
      {
        name: 'App Dev Build',
        href: '/docs/advanced/app-dev-build',
        description: 'Developer setup guide. Install node packages, configure the Vite bundler, compile assets, and contribute to the Svelte codebase.'
      },
      {
        name: 'Docs Dev Build',
        href: '/docs/advanced/docs-dev-build',
        description: 'Guidelines for modifying documentation. Run the local docs dev server, edit Markdown content, and structure YAML frontmatter.'
      },
      {
        name: 'Download GazePlotter',
        href: '/docs/advanced/download-gazeplotter',
        description: 'Install GazePlotter locally as a Progressive Web App (PWA) on Windows, macOS, Linux, or mobile for secure, offline analysis.'
      },
    ],
  },
]
