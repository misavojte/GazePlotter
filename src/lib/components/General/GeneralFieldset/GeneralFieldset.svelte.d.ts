import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        legend: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {};
    };
};
export type GeneralFieldsetProps = typeof __propDef.props;
export type GeneralFieldsetEvents = typeof __propDef.events;
export type GeneralFieldsetSlots = typeof __propDef.slots;
export default class GeneralFieldset extends SvelteComponent<GeneralFieldsetProps, GeneralFieldsetEvents, GeneralFieldsetSlots> {
}
export {};
