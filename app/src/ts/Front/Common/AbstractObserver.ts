export abstract class AbstractObserver {
  readonly observerType: string = 'observer'

  /**
   * Gets called by the AbstractPublisher::notify method.
   * @param msg - String from AbstractPublisher::method containing instructions how to process notification
   */
  update (msg: string): void {
    this.handleUpdate(msg)
  }

  handleUpdate (msg: string): void {
    console.warn('Msg type not recognized in observer', this, msg)
  };
}
