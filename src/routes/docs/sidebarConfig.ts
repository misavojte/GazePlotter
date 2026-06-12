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

export const SIDEBAR: readonly SidebarSection[] = [
  {
    title: 'Getting Started',
    links: [
      {
        name: 'Introduction',
        href: '/docs',
      },
    ],
  },
  {
    title: 'Uploading Data',
    links: [
      {
        name: 'Upload Data',
        href: '/docs/upload-data',
      },
      {
        name: 'Custom CSV',
        href: '/docs/upload-data/custom-csv',
      },
      {
        name: 'Gazepoint',
        href: '/docs/upload-data/gazepoint',
      },
      {
        name: 'Ogama',
        href: '/docs/upload-data/ogama',
      },
      {
        name: 'Pupil Cloud',
        href: '/docs/upload-data/pupil-cloud',
      },
      {
        name: 'SMI BeGaze',
        href: '/docs/upload-data/smi-begaze',
      },
      {
        name: 'Tobii Pro Lab',
        href: '/docs/upload-data/tobii-pro-lab',
      },
      {
        name: 'Varjo',
        href: '/docs/upload-data/varjo',
      },
      {
        name: 'Events',
        href: '/docs/upload-data/events',
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
      },
      {
        name: 'Workspace',
        href: '/docs/setup/workspace',
      },
      {
        name: 'AOI Library',
        href: '/docs/setup/aoi-library',
      },
      {
        name: 'Event Library',
        href: '/docs/setup/event-library',
      },
      {
        name: 'Participant Groups',
        href: '/docs/setup/participant-groups',
      },
      {
        name: 'Participant Library',
        href: '/docs/setup/participant-library',
      },
      {
        name: 'Stimuli Library',
        href: '/docs/setup/stimuli-library',
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
      },
      {
        name: 'Fixation & Dwell Durations',
        href: '/docs/metrics/durations',
      },
      {
        name: 'Gaze Counts & Latency',
        href: '/docs/metrics/counts-latency',
      },
      {
        name: 'Transitions & Markov Metrics',
        href: '/docs/metrics/transitions',
      },
      {
        name: 'Recurrence Quantitative Analysis (RQA)',
        href: '/docs/metrics/rqa',
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/metrics/scanpath-similarity',
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
      },
      {
        name: 'Scarf Plot',
        href: '/docs/visualizations/scarf-plot',
      },
      {
        name: 'AOI Metrics',
        href: '/docs/visualizations/aoi-metrics',
      },
      {
        name: 'Transition Matrix',
        href: '/docs/visualizations/transition-matrix',
      },
      {
        name: 'AOI Occupancy Plot',
        href: '/docs/visualizations/aoi-occupancy',
      },
      {
        name: 'Recurrence Plot',
        href: '/docs/visualizations/recurrence-plot',
      },
      {
        name: 'Scanpath Plot',
        href: '/docs/visualizations/scanpath',
      },
      {
        name: 'Scanpath Similarity',
        href: '/docs/visualizations/scanpath-similarity',
      },
      {
        name: 'Evolving Metrics',
        href: '/docs/visualizations/evolving-metrics',
      },
      {
        name: 'Metric Correlation',
        href: '/docs/visualizations/metric-correlation',
      },
    ],
  },
  {
    title: 'Export',
    links: [
      {
        name: 'Export',
        href: '/docs/export',
      },
      {
        name: 'Workspace',
        href: '/docs/export/workspace',
      },
      {
        name: 'Scangraph',
        href: '/docs/export/scangraph',
      },
      {
        name: 'Aggregated Data',
        href: '/docs/export/aggregated-data',
      },
      {
        name: 'Segmented Data',
        href: '/docs/export/segmented-data',
      },
    ],
  },
  {
    title: 'Advanced',
    links: [
      {
        name: 'Advanced',
        href: '/docs/advanced',
      },
      {
        name: 'Source Metadata',
        href: '/docs/advanced/source-metadata',
      },
      {
        name: 'Segmented Data Workflows',
        href: '/docs/advanced/segmented-data-workflows',
      },
      {
        name: 'App Dev Build',
        href: '/docs/advanced/app-dev-build',
      },
      {
        name: 'Docs Dev Build',
        href: '/docs/advanced/docs-dev-build',
      },
      {
        name: 'Download GazePlotter',
        href: '/docs/advanced/download-gazeplotter',
      },
    ],
  },
]
