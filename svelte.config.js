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
      // Normalize line endings so ^ anchors work on Windows (\r\n)
      const normalized = content.replace(/\r\n/g, '\n')
      const transformed = normalized.replace(
        /^:::\s+(\w+)(.*?)\n([\s\S]*?)^:::\s*$/gm,
        (_, type, title, body) => {
          const titleHtml = title.trim()
            ? `<p class="callout-title">${title.trim()}</p>\n\n`
            : ''
          return `<div class="callout ${type}">\n\n${titleHtml}${body.trim()}\n\n</div>`
        }
      )
      if (transformed !== normalized) {
        return { code: transformed }
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
