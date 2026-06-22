<script lang="ts">
  import { GazePlotter, fromUrl } from '$lib'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import {
    Survey,
    surveyStore,
    createCondition,
    consentModal,
    endpointService,
    type EndpointConfig,
    surveyModal,
    type SurveyModalResult,
  } from '$survey'
  import type { SurveyTask, SurveyModalState } from '$survey/types'
  import type { WorkspaceCommandChain } from '$lib/workspace/commands'
  import type { AllPlotSettings } from '$lib/workspace'
  import type { GazePlotterSession } from '$lib/session'
  import { onMount } from 'svelte'

  const endpointConfig: EndpointConfig = {
    endpoint:
      'https://eyetracking.upol.cz/GPsurvey/GazePlotterSurveyEndpoint.php',
  }

  const load = fromUrl(`${base}/data/etvis.json`, 'demo.json')

  let gazePlotterRef = $state<{
    resetLayout: () => void
    getSession: () => GazePlotterSession
  } | null>(null)

  // Create condition stores for automatic task completion
  const consentCondition = createCondition() // Monitor for consent confirmation
  const stimulusCondition = createCondition() // Monitor for "Task 2" stimulus
  const timelineCondition = createCondition() // Monitor for "relative" timeline
  const groupCondition = createCondition() // Monitor for "Group 1" selection
  const duplicateCondition = createCondition() // Monitor for plot duplication
  const group2Condition = createCondition() // Monitor for "Group 2" selection
  const aoiCustomizationCondition = createCondition() // Monitor for AOI grouping
  const transitionMatrixCondition = createCondition() // Monitor for Transition Matrix aggregation
  const barPlotCondition = createCondition() // Monitor for AOI Metrics aggregation
  const explorationCondition = createCondition() // Monitor for UI exploration completion
  const transitionMatrixStimulusCondition = createCondition() // Monitor for Transition Matrix stimulus
  const barPlotStimulusCondition = createCondition() // Monitor for AOI Metrics stimulus

  // State for forcing banner to close on any modal content
  let forceCloseBanner = $state(false)

  // Track previous task index for logging task progression
  let previousTaskIndex = $state(-1)
  let wasLastActionSkip = $state(false)

  // Track if informed consent has been given
  let hasInformedConsent = $state(false)

  // Track previous consent session information to surface a warning banner when necessary
  let previousConsentSessionId = $state<string | null>(null)
  let showPreviousConsentBanner = $state(false)

  // Monitor modal store to force close banner when any modal is open
  $effect(() => {
    forceCloseBanner =
      gazePlotterRef?.getSession().modalState.activeModal !== null
  })

  // Monitor survey store to log task fulfillment
  $effect(() => {
    if (!browser) return

    const currentTaskIndex = surveyStore.currentActiveTaskIndex

    // Log task fulfillment when index changes and it wasn't a skip
    if (
      currentTaskIndex !== previousTaskIndex &&
      previousTaskIndex >= 0 &&
      !wasLastActionSkip
    ) {
      const completedTask = surveyStore.tasks[previousTaskIndex]

      if (
        completedTask &&
        hasInformedConsent &&
        endpointService.isServiceInitialized()
      ) {
        endpointService
          .storeSurveyData({
            type: 'task_fulfilled',
            timestamp: Date.now(),
            data: {
              taskIndex: previousTaskIndex,
              taskText: completedTask.text,
            },
          })
          .catch(error => {
            console.error('Failed to log task fulfillment:', error)
          })
      }
    }

    // Reset skip flag after handling the transition
    wasLastActionSkip = false
    previousTaskIndex = currentTaskIndex
  })

  // Survey state - persists when modal is closed and reopened
  let surveyState = $state<SurveyModalState>({
    isCompleted: false,
    ueqsResults: null,
    eyeTrackingResults: null,
    feedbackText: '',
    currentStepIndex: 0,
    ueqsComplete: false,
    eyeTrackingValue: null,
    feedbackValue: '',
  })

  // Initialize endpoint service for logging (only in browser)
  if (browser) {
    endpointService.initialize(endpointConfig).catch(error => {
      console.error('Failed to initialize endpoint service:', error)
    })
  }

  onMount(() => {
    if (!browser) {
      return
    }

    const storedSessionId = endpointService.getLastConsentSessionId()
    if (storedSessionId) {
      previousConsentSessionId = storedSessionId
      showPreviousConsentBanner = true
    }
  })

  /**
   * Helper function to create onSkip callback for logging task skips
   * @param taskIndex - The index of the task being skipped
   * @param taskText - The text of the task being skipped
   * @returns Callback function that logs the skip and sets the skip flag
   */
  function createSkipHandler(
    taskIndex: number,
    taskText: string
  ): (taskIndex: number, reason: string) => void {
    return (_, reason: string) => {
      wasLastActionSkip = true

      // Log task skip event (fire-and-forget, non-blocking)
      if (
        browser &&
        hasInformedConsent &&
        endpointService.isServiceInitialized()
      ) {
        endpointService
          .storeSurveyData({
            type: 'task_skipped',
            timestamp: Date.now(),
            data: {
              taskIndex,
              taskText,
              skipReason: reason,
            },
          })
          .catch(error => {
            console.error('Failed to log task skip:', error)
          })
      }
    }
  }

  const dismissPreviousConsentBanner = (): void => {
    showPreviousConsentBanner = false
  }

  // Example tasks with conditions and alert buttons
  const exampleTasks: SurveyTask[] = [
    {
      text: 'Read UX evaluation instructions & consent',
      buttonText: 'Open instructions & consent',
      onButtonClick: async () => {
        const didConsent = await gazePlotterRef
          ?.getSession()
          .modalState.open(consentModal, {
            sessionId: endpointService.getSessionId(),
          })

        if (!didConsent) return

        // Log informed consent event with URL data (fire-and-forget, non-blocking)
        if (browser && endpointService.isServiceInitialized()) {
          endpointService
            .storeSurveyData({
              type: 'informedConsentCollected',
              timestamp: Date.now(),
              data: {
                pageUrl: window.location.href,
                clientInfo: navigator.userAgent,
                windowDimensions: window.innerWidth + 'x' + window.innerHeight,
              },
            })
            .catch(error => {
              console.error('Failed to log informed consent:', error)
            })
        }

        // Set consent flag to enable data collection
        hasInformedConsent = true

        // Persist the consent session identifier for future visits and hide the banner for this session
        endpointService.persistLastConsentSessionId(
          endpointService.getSessionId()
        )
        previousConsentSessionId = null
        showPreviousConsentBanner = false

        // Reset the GazePlotter layout to initial state
        if (gazePlotterRef) {
          gazePlotterRef.resetLayout()
        }

        consentCondition.set(true) // Manually trigger condition
      },
      condition: consentCondition,
      skippable: false,
    },
    {
      text: 'Scroll to workspace below. On Scarf Plot, set stimulus to Task 2',
      condition: stimulusCondition, // Auto-completes when stimulus is set to Task 2
      onSkip: createSkipHandler(1, 'On scarf plot, set stimulus to Task 2'),
    },
    {
      text: "On Scarf Plot, set group to 'Analytics'",
      condition: groupCondition, // Auto-completes when group is set to Group 1
      onSkip: createSkipHandler(2, "Set group to 'Analytics'"),
    },
    {
      text: 'On Scarf Plot, set timeline to relative',
      condition: timelineCondition, // Auto-completes when timeline is set to relative
      onSkip: createSkipHandler(3, 'Set timeline to relative'),
    },
    {
      text: 'Duplicate Scarf Plot',
      condition: duplicateCondition, // Auto-completes when plot is duplicated
      onSkip: createSkipHandler(4, 'Duplicate Scarf Plot'),
    },
    {
      text: "On the duplicated Scarf Plot, set group to 'Holistics'",
      condition: group2Condition, // Auto-completes when group is set to Group 2
      onSkip: createSkipHandler(
        5,
        "On the duplicated Scarf Plot, set group to 'Holistics'"
      ),
    },
    {
      text: "Find 'AOI Customization' and group XAxis and YAxis (in stimulus Task 2) by giving them the same name",
      condition: aoiCustomizationCondition, // Auto-completes when AOIs are grouped
      onSkip: createSkipHandler(
        6,
        "Find 'AOI Customization' and group XAxis and YAxis (in stimulus Task 2) by giving them the same name"
      ),
    },
    {
      text: 'Pan to Transition Matrix and set its stimulus to Task 2',
      condition: transitionMatrixStimulusCondition, // Auto-completes when stimulus is set to Task 2
      onSkip: createSkipHandler(
        7,
        'Pan to Transition Matrix and set its stimulus to Task 2'
      ),
    },
    {
      text: "On Transition Matrix, change aggregation metric to '1-step probability'",
      condition: transitionMatrixCondition, // Auto-completes when aggregation is changed
      onSkip: createSkipHandler(
        8,
        "On Transition Matrix, change aggregation metric to '1-step probability'"
      ),
    },
    {
      text: 'Pan to AOI Comparison and set its stimulus to Task 2',
      condition: barPlotStimulusCondition, // Auto-completes when stimulus is set to Task 2
      onSkip: createSkipHandler(
        9,
        'Pan to AOI Comparison and set its stimulus to Task 2'
      ),
    },
    {
      text: "On AOI Comparison, set aggregation method to 'Visit count'",
      condition: barPlotCondition, // Auto-completes when aggregation is changed
      onSkip: createSkipHandler(
        10,
        "On AOI Comparison, set aggregation method to 'Visit count'"
      ),
    },
    {
      text: 'Feel free to explore the UI as long as you wish',
      buttonText: 'I now want to answer questions and end survey',
      onButtonClick: async () => {
        const results = await gazePlotterRef
          ?.getSession()
          .modalState.open(surveyModal, {
            surveyState,
          })

        if (!results) return

        const surveyResults = results as SurveyModalResult

        // Log survey completion to the endpoint service (fire-and-forget, non-blocking)
        if (
          browser &&
          hasInformedConsent &&
          endpointService.isServiceInitialized()
        ) {
          endpointService
            .storeSurveyData({
              type: 'survey_completion',
              timestamp: Date.now(),
              data: {
                ueqsResults: surveyResults.ueqs,
                eyeTrackingResults: surveyResults.eyeTracking,
                feedback: surveyResults.feedback,
              },
            })
            .catch(error => {
              console.error('Failed to log survey completion:', error)
            })
        }

        explorationCondition.set(true) // Manually trigger condition
      },
      condition: explorationCondition,
      skippable: false,
    },
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
    return (
      source.startsWith(`${plotType}.`) ||
      source.startsWith(`undo.${plotType}.`) ||
      source.startsWith(`redo.${plotType}.`)
    )
  }

  const handleWorkspaceCommand = (command: WorkspaceCommandChain) => {
    // Log the workspace command to the endpoint service (fire-and-forget, non-blocking)
    // Deep clone the command to prevent race conditions where the command data might be
    // mutated before async logging completes (especially on Windows Chrome where timing can differ)
    if (hasInformedConsent && endpointService.isServiceInitialized()) {
      // Create a deep clone to ensure we capture the command state at this exact moment
      const commandSnapshot = structuredClone(command)

      endpointService
        .storeSurveyData({
          type: 'workspace_command',
          timestamp: Date.now(),
          data: { command: commandSnapshot },
        })
        .catch(error => {
          console.error('Failed to log workspace command:', error)
        })
    }

    // Prevent any conditions from being set until informed consent is given
    if (!hasInformedConsent) {
      return
    }

    // A settings change targets a SET of items (`updates`); a single edit is
    // a list of one. A condition fires when ANY targeted item matches.
    const settingsUpdateMatches = (
      predicate: (settings: Partial<AllPlotSettings>) => boolean
    ): boolean =>
      command.type === 'updateSettings' &&
      command.updates.some(u => predicate(u.settings))

    // Check for stimulus change to Task 2 (stimulusId === 1) from scarf plot
    if (
      settingsUpdateMatches(s => 'stimulusId' in s && s.stimulusId === 1) &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      stimulusCondition.set(true)
    }

    // Check for timeline change to relative from scarf plot
    if (
      settingsUpdateMatches(s => 'timeline' in s && s.timeline === 'relative') &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      timelineCondition.set(true)
    }

    // Check for group change to Analytics (groupId === 1) from scarf plot
    if (
      settingsUpdateMatches(s => 'groupId' in s && s.groupId === 1) &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      groupCondition.set(true)
    }

    // Check for group change to Holistics (groupId === 2) from scarf plot
    if (
      settingsUpdateMatches(s => 'groupId' in s && s.groupId === 2) &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      group2Condition.set(true)
    }

    // Check for plot duplication (works from any plot type)
    if (command.type === 'duplicateGridItem') {
      duplicateCondition.set(true)
    }

    // Check for AOI customization - detect when at least two AOIs have the same displayed name
    // This can come from any plot type that supports AOI customization
    if (
      command.type === 'updateAois' &&
      command.aois &&
      command.aois.length > 0
    ) {
      // Count occurrences of each displayed name
      const nameCounts = new Map<string, number>()

      command.aois.forEach(aoi => {
        const displayedName = (aoi.displayedName || '').trim()
        if (displayedName !== '') {
          nameCounts.set(
            displayedName,
            (nameCounts.get(displayedName) || 0) + 1
          )
        }
      })

      // Check whether the aois with original names "T2-DataPAQ-OsayY" and "T2-DataPAQ-OsaX" are grouped
      // i.e. having the same displayed name (trimmed and normalized)
      const aoi1 = command.aois.find(
        aoi => aoi.originalName === 'T2-DataPAQ-OsayY'
      )
      const aoi2 = command.aois.find(
        aoi => aoi.originalName === 'T2-DataPAQ-OsaX'
      )

      // Normalize names by trimming and handling empty strings
      const name1 = (aoi1?.displayedName || '').trim()
      const name2 = (aoi2?.displayedName || '').trim()

      // Both names must be non-empty and equal for grouping
      if (aoi1 && aoi2 && name1 !== '' && name2 !== '' && name1 === name2) {
        aoiCustomizationCondition.set(true)
      }
    }

    // Check for Transition Matrix aggregation change to '1-step probability'
    if (
      settingsUpdateMatches(
        s => 'aggregationMethod' in s && s.aggregationMethod === 'probability'
      ) &&
      isCommandFromPlotType(command.source, 'transitionMatrix')
    ) {
      transitionMatrixCondition.set(true)
    }

    // Check for AOI Metrics aggregation change to 'Visit count'
    if (
      settingsUpdateMatches(
        s =>
          'metricInstanceIds' in s &&
          Array.isArray(s.metricInstanceIds) &&
          s.metricInstanceIds[0] === 'visitCount'
      ) &&
      isCommandFromPlotType(command.source, 'barPlot')
    ) {
      barPlotCondition.set(true)
    }

    // Check for Transition Matrix stimulus change to Task 2
    if (
      settingsUpdateMatches(s => 'stimulusId' in s && s.stimulusId === 1) &&
      isCommandFromPlotType(command.source, 'transitionMatrix')
    ) {
      transitionMatrixStimulusCondition.set(true)
    }

    // Check for AOI Metrics stimulus change to Task 2
    if (
      settingsUpdateMatches(s => 'stimulusId' in s && s.stimulusId === 1) &&
      isCommandFromPlotType(command.source, 'barPlot')
    ) {
      barPlotStimulusCondition.set(true)
    }
  }
</script>

<svelte:head>
  <title
    >GazePlotter | Free eye-tracking data visualisation via scarf plots</title
  >
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

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
    {#if showPreviousConsentBanner && previousConsentSessionId}
      <div class="previous-consent-banner" role="alert">
        <p class="previous-consent-banner__message">
          <strong>Warning!</strong>
          There has already been a survey started from this computer with the session
          named
          <span class="previous-consent-banner__session-id"
            >{previousConsentSessionId}</span
          >.
        </p>
        <p class="previous-consent-banner__contact">
          Do you wish to contact admin at <a
            href="mailto:mail@vojtechovska.com"
            class="previous-consent-banner__link">mail@vojtechovska.com</a
          >?
        </p>
        <button
          type="button"
          class="previous-consent-banner__dismiss"
          onclick={dismissPreviousConsentBanner}
        >
          Dismiss. I either restarted / am a different participant
        </button>
      </div>
    {/if}
    <Survey tasks={exampleTasks} {forceCloseBanner} />
  </section>
  <section>
    <GazePlotter
      bind:this={gazePlotterRef}
      {load}
      onWorkspaceCommandChain={handleWorkspaceCommand}
    />
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

  .previous-consent-banner {
    position: relative;
    margin: 24px auto 0;
    padding: 14px 16px 16px;
    max-width: 500px;
    background: #e8f2ff;
    border: 1px solid #7cb0ff;
    border-radius: 10px;
    color: #0b3d91;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .previous-consent-banner__message {
    margin: 0;
    line-height: 1.4;
  }

  .previous-consent-banner__session-id {
    font-family:
      'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-weight: 600;
  }

  .previous-consent-banner__contact {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.4;
    color: rgba(11, 61, 145, 0.8);
  }

  .previous-consent-banner__link {
    color: #0d63e0;
    text-decoration: underline;
    transition: color var(--transition-normal) ease-in-out;
  }

  .previous-consent-banner__link:hover,
  .previous-consent-banner__link:focus {
    color: #0a4fae;
  }

  .previous-consent-banner__dismiss {
    align-self: center;
    padding: 6px 14px;
    background: #0d63e0;
    color: white;
    border: none;
    border-radius: 999px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background var(--transition-normal) ease-in-out;
  }

  .previous-consent-banner__dismiss:hover,
  .previous-consent-banner__dismiss:focus {
    background: #0a4fae;
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

  p {
    line-height: 1.5;
    color: #3c3c43bf;
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
