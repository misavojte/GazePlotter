import { AbstractDownloader } from './AbstractDownloader.ts';
import type { DataType } from '../../type/Data/DataType.ts';
export declare class WorkplaceDownloader extends AbstractDownloader {
    download(data: DataType, fileName: string): void;
}
