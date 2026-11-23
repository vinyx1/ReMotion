package ca.remotion.phone

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** The demo device, on a virtual clock: 300 reaches in a moment instead of 15 minutes. */
@OptIn(ExperimentalCoroutinesApi::class)
class DemoLinkTest {
    @Test fun repsFollowTheFirmwaresOrderAndAboutFortyPercentLean() = runTest {
        val lines = mutableListOf<String>()
        val demo = DemoLink(StandardTestDispatcher(testScheduler), Random(7))
        demo.start(onLine = { lines += it }, onClosed = {})
        demo.send("P0,0,60,0"); runCurrent()
        val reps = mutableListOf<Rep>()
        repeat(5) {                                         // five sessions of 60 reaches
            demo.send("G"); advanceTimeBy(4_000)
            repeat(60) { demo.addRep(); advanceTimeBy(6_000) }
            advanceTimeBy(1_000)
        }
        demo.close()
        lines.mapNotNullTo(reps) { Protocol.parse(it) as? Rep }

        assertEquals(300, reps.size)
        val leaned = reps.count { it.compensated }
        assertTrue("leaned $leaned of 300", leaned in 90..150)         // ~40%
        // a leaned reach peaks past the limit, a clean one stays under it
        assertTrue(reps.filter { it.compensated }.all { it.peakDeg > 10f })
        assertTrue(reps.filter { !it.compensated }.all { it.peakDeg < 10f })
        // every R line comes after a "# target" line naming the same target
        var target = ""
        for (line in lines) {
            if (line.startsWith("# target ")) target = line.removePrefix("# target ")
            (Protocol.parse(line) as? Rep)?.let { assertEquals(target, it.target) }
        }
        assertEquals(5, lines.count { it.startsWith("S,60,") })
        val peaks = reps.filter { it.compensated }.map { it.peakDeg }
        println("DEMO leaned=$leaned peaks min=${peaks.min()} max=${peaks.max()} mean=${peaks.average()}")
    }
}
