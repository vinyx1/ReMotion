package ca.remotion.phone

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same cases as software/tools/tests/test_protocol.py, so both parsers agree. */
class ProtocolTest {
    @Test fun parsesTheExamplesInProtocolMd() {
        assertEquals(Sample(15230, "REACHING", 4.2f, 85.3f, 10.0f), Protocol.parse("D,15230,REACHING,4.2,85.3,10.0"))
        assertEquals(Rep(1, "BLUE", 412, 1380, 6.8f, 2, false, "BASELINE"), Protocol.parse("R,1,BLUE,412,1380,6.8,2,0,BASELINE"))
        assertEquals("", (Protocol.parse("R,1,BLUE,412,1380,6.8,2,0") as Rep).phase)
        assertTrue((Protocol.parse("R,2,RED,390,1650,14.1,3,1") as Rep).compensated)
        assertEquals(SessionEnd(2, 1), Protocol.parse("S,2,1"))
        assertEquals(DeviceError("chest IMU (0x68) not found"), Protocol.parse("E,chest IMU (0x68) not found"))
        assertEquals(DeviceError("a, b"), Protocol.parse("E,a, b"))
        assertEquals(Comment("session started"), Protocol.parse("# session started"))
    }

    @Test fun parsesStatusLines() {
        val s = Protocol.parse("I,REACHING,BASELINE,10.0,3,15,30,15,1,7,2")
        assertEquals(Status("REACHING", "BASELINE", 10.0f, listOf(3, 15, 30, 15), true, 7, 2), s)
        val idle = Protocol.parse("I,IDLE,,12.5,0,0,5,0,0,0,0") as Status
        assertEquals("", idle.phase)
        assertEquals(listOf(0, 0, 5, 0), idle.plan)
        assertEquals(false, idle.streaming)
        assertEquals(s, Protocol.parse(Protocol.formatStatus(s as Status)))
        assertNull(Protocol.parse("I,IDLE,,10.0,3,15"))
    }

    @Test fun badLinesReturnNull() {
        for (line in listOf("", "   ", "D,152", "D,abc,REACHING,4.2,85.3,10.0", "X,1,2,3", "R,1,BLUE")) {
            assertNull(line, Protocol.parse(line))
        }
    }
}
