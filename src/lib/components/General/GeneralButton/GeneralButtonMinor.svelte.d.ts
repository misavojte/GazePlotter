import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        isDisabled?: boolean | undefined;
        marginTop?: string | undefined;
    };
    events: {
        click: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {};
    };
};
export type GeneralButtonMinorProps = typeof __propDef.props;
export type GeneralButtonMinorEvents = typeof __propDef.events;
export type GeneralButtonMinorSlots = typeof __propDef.slots;
export default class GeneralButtonMinor extends SvelteComponent<GeneralButtonMinorProps, GeneralButtonMinorEvents, GeneralButtonMinorSlots> {
}
export {};
