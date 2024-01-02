export declare class AoiVisibilityParser {
    addVisInfo(stimulusId: number, participantId: number | null, xml: Document): void;
    processKeyFrames(keyFrames: HTMLCollectionOf<Element>, stimulusId: number): number[];
}
