<script lang="ts">
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  
  interface Props {
    onConsent: () => void
  }

  let { onConsent }: Props = $props()

  const handleConsent = () => {
    onConsent()
    modalStore.close()
  }

  const handleDecline = () => {
    // If user doesn't consent, redirect them away from the page
    window.location.href = 'https://www.eyetracking.upol.cz' // or any other appropriate URL
  }
</script>

<div class="consent-content">
  <p>
    You are about to participate in a user experience evaluation of GazePlotter, 
    an eye-tracking data visualization tool. This evaluation will help us improve 
    the software for researchers and practitioners in the field of eye-tracking.
  </p>
  
  <h4>What you will be asked to do:</h4>
  <ul>
    <li>Complete a series of guided basic tasks using the GazePlotter interface</li>
    <li>Explore different features and visualizations</li>
    <li>Answer questions about your experience</li>
    <li>The entire session should take approximately 15 minutes</li>
  </ul>

  <h4>Your participation:</h4>
  <ul>
    <li>Is completely voluntary</li>
    <li>Can be withdrawn at any time without penalty</li>
    <li>Will not collect any personal data beyond your responses</li>
    <li>Will help improve the tool for the research community</li>
  </ul>

  <h4>Data handling:</h4>
  <ul>
    <li>No personal information will be collected</li>
    <li>Your responses will be anonymized</li>
    <li>Data will be used solely for research purposes</li>
    <li>Results may be published in academic papers</li>
  </ul>

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
</style>
