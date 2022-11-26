import { AbstractModel } from './AbstractModel'

export abstract class AbstractController {
  abstract model: AbstractModel
  abstract handleEvent (e: Event): void
}
