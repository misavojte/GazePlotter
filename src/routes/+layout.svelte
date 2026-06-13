<script>
  import '../app.css'
  import { Footer, Header } from './components'

  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props()

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
      'GazePlotter is a versatile open-source application compatible with major eye-tracking software like Tobii, SMI, GazePoint, Pupil Labs, Varjo, and custom CSV files. It specializes in generating interactive scarf plots, transition matrices, and eye-tracking metrics for comprehensive analysis.',
    url: 'https://gazeplotter.com/',
    author: {
      '@type': 'Person',
      name: 'Michaela Vojtechovska',
      url: 'https://vojtechovska.com/',
      affiliation: {
        '@type': 'EducationalOrganization',
        name: 'Palacky University Olomouc',
      },
    },
    applicationCategory: 'Research & Development',
    downloadUrl: 'https://github.com/misavojte/GazePlotter',
    operatingSystem: 'Cross-platform',
    softwareVersion: __APP_VERSION__,
    isAccessibleForFree: true,
    sourceOrganization: {
      '@type': 'Organization',
      name: 'GitHub',
      url: 'https://github.com',
    },
    codeRepository: 'https://github.com/misavojte/GazePlotter',
  }

  const structuredDataScript = `<script type="application/ld+json">${JSON.stringify(
    structuredData
  )}<\/script>`
</script>

<svelte:head>
  {@html structuredDataScript}
</svelte:head>

<Header />
{@render children?.()}
<Footer />
