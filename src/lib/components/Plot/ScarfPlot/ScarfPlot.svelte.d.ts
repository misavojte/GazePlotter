import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        scarfPlotId: number;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotProps = typeof __propDef.props;
export type ScarfPlotEvents = typeof __propDef.events;
export type ScarfPlotSlots = typeof __propDef.slots;
export default class ScarfPlot extends SvelteComponent<ScarfPlotProps, ScarfPlotEvents, ScarfPlotSlots> {
}
export {};
