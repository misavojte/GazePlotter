import type { ScarfSettingsType } from '../../../type/Settings/ScarfSettings/ScarfSettingsType.ts';
import { PlotAxisBreaks } from '../PlotAxisBreaks/PlotAxisBreaks.ts';
export declare class ScarfPlotAxisFactory {
    stimulusId: number;
    settings: ScarfSettingsType;
    participantIds: number[];
    isCut: boolean;
    constructor(participantIds: number[], stimulusId: number, settings: ScarfSettingsType);
    getAxis(): PlotAxisBreaks;
    getHighestEndTime(): number;
}
