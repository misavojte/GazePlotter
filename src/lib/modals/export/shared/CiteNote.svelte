<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import Button from '$lib/shared/components/Button.svelte'

  /**
   * Shown where a figure leaves GazePlotter for a paper: the moment a reader
   * is most likely to need the reference, so it is offered right there.
   */
  const CITATION =
    'Vojtechovska, M., Popelka, S. GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data. Behav Res 58, 85 (2026). https://doi.org/10.3758/s13428-026-02959-5'

  const { toastState } = getGazePlotterSession()

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(CITATION)
      toastState.addSuccess('Citation copied to the clipboard')
    } catch {
      toastState.addError('The citation could not be copied. Select the text and copy it instead.')
    }
  }
</script>

<aside class="cite-note" aria-label="How to cite GazePlotter">
  <div class="cite-text">
    <p class="cite-title">Using these figures in a publication?</p>
    <p class="cite-reference">Please cite: {CITATION}</p>
  </div>
  <Button size="sm" variant="secondary" onclick={copy}>Copy citation</Button>
</aside>

<style>
  .cite-note {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: var(--rounded-md);
    background-color: var(--c-darkwhite);
    border: 1px solid var(--c-border);
  }

  .cite-text {
    flex: 1 1 auto;
    min-width: 0;
  }

  .cite-title {
    margin: 0 0 2px;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--c-black);
    text-wrap: balance;
  }

  .cite-reference {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    color: var(--c-darkgrey);
    overflow-wrap: anywhere;
    user-select: text;
  }

  @media (max-width: 600px) {
    .cite-note {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
