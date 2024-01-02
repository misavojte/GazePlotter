import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        x: number;
        y: number;
        width: number;
        stimulusId: number;
        participantId: number;
        segmentId: number;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotTooltipProps = typeof __propDef.props;
export type ScarfPlotTooltipEvents = typeof __propDef.events;
export type ScarfPlotTooltipSlots = typeof __propDef.slots;
export default class ScarfPlotTooltip extends SvelteComponent<ScarfPlotTooltipProps, ScarfPlotTooltipEvents, ScarfPlotTooltipSlots> {
}
export {};
