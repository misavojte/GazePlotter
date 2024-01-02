import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PanelButtonUploadProps = typeof __propDef.props;
export type PanelButtonUploadEvents = typeof __propDef.events;
export type PanelButtonUploadSlots = typeof __propDef.slots;
export default class PanelButtonUpload extends SvelteComponent<PanelButtonUploadProps, PanelButtonUploadEvents, PanelButtonUploadSlots> {
}
export {};
