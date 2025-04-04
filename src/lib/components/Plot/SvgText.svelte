<script lang="ts">
  // Note: This component can be used with textUtils for text width calculation
  // when accurate positioning is needed. The textUtils utility provides functions
  // to estimate text dimensions before rendering.

  interface Props {
    text: string
    x: number
    y: number
    fontSize?: number | string
    textAnchor?: 'start' | 'middle' | 'end'
    dominantBaseline?:
      | 'auto'
      | 'middle'
      | 'central'
      | 'hanging'
      | 'text-before-edge'
      | 'text-after-edge'
      | 'ideographic'
      | 'alphabetic'
      | 'mathematical'
    fill?: string
    fontWeight?: string | number
    className?: string
    truncate?: boolean
    maxLength?: number
    transform?: string
  }

  let {
    text,
    x,
    y,
    fontSize = 12,
    textAnchor = 'start',
    dominantBaseline = 'auto',
    fill = 'currentColor',
    fontWeight = 'normal',
    className = '',
    truncate = false,
    maxLength = 10,
    transform = '',
  }: Props = $props()

  // Function to truncate text if needed
  const displayText = $derived(
    truncate && text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text
  )
</script>

<text
  {x}
  {y}
  font-size={fontSize}
  text-anchor={textAnchor}
  dominant-baseline={dominantBaseline}
  {fill}
  font-weight={fontWeight}
  class={className}
  {transform}
>
  {displayText}
</text>

<style>
  text {
    font-family: sans-serif;
  }
</style>
