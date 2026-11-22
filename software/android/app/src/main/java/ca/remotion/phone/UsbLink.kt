package ca.remotion.phone

import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.util.SerialInputOutputManager
import java.io.IOException

/** The real device: the Arduino's USB serial port, 115200 baud, through the phone's USB-C (OTG). */
class UsbLink(private val usb: UsbManager, private val driver: UsbSerialDriver) : DeviceLink {
    override val name: String = driver.device.productName ?: "USB device"

    private var port: UsbSerialPort? = null
    private var io: SerialInputOutputManager? = null
    private val pending = StringBuilder()     // a line can arrive split over several USB packets
    @Volatile private var closing = false

    override fun start(onLine: (String) -> Unit, onClosed: (String) -> Unit) {
        val connection = usb.openDevice(driver.device) ?: throw IOException("no permission to use the USB device")
        val p = driver.ports.first()
        p.open(connection)
        // Never 1200 baud: on Arduino boards that means "restart into upload mode".
        p.setParameters(Protocol.BAUD, UsbSerialPort.DATABITS_8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
        p.setDTR(true)                        // "a program is listening": the R4 waits for this at start-up
        p.setRTS(true)
        port = p

        io = SerialInputOutputManager(p, object : SerialInputOutputManager.Listener {
            override fun onNewData(data: ByteArray) {
                pending.append(String(data, Charsets.UTF_8))
                while (true) {
                    val end = pending.indexOf("\n")
                    if (end < 0) break
                    val line = pending.substring(0, end).trimEnd('\r')
                    pending.delete(0, end + 1)
                    onLine(line)
                }
            }

            override fun onRunError(e: Exception) {
                if (!closing) onClosed("The connection to the device was lost (${e.message}).")
            }
        }).also { it.start() }
    }

    override fun send(command: String) {
        port?.write("$command\n".toByteArray(Charsets.US_ASCII), 500)
    }

    override fun close() {
        closing = true
        io?.stop()
        try { port?.close() } catch (_: IOException) { }
        io = null
        port = null
    }
}
