import { ModelInterface } from './ModelInterface'

export interface ControllerInterface {
  model: ModelInterface
  handleEvent: (e: Event) => void
}
