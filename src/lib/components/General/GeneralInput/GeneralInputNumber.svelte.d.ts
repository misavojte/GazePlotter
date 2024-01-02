import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        value?: number | undefined;
        min?: number | undefined;
        legend: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralInputNumberProps = typeof __propDef.props;
export type GeneralInputNumberEvents = typeof __propDef.events;
export type GeneralInputNumberSlots = typeof __propDef.slots;
export default class GeneralInputNumber extends SvelteComponent<GeneralInputNumberProps, GeneralInputNumberEvents, GeneralInputNumberSlots> {
}
export {};
