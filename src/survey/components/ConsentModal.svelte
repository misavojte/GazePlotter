<script lang="ts">
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  
  interface Props {
    onConsent: () => void
    sessionId: string
  }

  let { onConsent, sessionId }: Props = $props()

  // Configuration constants
  const CONSENT_WITHDRAW_EMAIL = 'mail@vojtechovska.com'
  const DECLINE_REDIRECT_URL = 'https://www.eyetracking.upol.cz'
  
  /**
   * Handles user consent - executes callback and closes modal
   */
  const handleConsent = () => {
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
    You are about to participate in a user experience evaluation of GazePlotter, 
    an eye-tracking data visualization tool. It accepts your own data from Tobii, SMI, GazePoint, PupilLabs, and other eye trackers, automatically converting them to scarf plots (showing the order of fixations in various Areas of Interest—AOIs—over time) and other visualizations.
    The tool is and will remain free for anyone to use.
  </p>
  <p>
    This evaluation will help us improve 
    the software for researchers and practitioners in the field of eye-tracking.
  </p>
  
  <h4>What you will be asked to do:</h4>
  <ul>
    <li>Complete a series of guided basic tasks using the GazePlotter interface</li>
    <li>Explore different visualizations and some of its features</li>
    <li>Answer questions about your experience</li>
    <li>The entire session should take approximately 15 minutes</li>
  </ul>

  <h4>Your participation:</h4>
  <ul>
    <li>Is completely voluntary</li>
    <li>Can be withdrawn at any time without penalty</li>
    <li>You will not be asked to provide identifying information (name, email, etc.)</li>
    <li>Will help improve the tool for the research community</li>
  </ul>

  <h4>Data we collect:</h4>
  <p>
    To ensure the scientific validity and quality of this research, we collect the 
    following data:
  </p>
  <ul>
    <li><strong>Survey responses</strong>: your experience ratings and feedback</li>
    <li><strong>Interaction data</strong>: detailed workspace interactions, task completion times and triggered commands</li>
    <li><strong>Session metadata</strong>: anonymous session ID, timestamps, browser information (user agent, screen dimensions, page URL)</li>
    <li><strong>Geographic cohort</strong>: your recruitment location saved via page URL (e.g., "?cohort=Lithuania")</li>
  </ul>

  <h4>Data privacy and handling:</h4>
  <p>
    All data is collected in accordance with the ethics approval obtained from the Ethics Committee of Faculty of Science, Palacký University Olomouc (Ref. No.: 22-01):
  </p>
  <ul>
    <li>You will be assigned an anonymous identifier (your session ID) that is not linked to your identity</li>
    <li>All data is stored securely and anonymously at the server of the Department of Geoinformatics, Palacký University Olomouc</li>
    <li>Data will be used solely for scientific research purposes</li>
    <li>Results may be published in academic papers and conference presentations</li>
    <li>You can revoke your consent and request data removal at any time by providing your session ID to the research team</li>
  </ul>

  <h4>Your session identifier:</h4>
  <p class="session-info">
    <strong>Session ID: <code class="session-id">{sessionId}</code></strong>
  </p>
  <p>
    Please save this identifier. If you wish to request information or withdraw your consent at any time, 
    you can contact us at <strong><a href="mailto:{CONSENT_WITHDRAW_EMAIL}">{CONSENT_WITHDRAW_EMAIL}</a></strong> (Michaela Vojtechovska; contact person for this evaluation) and provide your session ID. 
  </p>

  <p>
    By clicking "I consent to participate", you confirm that you have read and 
    understood the above information and agree to participate in this evaluation.
  </p>
  
  <p class="decline-notice">
    <strong>If you do not wish to participate, please close this page or click "I do not consent".</strong>
  </p>

  <div class="button-container">
    <GeneralButtonMajor variant="primary" onclick={handleConsent}>
      I consent to participate
    </GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleDecline}>
      I do not consent
    </GeneralButtonMajor>
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
    background: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
    color: #0277bd;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .decline-notice {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: var(--rounded-sm);
    padding: 0.75rem;
    margin-top: 1rem;
    color: #856404;
  }

  .button-container {
    display: flex;
    gap: 1rem;
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
</style>
