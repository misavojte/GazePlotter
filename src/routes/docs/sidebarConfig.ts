export interface SidebarLink {
  name: string;
  href: string;
  description?: string;
  slug?: string;
}

export interface SidebarSection {
  title: string;
  links: SidebarLink[];
}

export const SIDEBAR: readonly SidebarSection[] = [
  {
    "title": "Getting Started",
    "links": [
      {
        "name": "Introduction",
        "href": "/docs"
      }
    ]
  },
  {
    "title": "Uploading Data",
    "links": [
      {
        "name": "Upload Data",
        "href": "/docs/upload-data"
      },
      {
        "name": "Custom CSV",
        "href": "/docs/upload-data/custom-csv"
      },
      {
        "name": "Gazepoint",
        "href": "/docs/upload-data/gazepoint"
      },
      {
        "name": "Ogama",
        "href": "/docs/upload-data/ogama"
      },
      {
        "name": "Pupil Cloud",
        "href": "/docs/upload-data/pupil-cloud"
      },
      {
        "name": "SMI BeGaze",
        "href": "/docs/upload-data/smi-begaze"
      },
      {
        "name": "Tobii Pro Lab",
        "href": "/docs/upload-data/tobii-pro-lab"
      },
      {
        "name": "Varjo",
        "href": "/docs/upload-data/varjo"
      }
    ]
  },
  {
    "title": "Basic Usage",
    "links": [
      {
        "name": "Basic",
        "href": "/docs/basic"
      },
      {
        "name": "Workspace",
        "href": "/docs/basic/workspace"
      },
      {
        "name": "Scarf Plot",
        "href": "/docs/basic/scarf-plot"
      },
      {
        "name": "Bar Plot",
        "href": "/docs/basic/bar-plot"
      },
      {
        "name": "Transition Matrix",
        "href": "/docs/basic/transition-matrix"
      },
      {
        "name": "AOI Customization",
        "href": "/docs/basic/aoi-customization"
      },
      {
        "name": "AOI Occupancy",
        "href": "/docs/basic/aoi-occupancy"
      },
      {
        "name": "Groups",
        "href": "/docs/basic/groups"
      },
      {
        "name": "Participants Customization",
        "href": "/docs/basic/participants-customization"
      },
      {
        "name": "Stimuli Customization",
        "href": "/docs/basic/stimuli-customization"
      }
    ]
  },
  {
    "title": "Export",
    "links": [
      {
        "name": "Export",
        "href": "/docs/export"
      },
      {
        "name": "Workspace",
        "href": "/docs/export/workspace"
      },
      {
        "name": "Scangraph",
        "href": "/docs/export/scangraph"
      },
      {
        "name": "Aggregated Data",
        "href": "/docs/export/aggregated-data"
      },
      {
        "name": "Segmented Data",
        "href": "/docs/export/segmented-data"
      }
    ]
  },
  {
    "title": "Advanced",
    "links": [
      {
        "name": "Advanced",
        "href": "/docs/advanced"
      },
      {
        "name": "Source Metadata",
        "href": "/docs/advanced/source-metadata"
      },
      {
        "name": "Segmented Data Workflows",
        "href": "/docs/advanced/segmented-data-workflows"
      },
      {
        "name": "App Dev Build",
        "href": "/docs/advanced/app-dev-build"
      },
      {
        "name": "Docs Dev Build",
        "href": "/docs/advanced/docs-dev-build"
      },
      {
        "name": "Download GazePlotter",
        "href": "/docs/advanced/download-gazeplotter"
      }
    ]
  }
];

