import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        legend: string | null;
        id: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {
            itemtype: string;
        };
    };
};
export type GeneralInputScaffoldProps = typeof __propDef.props;
export type GeneralInputScaffoldEvents = typeof __propDef.events;
export type GeneralInputScaffoldSlots = typeof __propDef.slots;
export default class GeneralInputScaffold extends SvelteComponent<GeneralInputScaffoldProps, GeneralInputScaffoldEvents, GeneralInputScaffoldSlots> {
}
export {};
