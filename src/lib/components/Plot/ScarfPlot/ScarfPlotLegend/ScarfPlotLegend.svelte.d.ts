import { SvelteComponent } from "svelte";
import type { StylingScarfFillingType } from '../../../../type/Filling/ScarfFilling';
declare const __propDef: {
    props: {
        filling: StylingScarfFillingType;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotLegendProps = typeof __propDef.props;
export type ScarfPlotLegendEvents = typeof __propDef.events;
export type ScarfPlotLegendSlots = typeof __propDef.slots;
export default class ScarfPlotLegend extends SvelteComponent<ScarfPlotLegendProps, ScarfPlotLegendEvents, ScarfPlotLegendSlots> {
}
export {};
