<script lang="ts">
  import { GazePlotter } from '$lib'
  import { Card } from '$lib/shared/components'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import type { GazePlotterSession } from '$lib/session'

  const pathToData = `${base}/data/demo.json?v=2`

  async function loadInitialData(session: GazePlotterSession): Promise<void> {
    if (!pathToData || !browser)
      return Promise.reject('No path to data or not in browser')

    const blob = await fetch(pathToData).then(response => response.blob())
    const file = new File([blob], 'demo.json', {
      type: 'application/json',
    })
    const fileList = Object.assign([file], {
      item: () => file,
      length: 1,
      [Symbol.iterator]: function* () {
        yield file
      },
    }) as FileList

    await session.ingest.loadFiles(fileList)
  }
</script>

<svelte:head>
  <title
    >GazePlotter | Free eye-tracking data visualisation via scarf plots</title
  >
</svelte:head>

<main>
  <section class="main-section intro">
    <div class="title-container">
      <h1 class="title-heading red">GazePlotter</h1>
      <h2 class="title-heading">Free eye-tracking visualizations</h2>
    </div>
    <p class="intro-text">
      Generate scarf plots, transition matrices, and AOI metrics from eye gaze
      data.<br />No&nbsp;registration, no ads and no data sent
      to&nbsp;a&nbsp;server. Just open science.
    </p>
  </section>
  <section>
    <GazePlotter {loadInitialData} />
  </section>
  <section class="main-section" id="about">
    <div class="about-grid">
      <Card padding="lg">
        <h2 class="box-title">Open source Svelte library</h2>
        <p>
          GazePlotter is an open source library, written in Svelte and
          TypeScript. You can use it for free or modify its code to fit your
          specific needs in your projects.
        </p>
        <a href="https://github.com/misavojte/GazePlotter">See GitHub repo</a>
      </Card>
      <Card padding="lg">
        <h2 class="box-title">Works with Tobii, SMI & more</h2>
        <p>
          The app creates interactive sequence charts and other analysis from
          Tobii, SMI, GazePoint and other eye trackers. Just upload your data
          and see the results.
        </p>
        <a href="/docs/upload-data"> Which files to upload? </a>
      </Card>
      <Card padding="lg" class="long">
        <h2 class="box-title">Interactive scarf plots</h2>
        <p>
          Scarf plots (sequence charts) are a great way to visualise
          eye-tracking data. They show the order of fixations in time and their
          hits on areas of interest (AOI). In GazePlotter, they are interactive,
          customisable and easy to share.
        </p>
        <img
          width="500"
          height="220"
          src="/images/gazeplotter_scarf_plot.png"
          alt="Simplest scarf plot in GazePlotter"
        />
      </Card>
      <Card padding="lg">
        <h2 class="box-title">Runs without Internet</h2>
        <p>
          GazePlotter does not store your data on a server, thus ensuring data
          privacy. All is done in your browser. You can use it on PCs, Macs,
          tablets, even off-line!
        </p>
        <a href="/docs/advanced/download-gazeplotter"
          >How to download GazePlotter?</a
        >
      </Card>
      <Card padding="lg">
        <h2 class="box-title">Other eye tracking tools</h2>
        <p>
          Eye-Tracking Group at Department of Geoinformatics, Palacký University
          Olomouc, develops other eye tracking tools for free use.
        </p>
        <a href="https://eyetracking.upol.cz/tools/">More eye tracking tools</a>
      </Card>
    </div>
  </section>
</main>

<style>
  main {
    color: var(--c-black);
  }
  .intro {
    text-align: center;
    margin-bottom: 60px;
  }

  .title-heading {
    font-size: 3rem;
    margin: 0;
    font-weight: bold;
    line-height: 1.15;
  }
  .red {
    color: var(--c-brand) !important;
  }
  .title-container {
    margin: 1rem 0;
  }

  h2 {
    font-size: 1.85rem;
    margin-bottom: 24px;
  }

  .intro-text {
    font-size: 1.25rem;
    max-width: 850px;
    margin-inline: auto;
  }

  main {
    flex-grow: 1;
  }

  main > section:first-child {
    padding-top: 60px;
  }

  .main-section {
    max-width: 1280px;
    box-sizing: border-box;
    padding: 0 32px;
    margin-left: auto;
    margin-right: auto;
  }

  .about-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, auto));
    margin-top: 80px;
    margin-bottom: 80px;
    gap: 24px;
  }

  main p {
    line-height: 1.5;
    color: var(--c-darkgrey);
  }

  /* .box styles moved to Card.svelte */
  .box-title {
    line-height: 30px;
    font-size: 20px;
    font-weight: bold;
    margin: 0;
  }
  /* .box styles moved to Card.svelte */
  :global(.card.long) {
    grid-row: span 2;
  }
  :global(.card img) {
    width: 102%;
    height: auto;
    margin-block: auto;
  }

  :global(.card a) {
    font-size: 18px;
    font-weight: 600;
    color: var(--c-brand);
    text-decoration: none;
    margin-top: auto;
  }
  :global(.card a:hover),
  :global(.card a:focus) {
    color: var(--c-brand-dark);
  }

  @media only screen and (max-width: 1100px) {
    .title-heading {
      font-size: 2.75rem;
    }
    .intro-text {
      font-size: 1.4rem;
    }
  }

  @media only screen and (max-width: 1000px) {
    .title-heading {
      font-size: 2.6rem;
    }
    .intro-text {
      font-size: 1.3rem;
    }
    .main-section {
      padding-inline: 24px;
    }
    main > section:first-child {
      padding-top: 40px;
    }
  }

  @media only screen and (max-width: 840px) {
    .title-heading {
      font-size: 2.2rem;
    }
    main > section:first-child {
      padding-top: 30px;
    }
    .intro-text {
      font-size: 1.2rem;
    }
  }

  @media only screen and (max-width: 740px) {
    .title-heading {
      font-size: 2rem;
    }
    h2 {
      font-size: 1.7rem;
    }
    .intro-text {
      font-size: 1.1rem;
    }
    .main-section {
      padding-inline: 22px;
    }
  }

  @media only screen and (max-width: 665px) {
    .main-section {
      padding-inline: 20px;
    }
  }

  @media only screen and (max-width: 540px) {
    .about-grid {
      gap: 18px;
    }
    .main-section {
      padding-inline: 18px;
    }
  }

  @media only screen and (max-width: 420px) {
    .title-heading {
      font-size: 1.9rem;
    }
    h2 {
      font-size: 1.6rem;
    }
    .intro-text {
      font-size: 1rem;
    }
    .main-section {
      padding-inline: 15px;
    }
  }

  @media only screen and (max-width: 380px) {
    .main-section {
      padding-inline: 12px;
    }
  }
</style>
