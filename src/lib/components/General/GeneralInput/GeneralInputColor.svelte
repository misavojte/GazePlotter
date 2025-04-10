<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  import { getContrastTextColor, isDarkColor } from '$lib/utils/colorUtils'
  import { tick } from 'svelte'
  import { fade } from 'svelte/transition'

  /**
   * Color picker input component
   * A customizable color picker with HSV model that renders a color value
   * Supports hex, RGB and RGBA color formats
   */

  interface Props {
    value?: string
    label: string
    width?: number
    oninput?: (event: CustomEvent<string>) => void
  }

  let {
    value = $bindable('#000000'),
    label,
    width = $bindable(140),
    oninput = () => {},
  }: Props = $props()

  // Ensure minimum width constraint is met
  const actualWidth = $derived(Math.max(35, width))

  // Determine if there's enough space to display the hex code
  const showHexCode = $derived(actualWidth >= 100)

  // State for color picker popup
  let isOpen = $state(false)
  let inputValue = $state('')
  let triggerElement: HTMLButtonElement | null = $state(null)
  let popupElement: HTMLDivElement | null = $state(null)

  // State for popup positioning
  let popupPosition = $state({ top: 0, left: 0 })

  // State for HSV model (this better matches the visual color picker)
  let hue = $state(0)
  let saturationHsv = $state(100)
  let valueHsv = $state(100)

  // Create a portal for the color popup with click-outside behavior
  const portal = (node: HTMLElement) => {
    // Move the node to the body
    document.body.appendChild(node)

    // Setup click outside listener
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click was outside the popup and not on the trigger button
      if (
        node &&
        !node.contains(event.target as Node) &&
        triggerElement !== event.target &&
        !triggerElement?.contains(event.target as Node)
      ) {
        isOpen = false
      }
    }

    // Add listener with a small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    // Return destroy function for cleanup
    return {
      destroy() {
        document.removeEventListener('mousedown', handleClickOutside)
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      },
    }
  }

  // Calculate position for the popup - only once when opening
  const calculatePopupPosition = async () => {
    if (!triggerElement) return

    // Wait for DOM update
    await tick()

    const triggerRect = triggerElement.getBoundingClientRect()

    // Calculate position relative to viewport (for fixed positioning)
    let top = triggerRect.bottom + 5
    let left = triggerRect.left

    // Check if popup would go off the right edge
    if (popupElement) {
      const popupWidth = popupElement.offsetWidth
      if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10
      }

      // Check if popup would go off the bottom edge
      const popupHeight = popupElement.offsetHeight
      if (top + popupHeight > window.innerHeight - 10) {
        // Position above the trigger if it would go off the bottom
        top = Math.max(10, triggerRect.top - popupHeight - 5)
      }
    }

    popupPosition = { top, left }
  }

  // Calculate derived RGB from HSL
  const hslToRgb = (
    h: number,
    s: number,
    l: number
  ): { r: number; g: number; b: number } => {
    // Ensure values are in the correct range
    h = Math.max(0, Math.min(360, h))
    s = Math.max(0, Math.min(100, s)) / 100
    l = Math.max(0, Math.min(100, l)) / 100

    if (s === 0) {
      // Achromatic (gray)
      const v = Math.round(l * 255)
      return { r: v, g: v, b: v }
    }

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2

    let r = 0,
      g = 0,
      b = 0

    if (0 <= h && h < 60) {
      r = c
      g = x
      b = 0
    } else if (60 <= h && h < 120) {
      r = x
      g = c
      b = 0
    } else if (120 <= h && h < 180) {
      r = 0
      g = c
      b = x
    } else if (180 <= h && h < 240) {
      r = 0
      g = x
      b = c
    } else if (240 <= h && h < 300) {
      r = x
      g = 0
      b = c
    } else if (300 <= h && h < 360) {
      r = c
      g = 0
      b = x
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    }
  }

  // Calculate RGB to HSL
  const rgbToHsl = (
    r: number,
    g: number,
    b: number
  ): { h: number; s: number; l: number } => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min

    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }

      h *= 60
    }

    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    }
  }

  // Color format detection and conversion functions
  const detectColorFormat = (
    color: string
  ): 'hex' | 'rgb' | 'rgba' | 'invalid' => {
    if (!color) return 'invalid'

    // Trim whitespace
    const trimmed = color.trim()

    // Check for hex format (with or without #)
    if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) {
      return 'hex'
    }

    // Check for rgb format
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(trimmed)) {
      return 'rgb'
    }

    // Check for rgba format
    if (
      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([01]|0?\.\d+)\s*\)$/.test(
        trimmed
      )
    ) {
      return 'rgba'
    }

    return 'invalid'
  }

  const hexToRgb = (
    hex: string
  ): { r: number; g: number; b: number; a: number } => {
    // Remove # if present
    hex = hex.replace(/^#/, '')

    // Expand shorthand form (e.g., "03F") to full form (e.g., "0033FF")
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }

    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    return { r, g, b, a: 1 }
  }

  const rgbToHex = (r: number, g: number, b: number): string => {
    return (
      '#' +
      [r, g, b]
        .map(x => {
          const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16)
          return hex.length === 1 ? '0' + hex : hex
        })
        .join('')
    )
  }

  const parseRgb = (
    rgb: string
  ): { r: number; g: number; b: number; a: number } | null => {
    const rgbRegex = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/
    const match = rgb.match(rgbRegex)

    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: 1,
      }
    }

    return null
  }

  const parseRgba = (
    rgba: string
  ): { r: number; g: number; b: number; a: number } | null => {
    const rgbaRegex =
      /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([01]|0?\.\d+)\s*\)/
    const match = rgba.match(rgbaRegex)

    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: parseFloat(match[4]),
      }
    }

    return null
  }

  // Convert any valid color to hex
  const convertToHex = (color: string): string => {
    const format = detectColorFormat(color)

    switch (format) {
      case 'hex': {
        let hex = color.replace(/^#/, '')
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        }
        return '#' + hex
      }
      case 'rgb': {
        const rgb = parseRgb(color)
        if (rgb) {
          return rgbToHex(rgb.r, rgb.g, rgb.b)
        }
        break
      }
      case 'rgba': {
        const rgba = parseRgba(color)
        if (rgba) {
          return rgbToHex(rgba.r, rgba.g, rgba.b)
        }
        break
      }
    }

    return value
  }

  /**
   * Converts HSV (Hue, Saturation, Value) to HSL (Hue, Saturation, Lightness)
   * This is needed because the visual picker uses HSV model but we output HSL colors
   */
  const hsvToHsl = (
    h: number,
    s: number,
    v: number
  ): { h: number; s: number; l: number } => {
    // Convert HSV to HSL
    // H stays the same in both models
    // Input s and v are 0-100
    s = s / 100
    v = v / 100

    const l = v * (1 - s / 2)
    const newS = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)

    return {
      h,
      s: Math.round(newS * 100),
      l: Math.round(l * 100),
    }
  }

  /**
   * Converts HSL (Hue, Saturation, Lightness) to HSV (Hue, Saturation, Value)
   * Used when loading a color to position the picker correctly
   */
  const hslToHsv = (
    h: number,
    s: number,
    l: number
  ): { h: number; s: number; v: number } => {
    // Convert HSL to HSV
    // H stays the same in both models
    // Input s and l are 0-100
    s = s / 100
    l = l / 100

    const v = l + s * Math.min(l, 1 - l)
    const newS = v === 0 ? 0 : 2 * (1 - l / v)

    return {
      h,
      s: Math.round(newS * 100),
      v: Math.round(v * 100),
    }
  }

  // Update HSV values from hex
  const updateHsvFromHex = (hexColor: string) => {
    const rgb = hexToRgb(hexColor)
    const hslValues = rgbToHsl(rgb.r, rgb.g, rgb.b)
    const hsvValues = hslToHsv(hslValues.h, hslValues.s, hslValues.l)

    hue = hsvValues.h
    saturationHsv = hsvValues.s
    valueHsv = hsvValues.v
  }

  // Update color from HSV
  const updateColorFromHsv = () => {
    const hslValues = hsvToHsl(hue, saturationHsv, valueHsv)
    const rgb = hslToRgb(hslValues.h, hslValues.s, hslValues.l)
    const hexValue = rgbToHex(rgb.r, rgb.g, rgb.b)

    value = hexValue
    inputValue = hexValue
    oninput(new CustomEvent('input', { detail: hexValue }))
  }

  // Handle saturation/value (brightness) change in HSV model
  const handleSatValueChange = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement
    const rect = target.getBoundingClientRect()

    // X maps directly to saturation (0-100%)
    saturationHsv = Math.max(
      0,
      Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100))
    )

    // Y maps inversely to value/brightness (100-0%)
    valueHsv = Math.max(
      0,
      Math.min(
        100,
        Math.round(100 - ((e.clientY - rect.top) / rect.height) * 100)
      )
    )

    updateColorFromHsv()
  }

  // Toggle color picker
  const toggleColorPicker = async () => {
    isOpen = !isOpen
    if (isOpen) {
      inputValue = value
      updateHsvFromHex(value)

      // Calculate position once when opening
      await calculatePopupPosition()
    }
  }

  // Handle palette color selection
  const selectPaletteColor = (paletteColor: string) => {
    value = paletteColor
    inputValue = paletteColor
    updateHsvFromHex(paletteColor)
    oninput(new CustomEvent('input', { detail: paletteColor }))
  }

  // Handle manual text input
  const handleTextInput = (e: Event) => {
    const input = e.target as HTMLInputElement
    inputValue = input.value

    const format = detectColorFormat(inputValue)
    if (format !== 'invalid') {
      const hexValue = convertToHex(inputValue)
      value = hexValue
      updateHsvFromHex(hexValue)
      oninput(new CustomEvent('input', { detail: hexValue }))
    }
  }

  // Handle hue change
  const handleHueChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    hue = parseInt(input.value, 10)
    updateColorFromHsv()
  }

  // Calculate the position of the saturation-value selector
  const selectorPosition = $derived({
    left: `${saturationHsv}%`,
    top: `${100 - valueHsv}%`,
  })

  // Format color value for display - return a string not a function
  const formatColorValue = $derived(
    detectColorFormat(value) === 'invalid' ? '#000000' : value
  )

  // Calculate current color in HSL format for the saturation-lightness picker background
  const hueColor = $derived(`hsl(${hue}, 100%, 50%)`)

  // Calculate contrast text color for better readability
  const contrastTextColor = $derived(getContrastTextColor(formatColorValue))

  // Calculate whether the selected color is dark (for UI adjustments)
  const isColorDark = $derived(isDarkColor(formatColorValue))

  // Calculate selector border color based on background
  const selectorBorderColor = $derived(isColorDark ? 'white' : 'black')

  // Scientific color pallete (12 colors, more pastel like)
  const scientificColorPalette = [
    '#FFB6C1', // Light pink
    '#87CEEB', // Light blue
    '#98FB98', // Pale green
    '#DDA0DD', // Light purple
    '#F0E68C', // Pale yellow
    '#E6E6FA', // Light lavender
    '#F0FFF0', // Honeydew
    '#F0FFFF', // Azure
    '#F5F5DC', // Beige
    '#F5F5F5', // Light gray
    '#D8BFD8', // Thistle
    '#E0FFFF', // Light cyan
  ]

  const id = `color-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <div class="color-input-container">
    <button
      type="button"
      class="color-preview"
      onclick={toggleColorPicker}
      style:background-color={formatColorValue}
      style:width="{actualWidth}px"
      bind:this={triggerElement}
    >
      {#if showHexCode}
        <span class="color-value" style:color={contrastTextColor}>
          {formatColorValue}
        </span>
      {/if}
    </button>

    {#if isOpen}
      <div
        use:portal
        class="color-popup"
        style:position="fixed"
        style:top="{popupPosition.top}px"
        style:left="{popupPosition.left}px"
        bind:this={popupElement}
        in:fade={{ duration: 100 }}
        out:fade={{ duration: 100 }}
      >
        <div class="color-picker-container">
          <!-- Saturation/Value (HSV) picker -->
          <div
            class="sat-light-picker"
            style:background-color={hueColor}
            onmousedown={handleSatValueChange}
            onmousemove={e => e.buttons && handleSatValueChange(e)}
          >
            <div
              class="sat-light-selector"
              style:left={selectorPosition.left}
              style:top={selectorPosition.top}
              style:background-color={formatColorValue}
              style:border-color={selectorBorderColor}
            ></div>
          </div>

          <!-- Hue slider -->
          <div class="hue-slider-container">
            <input
              type="range"
              min="0"
              max="360"
              class="hue-slider"
              value={hue}
              oninput={handleHueChange}
            />
          </div>

          <!-- Color preview with integrated text input -->
          <div
            class="color-preview-container"
            style:background-color={formatColorValue}
          >
            <input
              type="text"
              class="color-text-input"
              value={inputValue}
              oninput={handleTextInput}
              style:color={contrastTextColor}
              style:border-bottom-color={contrastTextColor}
            />
          </div>

          <!-- Quick color palette for common selections -->
          <div class="color-palette">
            {#each scientificColorPalette as paletteColor}
              <button
                type="button"
                class="palette-color"
                style:background-color={paletteColor}
                onclick={() => selectPaletteColor(paletteColor)}
                aria-label={`Select color ${paletteColor}`}
              ></button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</GeneralInputScaffold>

<style>
  .color-input-container {
    position: relative;
  }

  .color-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.5rem;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    font-size: 14px;
    height: 34px;
    cursor: pointer;
    background-color: white;
    transition: all 0.2s;
  }

  .color-preview:hover {
    border-color: #666;
  }

  .color-value {
    font-family: monospace;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    flex-grow: 1;
  }

  .color-popup {
    padding: 12px;
    background-color: white;
    border-radius: var(--rounded);
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    width: 220px;
    overflow-y: auto;
    max-height: 90vh;
  }

  .sat-light-picker {
    position: relative;
    width: 100%;
    height: 150px;
    border-radius: 4px;
    cursor: crosshair;
    background-image: linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent);
    margin-bottom: 10px;
  }

  .sat-light-selector {
    position: absolute;
    width: 12px;
    height: 12px;
    transform: translate(-50%, -50%);
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }

  .hue-slider-container {
    margin-bottom: 10px;
  }

  .hue-slider {
    width: 100%;
    height: 20px;
    -webkit-appearance: none;
    appearance: none;
    border-radius: 4px;
    background: linear-gradient(
      to right,
      #f00 0%,
      #ff0 17%,
      #0f0 33%,
      #0ff 50%,
      #00f 67%,
      #f0f 83%,
      #f00 100%
    );
    outline: none;
    cursor: pointer;
  }

  .hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 24px;
    border-radius: 3px;
    background: white;
    border: 1px solid #ccc;
    cursor: pointer;
  }

  .hue-slider::-moz-range-thumb {
    width: 12px;
    height: 24px;
    border-radius: 3px;
    background: white;
    border: 1px solid #ccc;
    cursor: pointer;
  }

  /* Color preview with integrated text input */
  .color-preview-container {
    width: 100%;
    height: 40px;
    border-radius: 4px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-text-input {
    width: 90%;
    height: 70%;
    border: none;
    background: transparent;
    text-align: center;
    font-family: monospace;
    font-size: 15px;
    font-weight: 500;
    color: inherit;
    outline: none;
    border-bottom: 1.5px dotted;
    border-bottom-color: rgba(255, 255, 255, 0.7);
  }

  .color-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: space-between;
  }

  .palette-color {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 1px solid var(--c-darkgrey);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s ease-in-out;
  }

  .palette-color:hover {
    transform: scale(1.1);
  }
</style>
