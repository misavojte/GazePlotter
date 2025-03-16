<script lang="ts">

    let { width, y, height, aoiColors = [], aoiColorsOpacity = 1 } = $props<{
        width: number;
        y: number;
        height: number;
        aoiColors?: Array<{ aoi: string; color: string }>;
        aoiColorsOpacity?: number;
    }>();

    // Add new constants for AOI legend
    const AOI_LEGEND_START_Y = 30;
    const AOI_LEGEND_CIRCLE_RADIUS = 4;
    const AOI_LEGEND_TEXT_OFFSET = 10;
    const AOI_LEGEND_LINE_HEIGHT = 20;
    const AOI_LEGEND_MAX_WIDTH = width - 20;
    const CHAR_WIDTH = 7;  // Estimated width per character in pixels
    const BASE_ITEM_WIDTH = 25;  // Width needed for circle and padding

    // Calculate dynamic item width based on longest AOI name
    let ITEM_WIDTH = $derived.by(() => {
        const maxLabelLength = Math.max(...aoiColors.map((item: { aoi: string; color: string }) => item.aoi.length));
        const estimatedWidth = BASE_ITEM_WIDTH + (maxLabelLength * CHAR_WIDTH);
        return Math.min(estimatedWidth, 150);  // Cap at 150px
    });

    const ITEMS_PER_ROW = $derived.by(() => Math.floor(AOI_LEGEND_MAX_WIDTH / ITEM_WIDTH));

    // Calculate positions for AOI legend items
    let aoiLegendItems = $derived.by(() => {
        const itemWidth = ITEM_WIDTH;
        const totalWidth = Math.min(aoiColors.length, ITEMS_PER_ROW) * itemWidth;
        const startX = width / 2 - totalWidth / 2;
        
        return aoiColors.map((item: { aoi: string; color: string }, index: number) => {
            const row = Math.floor(index / ITEMS_PER_ROW);
            const col = index % ITEMS_PER_ROW;
            
            return {
                ...item,
                x: startX + (col * itemWidth),
                y: AOI_LEGEND_START_Y + (row * AOI_LEGEND_LINE_HEIGHT)
            };
        });
    });
</script>

<svg x={0} y={y} width={width} height={height}>
    
    <text x={width/2} y={10} text-anchor="middle" dominant-baseline="middle" font-size="12px" fill="black">
        each dot equals fixation, color represents AOI:
    </text>


    {#each aoiLegendItems as item}
        <g>
            <circle 
                cx={item.x}
                cy={item.y}
                r={AOI_LEGEND_CIRCLE_RADIUS}
                fill={item.color}
                fill-opacity={aoiColorsOpacity}
            />
            <text
                x={item.x + AOI_LEGEND_TEXT_OFFSET}
                y={item.y}
                text-anchor="start"
                dominant-baseline="middle"
                font-size="10px"
                fill="black"
            >
                {item.aoi}
            </text>
        </g>
    {/each}
</svg> 