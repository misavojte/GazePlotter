import { AbstractObserver } from './AbstractObserver'

export abstract class AbstractPublisher extends AbstractObserver {
  readonly observerType: string = 'publisher'
  readonly observers: AbstractObserver[] = []

  /**
     * Add an observer for changes to this.observingViews or this.observingModels
     * @param observer - Observer for Notifications
     */
  addObserver (observer: AbstractObserver): void {
    this.observers.push(observer)
  }

  /**
     * Remove an observer for changes from this.observers
     * @param observer - Observer for notifications
     */
  removeObserver (observer: AbstractObserver): void {
    const removeIndex = (observers: AbstractObserver[]): number => observers.findIndex((obs) => {
      return observer === obs
    })

    if (removeIndex(this.observers) !== -1) {
      this.observers.splice(removeIndex(this.observers), 1)
    }
  }

  /**
   * Loops over observingViews and observingModels and calls the update method on each of them.
   * The method will be called everytime AbstractModel is updated, unless stopped from within.
   * @param msg - String containing instructions how to process notification in AbstractObserver::update method
   * @param observerTypes - Array of strings, if empty, notification will be posted to all observers.
   * If not, notification will be sent only to those with matching AbstractObserver::observerType field
   */
  notify (msg: string, observerTypes: string[] = []): void {
    const isForObserverType = (observerType: string): boolean => {
      return observerTypes.length === 0 ? true : observerTypes.includes(observerType)
    }

    if (this.observers.length > 0) {
      this.observers.forEach((observer: AbstractObserver) => {
        if (isForObserverType(observer.observerType)) observer.update(msg)
      })
    }
  }
}
