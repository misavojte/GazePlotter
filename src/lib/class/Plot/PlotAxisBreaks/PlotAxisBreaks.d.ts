export declare class PlotAxisBreaks extends Array {
    constructor(numberToBreak: number, numberOfSteps?: number);
    get maxLabel(): number;
    static getSteps(numberToBreak: number, numberOfSteps: number): {
        step: number;
        length: number;
    };
    static getStep(numberToBreak: number, numberOfSteps: number): number;
}
