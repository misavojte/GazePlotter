

/**
 * Creates a factory function that returns a function that reverses a workspace command.
 * 
 * Reversing the command will create a new regular
 * typised command that can be used to undo the original command.
 * 
 * The "add command" will be reversed to a "remove command" and vice versa.
 * The "update data command" will be reversed to a "update data command"
 * using the data in the current data store before applying the said command.
 * The "update settings command" will be reversed to a "update settings command"
 * using the settings in the current data store before applying the said command.
 * 
 * All as minimal as possible, so the reverse command does not
 * occupy too much memory (snapshotting of the data store is not allowed as it
 * can be very expensive).
 */