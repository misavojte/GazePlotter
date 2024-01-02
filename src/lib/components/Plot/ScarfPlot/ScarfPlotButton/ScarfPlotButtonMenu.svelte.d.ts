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
export type ScarfPlotButtonMenuProps = typeof __propDef.props;
export type ScarfPlotButtonMenuEvents = typeof __propDef.events;
export type ScarfPlotButtonMenuSlots = typeof __propDef.slots;
export default class ScarfPlotButtonMenu extends SvelteComponent<ScarfPlotButtonMenuProps, ScarfPlotButtonMenuEvents, ScarfPlotButtonMenuSlots> {
}
export {};
