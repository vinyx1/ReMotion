package ca.remotion.phone

/**
  A connection to the device: lines come in, commands go out. Two kinds: the real
  device over USB (UsbLink) and a recorded session played back (DemoLink), so the
  rest of the app can't tell them apart.
*/
interface DeviceLink {
    /** Shown in the app's header. */
    val name: String

    /**
      Open the connection. onLine gets each line (without the newline) and onClosed is
      called once if the connection drops by itself; both are called on a background thread.
    */
    fun start(onLine: (String) -> Unit, onClosed: (String) -> Unit)

    /** Send one command, e.g. "G". The newline is added here. May block briefly. */
    fun send(command: String)

    fun close()
}
