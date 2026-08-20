<script lang="ts">
  import {
    TOKEN_CSS,
    cssColorVar,
    type GazePlotterColors,
  } from '$lib/designTokens'

  // Rendered into <head> so any host is styled with zero setup (no CSS
  // import, no bundler asset handling, SSR included). Duplicate instances
  // render identical tags; harmless.
  interface Props {
    /** Palette overrides; applied reactively, so hosts can theme live. */
    colors?: GazePlotterColors
  }

  const { colors }: Props = $props()

  // Overrides go through CSSOM, never string-interpolated markup: a hostile
  // value cannot escape setProperty, so no sanitizer is needed. On shared
  // keys the last mounted instance wins; cleanup restores the defaults.
  $effect(() => {
    const style = document.documentElement.style
    const entries = Object.entries(colors ?? {}) as [
      keyof GazePlotterColors,
      string,
    ][]
    for (const [key, value] of entries) {
      style.setProperty(cssColorVar(key), value)
    }
    return () => {
      for (const [key] of entries) style.removeProperty(cssColorVar(key))
    }
  })

  // {@html} because Svelte does not allow a literal <style> element in
  // markup; the string is a compile-time constant.
  const tokenStyle = `<style>${TOKEN_CSS}</style>`
</script>

<svelte:head>
  {@html tokenStyle}
</svelte:head>
