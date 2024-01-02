/// <reference types="svelte" />
import type { Writable } from 'svelte/store';
import type { DataType } from '../../type/Data/DataType.ts';
import type { BaseInterpretedDataType } from '../../type/Data/InterpretedData/BaseInterpretedDataType.ts';
import type { ExtendedInterpretedDataType } from '../../type/Data/InterpretedData/ExtendedInterpretedDataType.ts';
import type { SegmentInterpretedDataType } from '../../type/Data/InterpretedData/SegmentInterpretedDataType.ts';
export declare const getDemoDataWritable: () => Writable<DataType>;
export declare const data: Writable<DataType>;
export declare const setData: (newData: DataType) => void;
export declare const getData: () => DataType;
export declare const getNumberOfStimuli: () => number;
export declare const getNumberOfParticipants: () => number;
/**
 * Returns the stimulus with the given id
 * @param id - id of the stimulus
 * @returns BaseInterpretedDataType
 * @throws Error if stimulus with given id does not exist
 */
export declare const getStimulus: (id: number) => BaseInterpretedDataType;
export declare const getStimulusHighestEndTime: (stimulusIndex: number) => number;
export declare const getParticipantEndTime: (stimulusIndex: number, particIndex: number) => number;
export declare const getParticipant: (id: number) => BaseInterpretedDataType;
export declare const getAoi: (stimulusId: number, aoiId: number) => ExtendedInterpretedDataType;
export declare const getCategory: (id: number) => ExtendedInterpretedDataType;
export declare const getSegment: (stimulusId: number, participantId: number, id: number) => SegmentInterpretedDataType;
export declare const getNumberOfSegments: (stimulusId: number, participantId: number) => number;
export declare const getAoiOrderVector: (stimulusId: number) => number[];
export declare const getStimuliOrderVector: () => number[];
export declare const getParticipantOrderVector: () => number[];
export declare const getAois: (stimulusId: number) => ExtendedInterpretedDataType[];
export declare const getStimuli: () => BaseInterpretedDataType[];
export declare const getParticipants: () => BaseInterpretedDataType[];
export declare const getAoiVisibility: (stimulusId: number, aoiId: number, participantId?: number | null) => number[] | null;
export declare const updateMultipleAoiVisibility: (stimulusId: number, aoiNames: string[], visibilityArr: number[][], participantId?: number | null) => void;
export declare const updateMultipleAoi: (aoi: ExtendedInterpretedDataType[], stimulusId: number, applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name') => void;
