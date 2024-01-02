import { SvelteComponent } from "svelte";
import type { SingleStylingScarfFillingType } from '../../../../type/Filling/ScarfFilling/StylingScarfFilling/SingleStylingScarfFillingType';
declare const __propDef: {
    props: {
        fillings: SingleStylingScarfFillingType[];
        title: string;
        isVisibility?: boolean | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotLegendGroupProps = typeof __propDef.props;
export type ScarfPlotLegendGroupEvents = typeof __propDef.events;
export type ScarfPlotLegendGroupSlots = typeof __propDef.slots;
export default class ScarfPlotLegendGroup extends SvelteComponent<ScarfPlotLegendGroupProps, ScarfPlotLegendGroupEvents, ScarfPlotLegendGroupSlots> {
}
export {};
