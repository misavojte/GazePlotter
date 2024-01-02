/// <reference types="svelte" />
import type { ScarfSettingsType } from '../../type/Settings/ScarfSettings/ScarfSettingsType.ts';
export declare const scarfPlotStates: import("svelte/store").Writable<ScarfSettingsType[]>;
export declare const removeScarfPlotState: (scarfPlotId: number) => void;
export declare const getScarfPlotState: (scarfStates: ScarfSettingsType[], scarfPlotId: number) => ScarfSettingsType | undefined;
export declare const getStimulusId: (scarfPlotId: number) => number;
export declare const getStimulusLastValue: (scarfPlotId: number, stimulusId: number, type: 'absolute' | 'ordinal') => number;
export declare const updateTimeline: (scarfPlotId: number, timeline: 'absolute' | 'relative' | 'ordinal') => void;
export declare const updateStimulusId: (scarfPlotId: number, stimulusId: number) => void;
export declare const updateZoom: (scarfPlotId: number, zoom: number) => void;
export declare const updateStimulusLastValue: (scarfPlotId: number, stimulusId: number, lastValue: number, type: 'absolute' | 'ordinal') => void;
export declare const duplicateScarfPlotState: (scarfPlotId: number) => void;
export declare const updateAoiVisibilityForAll: (value: boolean) => void;
export declare const setDefaultScarfPlotState: () => void;
