<script lang="ts">
  import { GazePlotter } from '$lib'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import type { ParsedData } from '$lib/data/types'
  import { EyeWorkerService } from '$lib/data/ingest/controller'
  import {
    Survey,
    surveyStore,
    createCondition,
    ConsentModal,
    endpointService,
    type EndpointConfig,
  } from '$survey'
  import { SurveyModal } from '$survey/components'
  import type { SurveyTask, SurveyModalState } from '$survey/types'
  import type { WorkspaceCommandChain } from '$lib/workspace/commands'
  import { modalState } from '$lib/modals'
  import type { UEQSResults, EyeTrackingExperienceResult } from '$survey/types'
  import { onMount } from 'svelte'

  const endpointConfig: EndpointConfig = {
    endpoint:
      'https://eyetracking.upol.cz/GPsurvey/GazePlotterSurveyEndpoint.php',
  }

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

  // Create condition stores for automatic task completion
  const consentCondition = createCondition() // Monitor for consent confirmation
  const stimulusCondition = createCondition() // Monitor for "Task 2" stimulus
  const timelineCondition = createCondition() // Monitor for "relative" timeline
  const groupCondition = createCondition() // Monitor for "Group 1" selection
  const duplicateCondition = createCondition() // Monitor for plot duplication
  const group2Condition = createCondition() // Monitor for "Group 2" selection
  const aoiCustomizationCondition = createCondition() // Monitor for AOI grouping
  const transitionMatrixCondition = createCondition() // Monitor for Transition Matrix aggregation
  const barPlotCondition = createCondition() // Monitor for Bar Plot aggregation
  const explorationCondition = createCondition() // Monitor for UI exploration completion
  const transitionMatrixStimulusCondition = createCondition() // Monitor for Transition Matrix stimulus
  const barPlotStimulusCondition = createCondition() // Monitor for Bar Plot stimulus

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

  // Reference to GazePlotter component for resetting layout
  let gazePlotterRef = $state<any>(null)

  // Monitor modal store to force close banner when any modal is open
  $effect(() => {
    forceCloseBanner = modalState.activeModal !== null
  })

  // Monitor survey store to log task fulfillment
  $effect(() => {
    if (!browser) return

    const unsubscribe = surveyStore.subscribe(state => {
      const currentTaskIndex = state.currentActiveTaskIndex

      // Log task fulfillment when index changes and it wasn't a skip
      if (
        currentTaskIndex !== previousTaskIndex &&
        previousTaskIndex >= 0 &&
        !wasLastActionSkip
      ) {
        const completedTask = state.tasks[previousTaskIndex]

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

    return unsubscribe
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
      onButtonClick: () => {
        modalState.open(
          ConsentModal as any,
          'UX Evaluation Instructions & Consent',
          {
            sessionId: endpointService.getSessionId(),
            onConsent: () => {
              // Log informed consent event with URL data (fire-and-forget, non-blocking)
              if (browser && endpointService.isServiceInitialized()) {
                endpointService
                  .storeSurveyData({
                    type: 'informedConsentCollected',
                    timestamp: Date.now(),
                    data: {
                      pageUrl: window.location.href,
                      clientInfo: navigator.userAgent,
                      windowDimensions:
                        window.innerWidth + 'x' + window.innerHeight,
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
          }
        )
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
      text: 'Pan to Bar Plot and set its stimulus to Task 2',
      condition: barPlotStimulusCondition, // Auto-completes when stimulus is set to Task 2
      onSkip: createSkipHandler(
        9,
        'Pan to Bar Plot and set its stimulus to Task 2'
      ),
    },
    {
      text: "On Bar Plot, set aggregation method to 'Mean visits'",
      condition: barPlotCondition, // Auto-completes when aggregation is changed
      onSkip: createSkipHandler(
        10,
        "On Bar Plot, set aggregation method to 'Mean visits'"
      ),
    },
    {
      text: 'Feel free to explore the UI as long as you wish',
      buttonText: 'I now want to answer questions and end survey',
      onButtonClick: () => {
        modalState.open(SurveyModal as any, 'User Experience Questionnaire', {
          surveyState,
          onComplete: (results: {
            ueqs: UEQSResults
            eyeTracking: EyeTrackingExperienceResult
            feedback: string
          }) => {
            console.log('Survey completed with results:', results)

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
                    ueqsResults: results.ueqs,
                    eyeTrackingResults: results.eyeTracking,
                    feedback: results.feedback,
                  },
                })
                .catch(error => {
                  console.error('Failed to log survey completion:', error)
                })
            }

            explorationCondition.set(true) // Manually trigger condition
          },
        })
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
    console.log('command', command)
    console.log('hasInformedConsent', hasInformedConsent)

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

    // Check for stimulus change to Task 2 (stimulusId === 1) from scarf plot
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'stimulusId' in command.settings &&
      command.settings.stimulusId === 1 &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      stimulusCondition.set(true)
    }

    // Check for timeline change to relative from scarf plot
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'timeline' in command.settings &&
      command.settings.timeline === 'relative' &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      timelineCondition.set(true)
    }

    // Check for group change to Analytics (groupId === 1) from scarf plot
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'groupId' in command.settings &&
      command.settings.groupId === 1 &&
      isCommandFromPlotType(command.source, 'scarf')
    ) {
      groupCondition.set(true)
    }

    // Check for group change to Holistics (groupId === 2) from scarf plot
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'groupId' in command.settings &&
      command.settings.groupId === 2 &&
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
      command.type === 'updateSettings' &&
      command.settings &&
      'aggregationMethod' in command.settings &&
      command.settings.aggregationMethod === 'probability' &&
      isCommandFromPlotType(command.source, 'transitionMatrix')
    ) {
      transitionMatrixCondition.set(true)
    }

    // Check for Bar Plot aggregation change to 'Mean visits'
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'aggregationMethod' in command.settings &&
      command.settings.aggregationMethod === 'averageEntries' &&
      isCommandFromPlotType(command.source, 'barPlot')
    ) {
      barPlotCondition.set(true)
    }

    // Check for Transition Matrix stimulus change to Task 2
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'stimulusId' in command.settings &&
      command.settings.stimulusId === 1 &&
      isCommandFromPlotType(command.source, 'transitionMatrix')
    ) {
      transitionMatrixStimulusCondition.set(true)
    }

    // Check for Bar Plot stimulus change to Task 2
    if (
      command.type === 'updateSettings' &&
      command.settings &&
      'stimulusId' in command.settings &&
      command.settings.stimulusId === 1 &&
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
      {loadInitialData}
      onWorkspaceCommandChain={handleWorkspaceCommand}
      reinitializeLabel="Reload ETVIS data"
    />
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
    transition: color 0.2s ease-in-out;
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
    transition: background 0.2s ease-in-out;
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, auto));
    margin-top: 80px;
    margin-bottom: 80px;
    gap: 24px;
  }

  p {
    line-height: 1.5;
    color: #3c3c43bf;
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
