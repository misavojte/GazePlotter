export interface SidebarLink {
  name: string
  href: string
  breadcrumbName?: string
  description?: string
  /**
   * Core of the page's <title> tag; the ` | GazePlotter Docs` suffix is
   * appended in getDoc. Falls back to `name` when omitted. Keep under
   * ~40 characters and pair the term of art with an eye-tracking
   * qualifier searchers use.
   */
  seoTitle?: string
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
    seoTitle: 'Free Eye-Tracking Visualization Tool',
    description: 'Step-by-step introduction to GazePlotter. Learn to upload data files, manage participant groups, and configure eye-movement plots.'
  },
  {
    name: 'Changelog',
    href: '/docs/changelog',
    seoTitle: 'Changelog & Version Updates',
    description: 'Release history and updates for GazePlotter versions.'
  },
  {
    title: 'Uploading Data',
    links: [
      {
        name: 'Supported File Formats',
        href: '/docs/upload-data',
        seoTitle: 'Supported Eye-Tracker File Formats',
        description: 'Overview of supported eye-tracker file formats. Upload fixation exports from Tobii Pro Lab, SMI BeGaze, Gazepoint, Pupil Cloud, Varjo, OGAMA, or custom CSV.'
      },
      {
        name: 'Custom CSV',
        href: '/docs/upload-data/custom-csv',
        seoTitle: 'Upload Custom CSV Eye-Tracking Data',
        description: 'Upload Custom CSV files using three strict formats (time-series, segmented from/to, or duration-based) with optional x/y coordinate columns.'
      },
      {
        name: 'Gazepoint',
        href: '/docs/upload-data/gazepoint',
        seoTitle: 'Visualize Gazepoint Data Online Free',
        description: 'Import Gazepoint CSV exports. Parses fixation segments and blink events from time-series columns (FPOGS, FPOGD, BKID, BKDUR) and maps stimulus media.'
      },
      {
        name: 'OGAMA',
        href: '/docs/upload-data/ogama',
        seoTitle: 'Visualize OGAMA Data Online Free',
        description: 'Import OGAMA scanpath similarity exports. Parses character-mapped scanpath strings (e.g., A, B, C) with ordinal durations and maps them to AOI sequences.'
      },
      {
        name: 'Pupil Cloud',
        href: '/docs/upload-data/pupil-cloud',
        seoTitle: 'Visualize Pupil Labs Pupil Cloud Data',
        description: 'Import Pupil Cloud ZIP archives containing sections.csv, fixations.csv, and aoi_fixations.csv to parse normalized fixation intervals and AOI hit sets.'
      },
      {
        name: 'SMI BeGaze',
        href: '/docs/upload-data/smi-begaze',
        seoTitle: 'Visualize SMI BeGaze Data Online Free',
        description: 'Ingest SMI BeGaze event-statistics TSV exports. Parses event start and end trial times, participant, stimulus, category (fixation/saccade), and AOI name.'
      },
      {
        name: 'Tobii Pro Lab',
        href: '/docs/upload-data/tobii-pro-lab',
        seoTitle: 'Visualize Tobii Pro Lab Data Online Free',
        description: 'Import Tobii Pro Lab TSV exports. Supports coordinate mapping, AOI column hits, and suffix-driven Event-column interval parsing for web/stimulus timelines.'
      },
      {
        name: 'Varjo',
        href: '/docs/upload-data/varjo',
        seoTitle: 'Visualize Varjo Eye-Tracking Data Online',
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
    title: 'Workspace',
    links: [
      {
        name: 'Workspace Canvas',
        breadcrumbName: 'Workspace',
        href: '/docs/workspace',
        description: 'Interface layout guide. Learn to manage the visualization canvas, top ribbon, left rail, right settings pane, and configure customization libraries.'
      },
      {
        name: 'AOI Library',
        href: '/docs/workspace/aoi-library',
        description: 'Manage Areas of Interest (AOIs). Customize display names, edit color palettes, hide specific AOIs, and configure No-AOI fallback treatment.'
      },
      {
        name: 'Event Library',
        href: '/docs/workspace/event-library',
        description: 'Register and color-code event channels (e.g. key presses, video changes) to render overlay markers alongside gaze sequence data.'
      },
      {
        name: 'Eye-movement Type Library',
        href: '/docs/workspace/eye-movement-type-library',
        description: 'Configure and customize eye-movement classification categories (such as fixations, saccades, and unclassified events).'
      },
      {
        name: 'Participant Groups',
        href: '/docs/workspace/participant-groups',
        description: 'Group participants by demographics, condition, or performance to enable cross-group comparisons in charts and metrics.'
      },
      {
        name: 'Participant Library',
        href: '/docs/workspace/participant-library',
        description: 'Manage participant records. Rename participant IDs individually or in bulk using regex patterns, and reorder or sort the active participant sequence.'
      },
      {
        name: 'Stimuli Library',
        href: '/docs/workspace/stimuli-library',
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
        seoTitle: 'Eye-Tracking Metrics Library',
        description: 'Calculate eye-tracking metrics: dwell time, fixation count, time to first fixation (TTFF), transition probabilities, and RQA measures.'
      },
      {
        name: 'Dwell Time & Fixation Durations',
        href: '/docs/metrics/durations',
        seoTitle: 'Dwell Time & Fixation Duration Metrics',
        description: 'Calculate dwell time (total fixation duration), percentage-based relative time, and average fixation length for individual Areas of Interest (AOIs).'
      },
      {
        name: 'Fixation Counts & Latency',
        href: '/docs/metrics/counts-latency',
        seoTitle: 'Fixation Count & Time to First Fixation',
        description: 'Track visual salience by measuring total visit counts, fixation frequencies, and Time to First Fixation (TTFF) for specific target regions.'
      },
      {
        name: 'AOI Transitions & Markov Metrics',
        href: '/docs/metrics/transitions',
        seoTitle: 'AOI Transition & Markov Metrics',
        description: 'Compute AOI transition probabilities and k-step Markov chain matrices to quantify directional scanning tendencies between stimulus elements.'
      },
      {
        name: 'Recurrence Quantification Analysis (RQA)',
        href: '/docs/metrics/rqa',
        seoTitle: 'Recurrence Quantification Analysis (RQA)',
        description: 'Quantify scanpath complexity with non-linear dynamics, extracting metrics like determinism, laminarity, entropy, and recurrence rates.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/metrics/scanpath-similarity',
        seoTitle: 'Eye-Tracking Scanpath Similarity Metrics',
        description: 'Mathematical specifications for scanpath comparison algorithms, including Levenshtein edit distance and global Needleman-Wunsch alignments.'
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
        seoTitle: 'Scarf Plot: Eye-Tracking Timeline Chart',
        description: 'Timeline visualization mapping gaze sequences over time. Overlays time-coded events, highlights specific categories, and compares participant rows.'
      },
      {
        name: 'AOI Comparison',
        href: '/docs/visualizations/aoi-comparison',
        seoTitle: 'AOI Comparison: Eye-Tracking Bar Charts',
        description: 'Generate comparative bar charts of dwell times, fixation counts, and latencies across Areas of Interest, filtered by custom participant groups.'
      },
      {
        name: 'Transition Matrix',
        href: '/docs/visualizations/transition-matrix',
        seoTitle: 'AOI Transition Matrix for Eye Tracking',
        description: 'Model visual search paths with probability matrices. Visualizes gaze shift frequencies and Markov transition rates between Areas of Interest.'
      },
      {
        name: 'AOI Timeline',
        href: '/docs/visualizations/aoi-timeline',
        seoTitle: 'AOI Timeline: Attention Over Time',
        description: 'Trace temporal attention trends with stacked distributions, ridgelines, and heatmaps showing participant gaze distribution across AOIs over time.'
      },
      {
        name: 'Recurrence Plot',
        href: '/docs/visualizations/recurrence-plot',
        seoTitle: 'Recurrence Plot for Eye-Tracking Scanpaths',
        description: 'N×N recurrence matrices mapping temporal self-similarity in individual scanpaths. Reveals repeating visual check patterns and search loops.'
      },
      {
        name: 'Scanpath',
        href: '/docs/visualizations/scanpath',
        seoTitle: 'Scanpath Plot: Fixations & Saccades',
        description: 'Plot 2D spatial scanpaths on coordinate axes. Visualizes fixation coordinates, chronological sequence, durations (via circle radius), and saccade paths.'
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/visualizations/scanpath-similarity',
        seoTitle: 'Scanpath Similarity Matrix & Network',
        description: 'Compute scanpath alignments using Levenshtein distance and Needleman-Wunsch. Visualizes networks to cluster similar search behaviors.'
      },
      {
        name: 'Metric Timeline',
        href: '/docs/visualizations/metric-timeline',
        seoTitle: 'Eye-Tracking Metrics Over Time',
        description: 'Analyze how eye-tracking metrics (such as fixation duration or count) change over time using rolling windowed charts and heatmaps.'
      },
      {
        name: 'Metric Correlation',
        href: '/docs/visualizations/metric-correlation',
        seoTitle: 'Correlate Eye-Tracking Metrics (SPLOM)',
        description: 'Evaluate correlations between eye-tracking metrics using Pearson/Spearman correlation heatmaps and Scatter Plot Matrices (SPLOM).'
      },
    ],
  },
  {
    title: 'Export',
    links: [
      {
        name: 'Export',
        href: '/docs/export',
        seoTitle: 'Export Eye-Tracking Data & Figures',
        description: 'Export eye-tracking figures, segmented data, events, and metric tables for statistical software such as R, SPSS, jamovi, or Python.'
      },
      {
        name: 'Workspace',
        href: '/docs/export/workspace',
        description: 'Export session states in GazePlotter format. Save active plots, layout styles, groups, and stimulus libraries to resume work later.'
      },
      {
        name: 'Figures',
        href: '/docs/export/figures',
        description: 'Render all or selected workspace plots as PNG or JPG images at a chosen resolution, downloaded directly or bundled into a single ZIP archive.'
      },
      {
        name: 'ScanGraph',
        href: '/docs/export/scangraph',
        description: 'Export scanpath sequences as letter-coded strings in a text format for the external ScanGraph scanpath-similarity tool.'
      },
      {
        name: 'Metric Data',
        href: '/docs/export/metric-data',
        seoTitle: 'Export Eye-Tracking Metrics to CSV',
        description: 'Export eye-tracking metric tables in long or wide CSV formats, structured for import into R, SPSS, jamovi, JASP, or Python Pandas.'
      },
      {
        name: 'Segmented Data',
        href: '/docs/export/segmented-data',
        description: 'Export raw gaze segments partitioned by stimulus and participant, formatted for custom pipeline processing.'
      },
      {
        name: 'Event Data',
        href: '/docs/export/event-data',
        description: 'Export event occurrences with their timing per participant and stimulus; single-file exports can be re-imported as event files.'
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
