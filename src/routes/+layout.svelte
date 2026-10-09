<script>
  import '../app.css'
  import DesignTokens from '$lib/DesignTokens.svelte'
  import { Footer, Header } from './components'
  import { page } from '$app/state'

  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props()

  // The homepage is the app itself: one canvas with its chrome floating
  // over it as islands, so no docked header or footer.
  const isApp = $derived(page.url.pathname === '/')

  // SoftwareApplication structured data (schema.org). `softwareVersion` is
  // sourced from the build-time `__APP_VERSION__` (package.json) so it never
  // drifts. Rendered via {@html} because Svelte would otherwise treat the
  // JSON's braces as expressions; the closing script tag is escaped in the
  // template literal so it doesn't close this component's own script block.
  const structuredData = {
    '@context': 'http://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GazePlotter',
    description:
      'GazePlotter is a versatile open-source application compatible with major eye-tracking software like Tobii, SMI, GazePoint, Pupil Labs, Varjo, and custom CSV files. It specializes in generating interactive scarf plots, scanpaths, transition matrices, and eye-tracking metrics for comprehensive analysis.',
    url: 'https://gazeplotter.com/',
    author: [
      {
        '@type': 'Person',
        name: 'Michaela Vojtechovska',
        url: 'https://vojtechovska.com/',
        affiliation: { '@id': '#upol' },
      },
      {
        '@type': 'Person',
        name: 'Stanislav Popelka',
        url: 'https://www.geoinformatics.upol.cz/lide/stanislav-popelka/?lang=en',
        affiliation: { '@id': '#upol' },
      },
    ],
    sourceOrganization: {
      '@type': 'EducationalOrganization',
      '@id': '#upol',
      name: 'Palacký University Olomouc',
      url: 'https://www.upol.cz/en/',
    },
    // The peer-reviewed article describing the tool.
    citation: {
      '@type': 'ScholarlyArticle',
      name: 'GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data',
      sameAs: 'https://doi.org/10.3758/s13428-026-02959-5',
      datePublished: '2026',
      isPartOf: { '@type': 'Periodical', name: 'Behavior Research Methods' },
    },
    applicationCategory: 'ScientificApplication',
    downloadUrl: 'https://github.com/misavojte/GazePlotter',
    operatingSystem: 'Cross-platform',
    softwareVersion: __APP_VERSION__,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    codeRepository: 'https://github.com/misavojte/GazePlotter',
  }

  const structuredDataScript = `<script type="application/ld+json">${JSON.stringify(
    structuredData
  )}<\/script>`
</script>

<svelte:head>
  {@html structuredDataScript}
</svelte:head>

<!-- Site chrome (header, footer, docs) uses the tokens on pages without a
     mounted <GazePlotter>, so the layout renders them too. -->
<DesignTokens />

{#if isApp}
  {@render children?.()}
{:else}
  <Header />
  {@render children?.()}
  <Footer />
{/if}
