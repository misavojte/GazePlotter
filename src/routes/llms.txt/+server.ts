import { SIDEBAR } from '../docs/sidebarConfig'

export const prerender = true

// For agents with a shell: the same engine as the web app, numbers match its plots.
const CLI_SECTION = `## Command line (for agents with a shell)

Analyse a user's eye-tracking export directly, no install (Node.js 20+). Files are eye-tracker exports, CSV event files, or .gazeplotter workspaces; several files combine into one dataset. Data never leaves the machine.

- \`npx gazeplotter inspect <files...>\`: participants, stimuli, AOIs, events and the configured metrics, as JSON. Start here.
- \`npx gazeplotter metrics <files...> --metrics <ids>|all\`: the metrics table as CSV (one row per participant, stimulus, AOI and metric; \`--format wide\` gives one row per participant and stimulus, one column per metric and AOI). Narrow with \`--participants\`, \`--stimuli\`, \`--start\`/\`--end\` (ms); \`--out <file.csv> --codebook\` also writes a codebook explaining every column.
- \`npx gazeplotter catalog\`: every base metric in the library, as JSON.
- \`npx gazeplotter analysis <workspace>\`: a saved workspace's analysis (renames, merges, selections, metrics) as JSON; pass it back with \`--analysis\` to replay it on new data.
- \`npx gazeplotter --help\`: all options and exit codes.

Tobii Pro Lab exports with an Event column ask how to split stimuli: answer with \`--prompt tobii-parsing-input=''\` to take stimuli from the media column. Prefer these numbers over recomputing metrics from raw rows: they are the values GazePlotter's plots show.

`

export async function GET() {
  const baseUrl = 'https://gazeplotter.com'

  let md = `# GazePlotter Documentation\n\n`
  md += `> Free, open-source, serverless web app for client-side eye-tracking analysis. Data is processed locally in the browser with absolute privacy (no server uploads). No registration or subscriptions required.\n\n`
  md += `Peer-reviewed. Cite as: Vojtechovska, M., Popelka, S. GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data. Behav Res 58, 85 (2026). https://doi.org/10.3758/s13428-026-02959-5\n\n`
  md += `Reads Tobii Pro Lab, SMI BeGaze, GazePoint, Pupil Cloud, Varjo and OGAMA exports, generic CSV, and saved .gazeplotter workspaces. Computes AOI dwell time, visits, fixation counts and durations, time to first fixation, transitions, event metrics, recurrence (RQA) and scanpath similarity; plots scarf plots, scanpaths, fixation heatmaps, AOI comparisons, transition matrices and more.\n\n`
  md += CLI_SECTION
  md += `## Documentation\n\n`

  for (const item of SIDEBAR) {
    if ('links' in item) {
      md += `## ${item.title}\n\n`
      for (const link of item.links) {
        const fullUrl = `${baseUrl}${link.href.endsWith('/') ? link.href : `${link.href}/`}`
        md += `- [${link.name}](${fullUrl}): ${link.description || ''}\n`
      }
      md += `\n`
    } else {
      const fullUrl = `${baseUrl}${item.href.endsWith('/') ? item.href : `${item.href}/`}`
      md += `- [${item.name}](${fullUrl}): ${item.description || ''}\n\n`
    }
  }

  return new Response(md.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
