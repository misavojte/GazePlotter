<script lang="ts">
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'

  interface Props {
    onConsent: () => void
    sessionId: string
  }

  let { onConsent, sessionId }: Props = $props()

  const CONSENT_WITHDRAW_EMAIL = 'mail@vojtechovska.com'
  const DECLINE_REDIRECT_URL = 'https://www.eyetracking.upol.cz'

  let over18 = $state(false)
  let readInfo = $state(false)
  let agreeToParticipate = $state(false)

  /**
   * Handles user consent - executes callback and closes modal
   * Only proceeds if all three checkboxes are checked
   */
  const handleConsent = () => {
    if (!over18 || !readInfo || !agreeToParticipate) return
    onConsent()
    modalStore.close()
  }

  /**
   * Handles user decline - redirects away from the evaluation
   */
  const handleDecline = () => {
    window.location.href = DECLINE_REDIRECT_URL
  }
</script>

<div class="consent-content">

  <p>
    GazePlotter is an eye-tracking data visualisation tool that works with data from various eye
    trackers (Tobii, SMI, GazePoint, PupilLabs, etc.) and creates visualisations such as scarf
    plots (sequences of fixations in time coloured by <em>Areas of Interest (AOIs)</em> for each participant). You will work with pre-loaded eye-tracking data from one of our studies
    and complete several small tasks in the GazePlotter interface, followed by a short questionnaire on user experience.
  </p>

  <h4>Controller & contacts</h4>
  <ul>
    <li>
      <strong>Controller:</strong> Dept. of Geoinformatics, Palacký University Olomouc, 17.
      listopadu 50, 779 00 Olomouc, CZ
    </li>
    <li>
      <strong>Study contact:</strong> Mgr. Michaela Vojtěchovská —
      <a href="mailto:{CONSENT_WITHDRAW_EMAIL}">{CONSENT_WITHDRAW_EMAIL}</a>
    </li>
    <li>
      <strong>Palacký University Olomouc Data Protection Officer:</strong> Mgr. Dott. Františka Sandroni —
      <a href="mailto:dpo@upol.cz">dpo@upol.cz</a>
    </li>
  </ul>

  <h4>Purpose & legal basis</h4>
  <p>
    Scientific research to evaluate and improve GazePlotter and report results.
    Participation is voluntary. The survey is approved by the Ethics Committee of the Faculty of Science, Palacký University Olomouc
    (Ref. No.: 22-01).
  </p>
  <p> Data are processed under GDPR Art. 6(1)(e) as a task carried out in the public interest
  under applicable Czech higher-education and research law, with Art. 89(1) safeguards
  (pseudonymisation, access controls, EU hosting).</p>

  <h4>What we collect</h4>
  <ul>
    <li><strong>Task data:</strong> relative task timings, success, counts of the commands issued to the GazePlotter workspace</li>
    <li>
      <strong>Questionnaire:</strong> UEQ responses; your eye-tracking experience; brief open-ended feedback
      (<em>please avoid personal/sensitive details</em>)
    </li>
    <li><strong>Cohort:</strong> "Lithuania" or "Czechia" (from the study link)</li>
    <li>
      <strong>Technical metadata (raw only):</strong> browser user-agent, screen dimensions, page
      URL, and detailed interaction logs.
    </li>
    <li><strong>Session ID:</strong> a pseudonymous identifier (shown below) used to handle your rights requests (e.g., erasure before the freeze)</li>
  </ul>
  <p>
    <strong>We do not request any Special-category data</strong> (e.g., health, religion, political
    opinions). Please avoid including such details in free text. If provided, we will
    redact them.
  </p>

  <h4>Storage, sharing & retention</h4>
  <ul>
    <li>
      <strong>Raw/pseudonymised logs (incl. technical metadata):</strong> stored on Palacký University Olomouc servers
      (access-controlled) for the necessary duration of the research purposes (≥10 years after end of research or publication/deposition, per university policy R-B-24/08); <u>never shared publicly</u>
    </li>
    <li>
      <strong>Dataset freeze:</strong> on <strong>December 1, 2025</strong>, the dataset will be frozen. After this date,
      anonymised aggregations will be calculated (see below) and raw logs will be retained securely for verification and
      scientific integrity purposes.
    </li>
    <li>
      <strong>Public OSF (EU/Frankfurt):</strong> we share only an <strong>anonymous summary
        dataset</strong> (e.g., aggregate task timings, UEQ scores, and redacted open-ended feedback; see 'What we collect'). No
      IDs, no absolute timestamps, no technical metadata. Hosted in the EU (Frankfurt); <strong>no transfers outside the EEA are intended</strong>.
    </li>
    <li><strong>Public retention:</strong> anonymous summaries kept <strong>indefinitely</strong></li>
  </ul>

  <h4>Recipients & processors</h4>
  <p>
    Raw/pseudonymised logs are accessible only to authorised members of the research team at Palacký University Olomouc.
  UP IT acts as data processor for server operations. <strong>Upon justified request for scientific verification</strong>
  (e.g., journal editors or qualified researchers), we may provide a <strong>controlled-access verification package</strong>
  under strict terms (no onward sharing, no re-identification, deletion after use). No other recipients receive raw logs.
  </p>

  <h4>Your rights</h4>
  <p>
    You may request <strong>access, rectification, restriction, or erasure</strong> of your
    raw/pseudonymised records <strong>until December 1, 2025</strong> (the dataset freeze date) by
    emailing <a href="mailto:{CONSENT_WITHDRAW_EMAIL}">{CONSENT_WITHDRAW_EMAIL}</a> with your
    <strong>Session ID</strong>. You also have the <strong>right to object</strong> to processing based
    on Art. 6(1)(e).
  </p>
  <p>
    After the freeze date, deleting individual records would <em>seriously impair</em> the research
    purpose; under <strong>GDPR Art. 17(3)(d)</strong> (with Art. 89(1)
    safeguards) the right to erasure no longer applies to the frozen dataset. Anonymous OSF summaries
    cannot be linked back to you and are not subject to erasure.
  </p>
  <p>
    You can complain to the Czech DPA (ÚOOÚ) or your local EEA authority. Participation is voluntary;
    you may stop at any time. No automated decision-making with legal or similarly significant effects
    is performed. <strong>Eligibility: 18+.</strong> Risks are minimal; no compensation.
  </p>

  <h4>Your session identifier</h4>
  <p class="session-info">
    <strong>Session ID: <code class="session-id">{sessionId}</code></strong>
    <br />
    <span class="session-instruction">Quote this ID in any rights request.</span>
  </p>

  <label class="mt-2 block">
    <input type="checkbox" bind:checked={over18} />
    <span>I confirm I am 18 years or older.</span>
  </label>
  <label class="mt-1 block">
    <input type="checkbox" bind:checked={readInfo} />
    <span>I have read and understood this information.</span>
  </label>
  <label class="mt-1 block">
    <input type="checkbox" bind:checked={agreeToParticipate} />
    <span>I agree to participate in the study.</span>
  </label>

  <div class="button-container">
    <GeneralButtonMajor variant="primary" onclick={handleConsent} isDisabled={!over18 || !readInfo || !agreeToParticipate}>
      Start the study
    </GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleDecline}>I do not want to participate</GeneralButtonMajor>
  </div>
</div>

<style>
  .session-info {
    background: #e8f4f8;
    border: 1px solid #b3d9e6;
    border-radius: var(--rounded-sm);
    padding: 0.75rem;
    margin-top: 1rem;
    text-align: center;
  }

  .session-id {
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    background: #fff;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
    color: #0277bd;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .session-instruction {
    font-size: 0.75rem;
    color: #666;
    display: block;
    margin-top: 0.5rem;
  }

  .button-container {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-start;
    margin-top: 1.5rem;
  }

  @media (max-width: 480px) {
    .button-container {
      flex-direction: column;
    }
  }

  a {
    color: var(--c-brand);
    text-decoration: underline;
    cursor: pointer;
  }

  a:hover {
    color: var(--c-brand-dark);
  }

  strong {
    font-weight: 600;
  }

  .mt-2 {
    margin-top: 0.5rem;
  }

  .mt-1 {
    margin-top: 0.25rem;
  }

  .block {
    display: block;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  label input[type='checkbox'] {
    cursor: pointer;
  }
</style>
