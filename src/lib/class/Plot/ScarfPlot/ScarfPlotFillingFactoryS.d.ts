import type { ParticipantScarfFillingType, ScarfFillingType, StimulusScarfFillingType, StylingScarfFillingType } from '../../../type/Filling/ScarfFilling/index.ts';
import { PlotAxisBreaks } from '../PlotAxisBreaks/PlotAxisBreaks.ts';
import type { ScarfSettingsType } from '../../../type/Settings/ScarfSettings/ScarfSettingsType.ts';
import type { ExtendedInterpretedDataType } from '../../../type/Data/InterpretedData/ExtendedInterpretedDataType.ts';
import type { BaseInterpretedDataType } from '../../../type/Data/InterpretedData/BaseInterpretedDataType.ts';
/**
 * Factory for data filling which is used to render scarf plot.
 */
export declare class ScarfPlotFillingFactoryS {
    #private;
    HEIGHT_OF_X_AXIS: number;
    showTheseSegmentCategories: number[];
    heightOfBar: number;
    heightOfNonFixation: number;
    stimulusId: number;
    spaceAboveRect: number;
    spaceAboveLine: number;
    aoiData: ExtendedInterpretedDataType[];
    stimuliData: BaseInterpretedDataType[];
    participants: ParticipantScarfFillingType[];
    timeline: PlotAxisBreaks;
    stimuli: StimulusScarfFillingType[];
    stylingAndLegend: StylingScarfFillingType;
    chartHeight: number;
    settings: ScarfSettingsType;
    get rectWrappedHeight(): number;
    get lineWrappedHeight(): number;
    get heightOfBarWrap(): number;
    get showAoiVisibility(): boolean;
    constructor(stimulusId: number, participantIds: number[], axis: PlotAxisBreaks, settings: ScarfSettingsType, participGap?: number);
    getFilling(): ScarfFillingType;
}
