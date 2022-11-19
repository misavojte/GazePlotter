export abstract class AbstractObserver {
  readonly observerType: string = 'observer'

  /**
     * Gets called by the AbstractPublisher::notify method.
     * @param msg - UpdateMessage containing instructions how to update
     */
  update (msg: string): void {
    this.handleUpdate(msg)
  }

  handleUpdate (msg: string): void {
    console.warn('Msg type not recognized in observer', this, msg)
  };
}
