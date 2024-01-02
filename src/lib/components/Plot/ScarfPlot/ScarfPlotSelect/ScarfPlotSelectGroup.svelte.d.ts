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
export type ScarfPlotSelectGroupProps = typeof __propDef.props;
export type ScarfPlotSelectGroupEvents = typeof __propDef.events;
export type ScarfPlotSelectGroupSlots = typeof __propDef.slots;
export default class ScarfPlotSelectGroup extends SvelteComponent<ScarfPlotSelectGroupProps, ScarfPlotSelectGroupEvents, ScarfPlotSelectGroupSlots> {
}
export {};
