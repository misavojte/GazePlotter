<script lang="ts">
  import GeneralButtonMajor from './GeneralButtonMajor.svelte'

  /**
   * A simple informational callout component to provide helpful tips and explanations
   */
  interface ButtonProps {
    label: string
    url: string
    noopener?: boolean
  }

  interface Props {
    maxWidth?: string
    title?: string
    paragraphs?: string[]
    button?: ButtonProps | null
  }

  let {
    maxWidth = 'auto',
    title = 'Information',
    paragraphs = [],
    button = null,
  }: Props = $props()
</script>

<div class="info-callout" style="max-width: {maxWidth}">
  <div class="header">
    <div class="icon">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 16V12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 8H12.01"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="title">{title}</div>
  </div>
  <div class="message">
    {#each paragraphs as paragraph}
      <p>{paragraph}</p>
    {/each}
  </div>
  {#if button}
    <div class="button-container">
      <GeneralButtonMajor
        type="link"
        href={button.url}
        noopener={button.noopener}
        variant="info"
        size="sm"
      >
        {button.label}
      </GeneralButtonMajor>
    </div>
  {/if}
</div>

<style>
  .info-callout {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    background-color: rgba(0, 127, 255, 0.08);
    border-left: 3px solid rgba(0, 127, 255, 0.5);
    border-radius: 4px;
    margin: 0.75rem 0;
    font-size: 0.9rem;
    color: #444;
    line-height: 1.4;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon {
    color: rgba(0, 127, 255, 0.7);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .title {
    font-weight: 600;
    color: rgba(0, 127, 255, 0.9);
    font-size: 0.95rem;
  }

  .message p {
    margin: 0;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
    text-align: left;
  }

  .button-container {
    margin-top: 0.5rem;
    text-align: left;
  }
</style>
