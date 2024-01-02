import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        value?: string | undefined;
        legend: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralInputTextProps = typeof __propDef.props;
export type GeneralInputTextEvents = typeof __propDef.events;
export type GeneralInputTextSlots = typeof __propDef.slots;
export default class GeneralInputText extends SvelteComponent<GeneralInputTextProps, GeneralInputTextEvents, GeneralInputTextSlots> {
}
export {};
