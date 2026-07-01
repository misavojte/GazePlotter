<script lang="ts">
  import { GazePlotter, fromUrl } from '$lib'
  import { Card } from '$lib/shared/components'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import type { GazePlotterSession } from '$lib/session'
  import { announceVersionOnce } from './versionNotice'

  const demoDataPath = `${base}/data/demo.json?v=2`

  // Read `?dataUrl=` once at mount. Switching sources mid-session needs a
  // page reload — matches GazePlotter's "load is one-shot" contract.
  const dataUrl = browser
    ? new URL(window.location.href).searchParams.get('dataUrl')
    : null
  const load = fromUrl(
    dataUrl ?? demoDataPath,
    dataUrl ? 'data.json' : 'demo.json'
  )

  let gazePlotterRef = $state<{ getSession: () => GazePlotterSession }>()

  onMount(() => {
    const session = gazePlotterRef?.getSession()
    if (session) announceVersionOnce(session.toastState)
  })
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
    <GazePlotter {load} bind:this={gazePlotterRef} />
  </section>
  <section class="main-section" id="about">
    <div class="about-grid">
      <div class="card">
        <h2 class="box-title">Cite work</h2>
        <p>
          Vojtechovska,&nbsp;M., Popelka,&nbsp;S. GazePlotter:
          An&nbsp;open-source solution for&nbsp;the automatic generation
          of&nbsp;scarf plots from&nbsp;eye-tracking data. Behav&nbsp;Res
          58,&nbsp;85 (2026). <a href="https://doi.org/10.3758/s13428-026-02959-5" target="_blank" rel="noopener noreferrer">doi:10.3758/s13428-026-02959-5</a>
        </p>
        <a
          target="_blank"
          href="https://link.springer.com/article/10.3758/s13428-026-02959-5"
        >
          Go to article
        </a>
      </div>
      <div class="card">
        <h2 class="box-title">Found bug?</h2>
        <p>
          Help us improve GazePlotter. Report issues, request new visualizations, or contribute to our open-source code directly on GitHub. Community feedback is essential to keeping GazePlotter stable and up-to-date.
        </p>
        <a
          target="_blank"
          href="https://github.com/misavojte/GazePlotter/issues"
        >
          Open GitHub Issues
        </a>
      </div>
      <div class="card long">
        <h2 class="box-title">About us</h2>
        <p>
          Created by <a href="https://vojtechovska.com" target="_blank" rel="noopener noreferrer">Michaela Vojtechovska</a> under the supervision of <a href="https://www.geoinformatics.upol.cz/lide/stanislav-popelka/?lang=en" target="_blank" rel="noopener noreferrer">Stanislav Popelka</a>, GazePlotter allows researchers and non-programmers to visualize eye gaze data without writing code. This tool is and will remain free.
        </p>
        <img
          width="500"
          height="500"
          src="/images/gazeplotter_presentation.png"
          alt="Michaela presenting GazePlotter at Cognition and Artificial Life conference"
        />
        <a
          target="_blank"
          href="https://eyetracking.upol.cz"
        >
          See our lab
        </a>
      </div>
      <div class="card">
        <h2 class="box-title">User guide</h2>
        <p>
          Learn how to get started, configure your custom workspace, customize metrics, and import Tobii, SMI, GazePoint, Varjo, or Pupil Labs data. Explore our step-by-step instructions for advanced features.
        </p>
        <a href="/docs">
          Read the guide
        </a>
      </div>
      <div class="card">
        <h2 class="box-title">Data import</h2>
        <p>
          GazePlotter supports data from all major eye-tracking platforms including Tobii, SMI, GazePoint, OGAMA, Varjo, and Pupil Cloud. You can also import custom CSV files from any other eye tracker.
        </p>
        <a href="/docs/upload-data">
          Supported formats
        </a>
      </div>
    </div>
  </section>
</main>

<style>
  main {
    color: var(--c-black);
  }
  .intro {
    text-align: center;
    margin-bottom: 45px;
  }

  .title-heading {
    font-size: 3rem;
    margin: 0;
    font-weight: bold;
    line-height: 1.15;
    letter-spacing: -0.025em;
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
    padding-top: 75px;
  }

  .main-section {
    max-width: 1280px;
    box-sizing: border-box;
    padding: 0 32px;
    margin-left: auto;
    margin-right: auto;
  }

  .about-grid {
    --grid-gap: 10px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-template-rows: auto auto;
    margin-top: 80px;
    margin-bottom: 80px;
    gap: var(--grid-gap);
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
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
  .card {
    background: var(--c-lightgrey);
    border-radius: var(--rounded-lg);
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xl);
    box-sizing: border-box;
    gap: var(--grid-gap);
  }
  .card p {
    margin: 0;
    text-align: justify;
  }
  .card.long {
    grid-row: span 2;
  }
  .card.long img {
    width: 100%;
    height: auto;
    border-radius: var(--rounded-md);
    margin-top: 15px;
    margin-bottom: 15px;
    object-fit: cover;
  }
  .card > a {
    font-size: 18px;
    font-weight: 600;
    color: var(--c-brand);
    text-decoration: none;
    margin-top: auto;
  }
  .card > a:hover,
  .card > a:focus {
    color: var(--c-brand-dark);
    text-decoration: underline;
  }
  .card > a::after {
    content: "→";
    display: inline-block;
    text-decoration: none;
    margin-left: 8px;
    transition: transform var(--transition-fast) ease-in-out;
  }
  .card > a:hover::after,
  .card > a:focus::after {
    transform: translateX(4px);
  }
  .card p a {
    color: inherit;
    text-decoration: underline dotted;
  }
  .card p a:hover,
  .card p a:focus {
    color: inherit;
    text-decoration: underline solid;
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
      padding-top: 65px;
    }
    .intro {
      margin-bottom: 40px;
    }
  }

  @media only screen and (max-width: 840px) {
    .title-heading {
      font-size: 2.2rem;
    }
    main > section:first-child {
      padding-top: 55px;
    }
    .intro {
      margin-bottom: 35px;
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
