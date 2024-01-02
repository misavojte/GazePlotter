import { AbstractDownloader } from './AbstractDownloader.ts';
export declare class ScarfDownloader extends AbstractDownloader {
    #private;
    minimalWidth: number;
    width: number;
    height: number;
    fileType: '.jpg' | '.png' | '.svg' | '.webp';
    fileName: string;
    staticSvg: SVGElement;
    constructor(fileName: string, fileType: string, width: number, el: HTMLElement);
    download(): Promise<void>;
    buildContent(): Promise<string>;
}
