<script lang="ts">
  interface Props {
    progress: {
      position: number
      total: number
      name: string
    } | null
  }

  let { progress }: Props = $props()
</script>

{#if progress}
  <div class="export-progress" role="status">
    <div class="progress-track">
      <div
        class="progress-fill"
        style="width: {(progress.position / progress.total) * 100}%"
      ></div>
    </div>
    <span class="progress-text">
      {progress.name} · {progress.position} of {progress.total}
    </span>
  </div>
{/if}

<style>
  .export-progress {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 1rem;
  }

  .progress-track {
    height: 4px;
    border-radius: 2px;
    background-color: var(--c-lightgrey);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background-color: var(--c-brand);
    transition: width var(--transition-normal) ease;
  }

  .progress-text {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
  }
</style>
