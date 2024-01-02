import { SvelteComponent } from "svelte";
import type { SingleStylingScarfFillingType } from '../../../../type/Filling/ScarfFilling';
declare const __propDef: {
    props: {
        legend: SingleStylingScarfFillingType;
        isVisibility?: boolean | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotLegendItemProps = typeof __propDef.props;
export type ScarfPlotLegendItemEvents = typeof __propDef.events;
export type ScarfPlotLegendItemSlots = typeof __propDef.slots;
export default class ScarfPlotLegendItem extends SvelteComponent<ScarfPlotLegendItemProps, ScarfPlotLegendItemEvents, ScarfPlotLegendItemSlots> {
}
export {};
