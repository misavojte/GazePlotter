import { AbstractDownloader } from './AbstractDownloader.ts';
import type { ExtendedInterpretedDataType } from '../../type/Data/InterpretedData/ExtendedInterpretedDataType.ts';
export declare class ScanGraphDownloader extends AbstractDownloader {
    download(stimulusId: number, fileName: string): void;
    getStimulusScanGraphString(stimulusId: number): string;
    getHeaderString(aoiKey: string): string;
    getAoiString(aoi: ExtendedInterpretedDataType[]): string;
    getAoiLetter(aoi: number): string;
    getAoiKeyPart(aoi: ExtendedInterpretedDataType[]): string;
}
