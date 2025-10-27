<script lang="ts">
  import { GazePlotter } from '$lib'
  import GeneralInfoCallout from '$lib/shared/components/GeneralInfoCallout.svelte'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import type { ParsedData } from '$lib/gaze-data/shared/types'
  import { EyeWorkerService } from '$lib/gaze-data/front-process/class/EyeWorkerService'
  import { Survey, surveyStore, createCondition, ConsentModal } from '$survey'
  import { SurveyModal } from '$survey/components'
  import type { SurveyTask, SurveyModalState } from '$survey/types'
  import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import type { UEQSResults, EyeTrackingExperienceResult } from '$survey/types'
  // Format the build date
  const buildDate = new Date(__BUILD_DATE__)
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(buildDate)

  const pathToData = `${base}/data/etvis.json`

  async function loadInitialData(): Promise<ParsedData> {
    if (!pathToData || !browser)
      return Promise.reject('No path to data or not in browser')

    return new Promise((resolve, reject) => {
      const workerService = new EyeWorkerService(
        data => resolve(data),
        () => reject(new Error('Failed to load initial data'))
      )

      // Fetch the data and create a File object
      fetch(pathToData)
        .then(response => response.blob())
        .then(blob => {
          const file = new File([blob], 'demo.json', {
            type: 'application/json',
          })
          const fileList = Object.assign([file], {
            item: (index: number) => file,
            length: 1,
            [Symbol.iterator]: function* () {
              yield file
            },
          }) as FileList

          workerService.sendFiles(fileList)
        })
        .catch(reject)
    })
  }

  // Use the version from vite.config.ts
  const version = __APP_VERSION__

  // Create condition stores for automatic task completion
  const consentCondition = createCondition(); // Monitor for consent confirmation
  const stimulusCondition = createCondition(); // Monitor for "Task 2" stimulus
  const timelineCondition = createCondition(); // Monitor for "relative" timeline
  const groupCondition = createCondition(); // Monitor for "Group 1" selection
  const duplicateCondition = createCondition(); // Monitor for plot duplication
  const group2Condition = createCondition(); // Monitor for "Group 2" selection
  const aoiCustomizationCondition = createCondition(); // Monitor for AOI grouping
  const transitionMatrixCondition = createCondition(); // Monitor for Transition Matrix aggregation
  const barPlotCondition = createCondition(); // Monitor for Bar Plot aggregation
  const explorationCondition = createCondition(); // Monitor for UI exploration completion

  // State for forcing banner to close on any modal content
  let forceCloseBanner = $state(false);

  // Monitor modal store to force close banner when any modal is open
  $effect(() => {
    const unsubscribe = modalStore.subscribe((modal) => {
      forceCloseBanner = modal !== null;
    });
    return unsubscribe;
  });

  // Survey state - persists when modal is closed and reopened
  let surveyState = $state<SurveyModalState>({
    isCompleted: false,
    ueqsResults: null,
    eyeTrackingResults: null,
    feedbackText: '',
    currentStepIndex: 0,
    ueqsComplete: false,
    eyeTrackingValue: null,
    feedbackValue: ''
  });

  // Example tasks with conditions and alert buttons
  const exampleTasks: SurveyTask[] = [
    { 
      text: "Read UX evaluation instructions & consent",
      buttonText: "Open instructions & consent",
      onButtonClick: () => {
        modalStore.open(
          ConsentModal as any,
          'UX Evaluation Instructions & Consent',
          {
            onConsent: () => {
              consentCondition.set(true); // Manually trigger condition
            }
          }
        )
      },
      condition: consentCondition,
      skippable: false
    },
    { 
      text: "On scarf plot, set stimulus to Task 2",
      condition: stimulusCondition // Auto-completes when stimulus is set to Task 2
    },
    { 
      text: "Set timeline to relative",
      condition: timelineCondition // Auto-completes when timeline is set to relative
    },
    { 
      text: "Set group to 'Analytics'",
      condition: groupCondition // Auto-completes when group is set to Group 1
    },
    { 
      text: "Duplicate the scarf plot",
      condition: duplicateCondition // Auto-completes when plot is duplicated
    },
    { 
      text: "On the duplicated plot, set group to 'Holistics'",
      condition: group2Condition // Auto-completes when group is set to Group 2
    },
    { 
      text: "Find 'AOI Customization' and group XAxis and YAxis by giving them the same name",
      condition: aoiCustomizationCondition // Auto-completes when AOIs are grouped
    },
    { 
      text: "On Transition Matrix, change aggregation metric to '1-step probability'",
      condition: transitionMatrixCondition // Auto-completes when aggregation is changed
    },
    { 
      text: "On Bar Plot, set aggregation method to 'Mean visits'",
      condition: barPlotCondition // Auto-completes when aggregation is changed
    },
    { 
      text: "Feel free to explore the UI as long as you wish",
      buttonText: "I now want to answer questions and end survey",
      onButtonClick: () => {
        modalStore.open(
          SurveyModal as any,
          'User Experience Questionnaire',
          {
            surveyState,
            onComplete: (results: { ueqs: UEQSResults; eyeTracking: EyeTrackingExperienceResult; feedback: string }) => {
              console.log('Survey completed with results:', results);
              explorationCondition.set(true); // Manually trigger condition
            }
          }
        );
      },
      condition: explorationCondition,
      skippable: false
    }
  ]

  /**
   * Debug function to complete current task and move to next one
   */
  function completeCurrentTask(): void {
    surveyStore.nextTask()
  }

  /**
   * Helper function to check if a command source matches a specific plot type
   * @param source - The command source string (format: "plotType.plotId.placement")
   * @param plotType - The plot type to match (e.g., "scarfPlot", "transitionMatrix", "barPlot")
   * @returns true if the source matches the plot type
   */
  function isCommandFromPlotType(source: string, plotType: string): boolean {
    return source.startsWith(`${plotType}.`) || source.startsWith(`undo.${plotType}.`) || source.startsWith(`redo.${plotType}.`);
  }

  const handleWorkspaceCommand = (command: WorkspaceCommandChain) => {
    console.log('command', command)
    // Check for stimulus change to Task 2 (stimulusId === 1) from scarf plot
    if (command.type === 'updateSettings' && 
        command.settings && 
        'stimulusId' in command.settings && 
        command.settings.stimulusId === 1 &&
        isCommandFromPlotType(command.source, 'scarf')) {
      stimulusCondition.set(true);
    }
    
    // Check for timeline change to relative from scarf plot
    if (command.type === 'updateSettings' && 
        command.settings && 
        'timeline' in command.settings && 
        command.settings.timeline === 'relative' &&
        isCommandFromPlotType(command.source, 'scarf')) {
      timelineCondition.set(true);
    }
    
    // Check for group change to Analytics (groupId === 1) from scarf plot
    if (command.type === 'updateSettings' && 
        command.settings && 
        'groupId' in command.settings && 
        command.settings.groupId === 1 &&
        isCommandFromPlotType(command.source, 'scarf')) {
      groupCondition.set(true);
    }
    
    // Check for group change to Holistics (groupId === 2) from scarf plot
    if (command.type === 'updateSettings' && 
        command.settings && 
        'groupId' in command.settings && 
        command.settings.groupId === 2 &&
        isCommandFromPlotType(command.source, 'scarf')) {
      group2Condition.set(true);
    }
    
    // Check for plot duplication (works from any plot type)
    if (command.type === 'duplicateGridItem') {
      duplicateCondition.set(true);
    }
    
    // Check for AOI customization - detect when at least two AOIs have the same displayed name
    // This can come from any plot type that supports AOI customization
    if (command.type === 'updateAois' && command.aois && command.aois.length > 0) {
      // Count occurrences of each displayed name
      const nameCounts = new Map<string, number>();
      
      command.aois.forEach(aoi => {
        const displayedName = aoi.displayedName || aoi.originalName || '';
        if (displayedName.trim() !== '') {
          nameCounts.set(displayedName, (nameCounts.get(displayedName) || 0) + 1);
        }
      });
      
      // Check if any displayed name appears at least twice (indicating grouping)
      const hasGroupedAois = Array.from(nameCounts.values()).some(count => count >= 2);
      
      if (hasGroupedAois) {
        aoiCustomizationCondition.set(true);
      }
    }
    
    // Check for Transition Matrix aggregation change to '1-step probability'
    if (command.type === 'updateSettings' && 
        command.settings && 
        'aggregationMethod' in command.settings && 
        command.settings.aggregationMethod === 'probability' &&
        isCommandFromPlotType(command.source, 'TransitionMatrix')) {
      transitionMatrixCondition.set(true);
    }
    
    // Check for Bar Plot aggregation change to 'Mean visits'
    if (command.type === 'updateSettings' && 
        command.settings && 
        'aggregationMethod' in command.settings && 
        command.settings.aggregationMethod === 'averageEntries' &&
        isCommandFromPlotType(command.source, 'barPlot')) {
      barPlotCondition.set(true);
    }
  }
</script>

<svelte:head>
  <title
    >GazePlotter | Free eye-tracking data visualisation via scarf plots</title
  >
</svelte:head>

<header class="border-b">
  <div>
    <a id="go-home" href="/">
      <img
        id="logo"
        width="24"
        height="24"
        src="/logos/gazeplotter.svg"
        alt="Logo"
      />
      <span id="sitetitle">GazePlotter</span>
    </a>
    <nav>
      <a
        class="external-link"
        target="_blank"
        href="https://docs.gazeplotter.com/"
      >
        Guide
        <svg
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
          height="24px"
          viewBox="0 0 24 24"
          width="24px"
          class="icon"
          data-v-f3ed0000=""
          ><path d="M0 0h24v24H0V0z" fill="none"></path><path
            d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5H9z"
          ></path></svg
        >
      </a>
      <a
        href="https://github.com/misavojte/GazePlotter"
        target="_blank"
        class="a-icon"
        rel="nofollow"
        aria-label="GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="icon"
          viewBox="0 0 16 16"
        >
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
    </nav>
  </div>
</header>
<main>
  <section class="main-section intro">
    <div class="title-container">
      <h1 class="title-heading red">GazePlotter</h1>
      <h2 class="title-heading">Free eye-tracking data&nbsp;visualisation</h2>
    </div>
    <p class="intro-text">
      Transform eye gaze data from eye trackers to interactive scarf plots.
      No&nbsp;registration, no ads and no data stored on&nbsp;a&nbsp;server. We
      love open science.
    </p>
    <Survey tasks={exampleTasks} {forceCloseBanner} />
  </section>
  <section>
    <GazePlotter {loadInitialData} onWorkspaceCommandChain={handleWorkspaceCommand} reinitializeLabel="Reload ETVIS data" />
  </section>
  <section class="main-section" id="about">
    <div class="about-grid">
      <section class="box">
        <h2 class="box-title">Open source Svelte library</h2>
        <p>
          GazePlotter is an open source library, written in Svelte and
          TypeScript. You can use it for free or modify its code to fit your
          specific needs in your projects.
        </p>
        <a href="https://github.com/misavojte/GazePlotter">See GitHub repo</a>
      </section>
      <section class="box">
        <h2 class="box-title">Works with Tobii, SMI & more</h2>
        <p>
          The app creates interactive sequence charts and other analysis from
          Tobii, SMI, GazePoint and other eye trackers. Just upload your data
          and see the results.
        </p>
        <a href="https://docs.gazeplotter.com/upload-data">
          Which files to upload?
        </a>
      </section>
      <section class="box long">
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
      </section>
      <section class="box">
        <h2 class="box-title">Runs without Internet</h2>
        <p>
          GazePlotter does not store your data on a server, thus ensuring data
          privacy. All is done in your browser. You can use it on PCs, Macs,
          tablets, even off-line!
        </p>
        <a href="https://docs.gazeplotter.com/advanced/download-gazeplotter"
          >How to download GazePlotter?</a
        >
      </section>
      <section class="box">
        <h2 class="box-title">Other eye tracking tools</h2>
        <p>
          Eye-Tracking Group at Department of Geoinformatics, Palacký University
          Olomouc, develops other eye tracking tools for free use.
        </p>
        <a href="https://eyetracking.upol.cz/tools/">More eye tracking tools</a>
      </section>
    </div>
  </section>
</main>
<footer class="border-t">
  <div>
    <p>GazePlotter, version {version} ({formattedDate})</p>
    <p>
      Coded & designed by <a href="https://vojtechovska.com" target="_blank"
        >Michaela Vojtěchovská</a
      >, idea by Stanislav Popelka
    </p>
    <p>
      <a href="https://geoinformatics.upol.cz" target="_blank" rel="nofollow"
        >Department of Geoinformatics</a
      >, Palacký University Olomouc
    </p>
    <img
      class="up-logo"
      src="/logos/upol.png"
      alt="Palacký University Olomouc logo"
      width="300"
      height="137"
    />
  </div>
</footer>

<style>
  main,
  header {
    color: var(--c-black);
  }
  .intro {
    text-align: center;
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
    font-size: 1.5rem;
    max-width: 850px;
    margin-inline: auto;
  }

  header > div {
    width: 100%;
    margin: auto;
    padding: 32px;
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 14px;
    box-sizing: border-box;
  }

  header > div {
    padding-block: 0 !important;
    height: 64px;
    align-items: center;
  }

  footer {
    margin-top: 60px;
  }

  footer > div {
    text-align: center;
    padding: 32px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .up-logo {
    margin-top: 30px;
    width: 150px;
    height: auto;
    user-select: none;
  }

  header {
    display: flex;
    align-items: center;
  }

  .border-b {
    border-bottom: #5858583a 1px solid;
  }

  .border-t {
    border-top: #5858583a 1px solid;
  }

  main {
    flex-grow: 1;
  }

  #go-home {
    text-decoration: none;
    display: flex;
    align-items: center;
    color: inherit;
  }

  #go-home:hover,
  #go-home:focus {
    opacity: 0.8;
  }

  #logo {
    margin-right: 10px;
  }

  #sitetitle {
    font-weight: bold;
    font-size: 18px;
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

  footer p a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dotted;
    transition: all 0.3s ease-in-out;
  }

  footer p a:hover,
  footer p a:focus {
    color: black;
  }

  .a-icon {
    color: var(--c-d3);
    font-size: 20px;
    display: contents;
  }

  .a-icon > svg {
    margin-block: auto;
  }

  .about-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, auto));
    margin-top: 80px;
    gap: 24px;
  }

  footer p {
    margin: 0;
  }

  nav {
    display: flex;
    gap: 15px;
  }

  header nav {
    margin-top: 3px;
  }

  a.external-link {
    display: flex;
    align-items: center;
    color: var(--c-d3);
    transition: color 0.25s;
    text-decoration: none;
  }

  a.external-link:hover {
    color: var(--c-brand);
  }

  p {
    line-height: 1.5;
    color: #3c3c43bf;
  }

  .external-link > svg {
    display: inline-block;
    margin-left: 3px;
    width: 11px;
    height: 11px;
    fill: var(--c-d3);
    transition: fill 0.25s;
    flex-shrink: 0;
  }

  .a-icon::before {
    margin-right: 8px;
    margin-left: 8px;
    width: 1px;
    height: 24px;
    background-color: #5858583a;
    content: '';
    pointer-events: none;
  }

  .box {
    display: flex;
    flex-direction: column;
    padding: 32px;
    background: var(--c-lightgrey);
    border-radius: 12px;
  }
  .box-title {
    line-height: 30px;
    font-size: 20px;
    font-weight: bold;
    margin: 0;
  }
  .box p {
    margin-block: 16px;
    font-size: 18px;
    font-weight: 400;
  }
  .box a {
    font-size: 18px;
    font-weight: 600;
    color: var(--c-brand);
    text-decoration: none;
    margin-top: auto;
  }
  .box a:hover,
  .box a:focus {
    color: var(--c-brand-dark);
  }
  .box.long {
    grid-row: span 2;
  }
  .box img {
    width: 102%;
    height: auto;
    margin-block: auto;
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
    header > div,
    footer > div,
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
    footer {
      font-size: 0.9rem;
      margin-top: 40px;
    }
    header > div,
    footer > div,
    .main-section {
      padding-inline: 22px;
    }
  }

  @media only screen and (max-width: 665px) {
    footer {
      font-size: 0.8rem;
    }
    header > div,
    footer > div,
    .main-section {
      padding-inline: 20px;
    }
  }

  @media only screen and (max-width: 540px) {
    .about-grid {
      gap: 18px;
    }
    header > div,
    footer > div,
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
    header > div,
    footer > div,
    .main-section {
      padding-inline: 15px;
    }
    nav {
      gap: 8px;
    }
  }

  @media only screen and (max-width: 380px) {
    header > div,
    footer > div,
    .main-section {
      padding-inline: 12px;
    }
  }
</style>
