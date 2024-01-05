<script lang="ts">
import EmptyPlot from "$lib/components/Plot/EmptyPlot/EmptyPlot.svelte";
import ScarfPlot from "$lib/components/Plot/ScarfPlot/ScarfPlot.svelte";
import LoadPlot from "$lib/components/Plot/LoadPlot/LoadPlot.svelte";
import {processingFileStateStore} from "$lib/stores/processingFileStateStore.ts";
import {scarfPlotStates} from "$lib/stores/scarfPlotsStore.ts";
import {flip} from "svelte/animate";
import {fade} from "svelte/transition";
import type {WorkspaceFillingType} from "$lib/type/Filling/WorkspaceFilling/WorkspaceFillingType.ts";
import type {ScarfSettingsType} from "$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts";

const getUniqueId = (): number => {
    return parseInt((Date.now() + Math.random() * 100000).toFixed(0))
}

const getUtilityFilling = (type: 'load' | 'empty'): WorkspaceFillingType[] => {
    return [
        {
            id: getUniqueId(),
            content: type,
            size: 'small',
            position: 'center',
            isAlone: true
        }
    ]
}

const getLoadingFilling = (): WorkspaceFillingType[] => {
    return getUtilityFilling('load')
}

const getEmptyFilling = (): WorkspaceFillingType[] => {
    return getUtilityFilling('empty')
}

const getFillingForSingleScarfPlot = (scarfPlotSettings: ScarfSettingsType): WorkspaceFillingType => {
    return {
            id: scarfPlotSettings.scarfPlotId,
            content: scarfPlotSettings,
            size: 'medium',
            position: 'center', // 'left' | 'center' | 'right'
            isAlone: scarfPlotSettings.stimulusId === 1
        }
}

let filling: WorkspaceFillingType[] = getLoadingFilling()

$: isProcessingFile = $processingFileStateStore

$: scarfPlotState = $scarfPlotStates

$: if (scarfPlotState.length === 0) {
    if (isProcessingFile === 'done') {
        filling = getEmptyFilling()
    } else {
        filling = getLoadingFilling()
    }
} else {
    filling = scarfPlotState.map(getFillingForSingleScarfPlot)
}
</script>

<div class="workspace-wrapper">
    <div class="workspace">
        {#each filling as fillingItem (fillingItem.id)}
            <div
                    class="workspace__item"
                    class:isSmall={fillingItem.size === 'small'}
                    class:isLarge={fillingItem.size === 'large'}
                    class:isMedium={fillingItem.size === 'medium'}
                    class:isAlone={fillingItem.isAlone}
                    class:center={fillingItem.position === 'center'}
                    class:left={fillingItem.position === 'left'}
                    class:right={fillingItem.position === 'right'}
                    animate:flip={{duration:500}}
                    transition:fade={{duration:300}}
            >
                    {#if fillingItem.content === 'load'}
                        <LoadPlot/>
                    {:else if fillingItem.content === 'empty'}
                        <EmptyPlot/>
                    {:else}
                        <ScarfPlot scarfPlotId={fillingItem.content.scarfPlotId}
                        />
                    {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .workspace-wrapper {
        width: 100%;
        overflow: auto;
        background-color: var(--c-darkwhite);
        background-image: linear-gradient(var(--c-lightgrey) 1px, transparent 1px), linear-gradient(90deg, var(--c-lightgrey) 1px, transparent 1px);
        background-size: 30px 30px;
        box-shadow: inset 0 2px 10px rgb(0 0 0 / 15%);
    }

    .workspace {
        display: grid;
        margin: auto;
        padding: 80px 16px;
        transition: height 0.5s ease;
        overflow: hidden;
        min-width: 740px;
        max-width: 2200px;
        gap: 20px;
        grid-template-columns: repeat(12, 1fr);
    }

    :root {
        --span-small: 4;
        --span-medium: 6;
        --span-large: 12;
    }

    .workspace__item {
        display: grid;
    }

    .isAlone {
        grid-column: 1 / -1;
    }

    .isSmall {
        grid-column: span var(--span-small);
    }

    .isMedium {
        grid-column: span var(--span-medium);
    }

    .isLarge {
        grid-column: span var(--span-large);
    }

    .isSmall.center {
        grid-column-start: calc((var(--span-large) - var(--span-small)) / 2 + 1);
        grid-column-end: calc((var(--span-large) - var(--span-small)) / 2 + var(--span-small) + 1);
    }

    .isSmall.left {
        grid-column-start: 1;
        grid-column-end: calc(var(--span-small) + 1);
    }

    .isSmall.right {
        grid-column-start: calc(var(--span-large) - var(--span-small) + 1);
        grid-column-end: calc(var(--span-large) + 1);
    }

    .isMedium.center {
        grid-column-start: calc((var(--span-large) - var(--span-medium)) / 2 + 1);
        grid-column-end: calc((var(--span-large) - var(--span-medium)) / 2 + var(--span-medium) + 1);
    }

    .isMedium.left {
        grid-column-start: 1;
        grid-column-end: calc(var(--span-medium) + 1);
    }

    .isMedium.right {
        grid-column-start: calc(var(--span-large) - var(--span-medium) + 1);
        grid-column-end: calc(var(--span-large) + 1);
    }

    @media screen and (max-width: 1540px) {
        :root {
            --span-small: 4;
            --span-medium: 8;
            --span-large: 12;
        }
    }

    @media screen and (max-width: 1200px) {
        :root {
            --span-small: 6;
            --span-medium: 10;
            --span-large: 12;
        }
    }

    @media screen and (max-width: 920px) {
        :root {
            --span-small: 8;
            --span-medium: 12;
            --span-large: 12;
        }
    }

</style>