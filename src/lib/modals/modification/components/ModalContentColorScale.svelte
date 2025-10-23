<script lang="ts">
  import { GeneralInputColor, GeneralButtonMinor } from '$lib/shared/components'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { interpolateColor } from '$lib/shared/utils/colorUtils'
  import {
    SectionHeader,
    ModalButtons,
    modalStore,
    IntroductoryParagraph,
  } from '$lib/modals'

  interface Props {
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // Initialize colors with current values or defaults
  let colorMin = $state(settings.colorScale?.[0] || '#f7fbff')
  
  // Initialize max color - handle both 2-color and 3-color scales correctly
  let colorMax = $state(
    settings.colorScale?.length === 3 
      ? settings.colorScale[2]  // For 3-color: [min, middle, max]
      : settings.colorScale?.[1] || '#08306b'  // For 2-color: [min, max]
  )
  
  // Initialize middle color - use existing value if available, otherwise auto-calculate
  let colorMiddle = $state(
    settings.colorScale?.length === 3 
      ? settings.colorScale[1] 
      : interpolateColor(
          settings.colorScale?.[0] || '#f7fbff',
          settings.colorScale?.length === 3 ? settings.colorScale[2] : settings.colorScale?.[1] || '#08306b',
          0.5
        )
  )
  
  // Track if middle color was manually modified
  let middleColorManuallySet = $state(settings.colorScale?.length === 3)

  // Color scale presets
  const presets = [
    {
      name: 'Blue',
      colors: ['#f7fbff', '#08306b'], // Light blue to dark blue
      description: 'Classic blue gradient (default)',
    },
    {
      name: 'Green to Red',
      colors: ['#31a354', '#f7fcb9', '#a50f15'], // dark green to light yellow to dark red
      description: 'Traffic light style (low to high)',
    },
    {
      name: 'Heat',
      colors: ['#fff5eb', '#fd8d3c', '#7f0000'], // White to orange to dark red
      description: 'Heat map style',
    },
  ]

  /**
   * Auto-calculates the middle color as an interpolation between min and max colors
   * This function uses the colorUtils interpolateColor function to blend the colors
   */
  function autoCalculateMiddleColor(): void {
    colorMiddle = interpolateColor(colorMin, colorMax, 0.5)
    middleColorManuallySet = false
  }

  /**
   * Determines the final color scale based on whether middle color was manually set
   * If middle color is auto-calculated and equals the interpolated value, uses 2-color scale
   * Otherwise, uses 3-color scale
   */
  const getCurrentColorScale = (): string[] => {
    const autoCalculatedMiddle = interpolateColor(colorMin, colorMax, 0.5)
    
    // If middle color wasn't manually set or equals auto-calculated value, use 2-color scale
    if (!middleColorManuallySet || colorMiddle === autoCalculatedMiddle) {
      return [colorMin, colorMax]
    }
    
    // Otherwise use 3-color scale
    return [colorMin, colorMiddle, colorMax]
  }

  // Preview gradient style - always shows 3 colors for better preview
  const gradientStyle = $derived.by(() => {
    const autoCalculatedMiddle = interpolateColor(colorMin, colorMax, 0.5)
    const middleColor = middleColorManuallySet ? colorMiddle : autoCalculatedMiddle
    return `linear-gradient(to right, ${colorMin}, ${middleColor}, ${colorMax})`
  })

  // Handle preset selection
  function handlePresetSelect(preset: (typeof presets)[0]): void {
    colorMin = preset.colors[0]
    colorMax = preset.colors[preset.colors.length - 1]
    
    if (preset.colors.length === 3) {
      colorMiddle = preset.colors[1]
      middleColorManuallySet = true
    } else {
      autoCalculateMiddleColor()
    }
  }

  // Handle color changes
  function handleMinColorChange(event: CustomEvent<string>): void {
    colorMin = event.detail
    // Auto-update middle color if it wasn't manually set
    if (!middleColorManuallySet) {
      autoCalculateMiddleColor()
    }
  }

  function handleMiddleColorChange(event: CustomEvent<string>): void {
    colorMiddle = event.detail
    middleColorManuallySet = true
  }

  function handleMaxColorChange(event: CustomEvent<string>): void {
    colorMax = event.detail
    // Auto-update middle color if it wasn't manually set
    if (!middleColorManuallySet) {
      autoCalculateMiddleColor()
    }
  }

  // Apply changes and close modal
  function handleConfirm(): void {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: {
        colorScale: getCurrentColorScale(),
      },
    })
    modalStore.close()
  }

  // Close modal without changes
  function handleCancel(): void {
    modalStore.close()
  }
</script>

<div class="color-scale-modal">
  <IntroductoryParagraph
    maxWidth="400px"
    paragraphs={[
      'Customize the color scale for visualization. The middle color is automatically calculated from the min and max colors, but you can override it manually.',
    ]}
  />

  <section class="section">
    <SectionHeader text="Color Selection" />
    
    <div class="preview-section">
      <div class="gradient-preview" style:background={gradientStyle}></div>
    </div>

    <div class="color-inputs">
      <div class="color-input">
        <GeneralInputColor
          label="Min Value Color"
          value={colorMin}
          width={120}
          oninput={handleMinColorChange}
        />
      </div>

      <div class="color-input">
        <GeneralInputColor
          label="Mid Value Color"
          value={colorMiddle}
          width={120}
          oninput={handleMiddleColorChange}
        />
        {#if middleColorManuallySet}
          <div class="autocalculate-wrapper">
            <GeneralButtonMinor
              isIcon={false}
              onclick={() => middleColorManuallySet && autoCalculateMiddleColor()}
            >
              Auto-calculate
            </GeneralButtonMinor>
          </div>
        {/if}
      </div>

      <div class="color-input">
        <GeneralInputColor
          label="Max Value Color"
          value={colorMax}
          width={120}
          oninput={handleMaxColorChange}
        />
      </div>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Presets" />
    <div class="presets-container">
      {#each presets as preset}
        <button
          class="preset-button"
          onclick={() => handlePresetSelect(preset)}
        >
          <div class="preset-header">
            <span class="preset-name">{preset.name}</span>
          </div>
          <div
            class="preset-preview"
            style:background={preset.colors.length === 2
              ? `linear-gradient(to right, ${preset.colors[0]}, ${preset.colors[1]})`
              : `linear-gradient(to right, ${preset.colors[0]}, ${preset.colors[1]}, ${preset.colors[2]})`}
          ></div>
          <div class="preset-description">{preset.description}</div>
        </button>
      {/each}
    </div>
  </section>

  <ModalButtons
    buttons={[
      {
        label: 'Apply',
        onclick: handleConfirm,
        variant: 'primary',
      },
      {
        label: 'Cancel',
        onclick: handleCancel,
      },
    ]}
  />
</div>

<style>
  .color-scale-modal {
    padding: 1rem;
    max-width: 450px;
  }

  .section {
    margin-bottom: 1.5rem;
  }

  .color-inputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  /* Single column layout for smaller screens */
  @media (max-width: 500px) {
    .color-inputs {
      grid-template-columns: 1fr;
      max-width: 120px;
      margin: 1rem auto;
    }
  }

  .color-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Remove bottom margin from color input */
  .color-input :global(.input-container) {
    margin-bottom: 0;
  }

  .autocalculate-wrapper {
    width: 120px;
    margin-top: -12px;
  }

  .autocalculate-wrapper :global(button) {
    width: 100%;
    height: 28px;
    font-size: 0.8rem;
  }

  .preview-section {
    margin: 1.5rem 0 1rem 0;
  }

  .gradient-preview {
    height: 40px;
    border-radius: 4px;
    margin-top: 0.5rem;
    border: 1px solid #ddd;
  }

  .presets-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .preset-button {
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.5rem;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .preset-header {
    margin-bottom: 0.5rem;
  }

  .preset-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .preset-preview {
    height: 30px;
    border-radius: 3px;
    margin-bottom: 0.5rem;
  }

  .preset-description {
    font-size: 0.8rem;
    color: #666;
  }
</style>
