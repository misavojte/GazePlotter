import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        click: MouseEvent;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {};
    };
};
export type GeneralButtonMajorProps = typeof __propDef.props;
export type GeneralButtonMajorEvents = typeof __propDef.events;
export type GeneralButtonMajorSlots = typeof __propDef.slots;
export default class GeneralButtonMajor extends SvelteComponent<GeneralButtonMajorProps, GeneralButtonMajorEvents, GeneralButtonMajorSlots> {
}
export {};
