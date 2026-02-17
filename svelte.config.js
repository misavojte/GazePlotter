import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'

/**
 * Simple preprocessor that converts ::: callout blocks into HTML divs
 * before mdsvex processes the markdown. Runs only on .md files.
 *
 * Syntax:  ::: tip
 *          Content here (markdown supported)
 *          :::
 *
 * Output:  <div class="callout tip">
 *          Content here (markdown supported)
 *          </div>
 */
function calloutPreprocessor() {
  return {
    markup({ content, filename }) {
      if (!filename?.endsWith('.md')) return

      const normalized = content.replace(/\r\n/g, '\n')
      const lines = normalized.split('\n')
      const out = []
      let changed = false
      let inFence = false // track fenced code blocks
      let callout = null // { type, title, bodyLines }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Toggle fenced code blocks (``` or ~~~) – skip callout syntax inside them
        if (/^(`{3,}|~{3,})/.test(line)) {
          if (!inFence) {
            inFence = true
          } else {
            inFence = false
          }
        }

        if (inFence) {
          if (callout) callout.bodyLines.push(line)
          else out.push(line)
          continue
        }

        // Opening marker:  ::: type Optional title
        const openMatch = line.match(/^:::\s+(\w+)(.*)$/)
        if (openMatch && !callout) {
          callout = {
            type: openMatch[1],
            title: openMatch[2].trim(),
            bodyLines: [],
          }
          changed = true
          continue
        }

        // Closing marker:  :::
        if (/^\s*:::\s*$/.test(line) && callout) {
          const body = callout.bodyLines.join('\n').trim()

          // Ensure a blank line before the <div> for clean block separation
          if (out.length > 0 && out[out.length - 1] !== '') {
            out.push('')
          }
          out.push(`<div class="callout ${callout.type}">`)
          out.push('')
          if (callout.title) {
            out.push(`<p class="callout-title">${callout.title}</p>`)
            out.push('')
          }
          out.push(body)
          out.push('')
          out.push('</div>')
          out.push('') // blank line after </div> so subsequent markdown is parsed correctly

          callout = null
          continue
        }

        // Accumulate body lines inside a callout, or pass through
        if (callout) {
          callout.bodyLines.push(line)
        } else {
          out.push(line)
        }
      }

      // If a callout was never closed, emit its lines verbatim
      if (callout) {
        out.push(
          `::: ${callout.type}${callout.title ? ' ' + callout.title : ''}`
        )
        out.push(...callout.bodyLines)
      }

      if (changed) {
        return { code: out.join('\n') }
      }
    },
  }
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  extensions: ['.svelte', '.md'],
  preprocess: [
    calloutPreprocessor(),
    vitePreprocess(),
    mdsvex({
      extension: '.md',
      rehypePlugins: [rehypeSlug],
    }),
  ],

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      $lib: './src/lib',
      '$lib/*': './src/lib/*',
      $survey: './src/survey',
      '$survey/*': './src/survey/*',
    },
  },
}

export default config
