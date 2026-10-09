<script lang="ts">
  import { base } from '$app/paths'
  import { onMount } from 'svelte'

  // Old ETVIS links open the ETVIS dataset in the app itself. A full load,
  // not goto(): the app reads `?dataUrl=` from the address bar at init.
  const target = `${base}/?dataUrl=${encodeURIComponent(`${base}/data/etvis26.json`)}`

  onMount(() => window.location.replace(target))
</script>

<svelte:head>
  <title>GazePlotter</title>
  <meta http-equiv="refresh" content={`0; url=${target}`} />
  <link rel="canonical" href="https://gazeplotter.com/" />
</svelte:head>
