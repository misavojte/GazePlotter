export class PlotAxisBreaks extends Array {
  constructor (numberToBreak: number, numberOfSteps: number = 10) {
    const {
      step,
      length
    } = PlotAxisBreaks.getSteps(numberToBreak, numberOfSteps)
    super(length)
    for (let i = 0; i < length; i++) this[i] = step * i
  }

  get maxLabel (): number {
    return this[this.length - 1]
  }

  static getSteps (numberToBreak: number, numberOfSteps: number): { step: number, length: number } {
    const step = PlotAxisBreaks.getStep(numberToBreak, numberOfSteps)
    while (step === PlotAxisBreaks.getStep(numberToBreak, numberOfSteps - 1)) {
      numberOfSteps--
    }
    return {
      step,
      length: numberOfSteps + 1
    }
  }

  static getStep (numberToBreak: number, numberOfSteps: number): number {
    let res = numberToBreak / numberOfSteps
    const numOfDigits = (Math.log(res) * Math.LOG10E + 1 | 0) - 1
    res = Math.ceil(res / (10 ** (numOfDigits)))
    if ((res % 2 === 1 && res % 5 > 0) && res !== 1) {
      res++
    }
    if (res % 6 === 0 || res % 8 === 0) {
      res = 10
    }
    return res * (10 ** (numOfDigits))
  }
}
