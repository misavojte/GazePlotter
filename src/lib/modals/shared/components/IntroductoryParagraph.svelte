<script lang="ts">
  interface Props {
    paragraphs: string[]
    maxWidth?: string
  }

  let { paragraphs, maxWidth = '100%' }: Props = $props()

  // Simple markdown parser for basic formatting
  function parseMarkdown(text: string): string {
    return (
      text
        // Bold text **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic text *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Code `code`
        .replace(/`(.*?)`/g, '<code>$1</code>')
    )
  }
</script>

<div class="content" style="max-width: {maxWidth}">
  {#each paragraphs as paragraph}
    <p class="purpose-description">
      {@html parseMarkdown(paragraph)}
    </p>
  {/each}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .purpose-description {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .purpose-description :global(strong) {
    color: #333;
    font-weight: 600;
  }

  .purpose-description :global(em) {
    font-style: italic;
  }

  .purpose-description :global(code) {
    background-color: #f5f5f5;
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875em;
  }
</style>
