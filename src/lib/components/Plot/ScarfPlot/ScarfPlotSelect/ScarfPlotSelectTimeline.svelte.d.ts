import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        scarfId: number;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotSelectTimelineProps = typeof __propDef.props;
export type ScarfPlotSelectTimelineEvents = typeof __propDef.events;
export type ScarfPlotSelectTimelineSlots = typeof __propDef.slots;
export default class ScarfPlotSelectTimeline extends SvelteComponent<ScarfPlotSelectTimelineProps, ScarfPlotSelectTimelineEvents, ScarfPlotSelectTimelineSlots> {
}
export {};
