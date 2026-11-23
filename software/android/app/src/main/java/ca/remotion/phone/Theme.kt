package ca.remotion.phone

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
  The dashboard's "Rehab Studio" look (DESIGN.md), for a phone propped up at arm's length:
  a eucalyptus wall and a plaster floor, forest ink, and terracotta only while (or where)
  the trunk leaned. Type is Literata for what the coach says and Atkinson Hyperlegible,
  made for low vision, for everything else; its Mono for every measured number.
*/

val Plaster = Color(0xFFEEF0EC)
val Panel = Color(0xFFF7F8F5)
val Wash = Color(0xFFE2E8E1)
val Wall = Color(0xFFC9D3CB)
val Eucalyptus = Color(0xFF4F6F5F)
val Forest = Color(0xFF1F2D27)
val ForestDeep = Color(0xFF14201B)
val Forest2 = Color(0xFF4A5A52)
val Lake = Color(0xFF3F6A8A)
val Terra = Color(0xFFB4532F)
val TerraDeep = Color(0xFF9A4526)

/** The wall while the trunk is leaning: it warms, as on the landing page (DESIGN.md's Warm Room Rule: 9% terracotta). */
val WarmWall = lerp(Wall, Terra, 0.09f)

/** The mat's buttons, as they look on the table (the lit one is drawn in its colour). */
val ButtonGreen = Color(0xFF2F8A5A)
val ButtonBlue = Color(0xFF2F6FB0)
val ButtonRed = Color(0xFFC23B33)
val ButtonYellow = Color(0xFFE9C43A)

private fun variable(res: Int, weight: Int, opsz: Float? = null) = Font(
    res, FontWeight(weight),
    variationSettings = FontVariation.Settings(
        *listOfNotNull(FontVariation.weight(weight), opsz?.let { FontVariation.Setting("opsz", it) }).toTypedArray(),
    ),
)

val Literata = FontFamily(variable(R.font.literata, 500, opsz = 48f), variable(R.font.literata, 600, opsz = 48f))
val Atkinson = FontFamily(variable(R.font.atkinson, 400), variable(R.font.atkinson, 700))
val AtkinsonMono = FontFamily(variable(R.font.atkinson_mono, 400), variable(R.font.atkinson_mono, 600))

/** The coach's instruction: read from the far side of the table. */
val CoachStyle = TextStyle(fontFamily = Literata, fontWeight = FontWeight(500), fontSize = 44.sp, lineHeight = 48.sp, letterSpacing = (-0.02).em)
/** What the coach adds under the instruction. */
val CoachSubStyle = TextStyle(fontFamily = Atkinson, fontSize = 21.sp, lineHeight = 28.sp)
/** Small headings on the scoreboard ("This week", "Last reach"). */
val LabelStyle = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 20.sp)
val BodyStyle = TextStyle(fontFamily = Atkinson, fontSize = 18.sp, lineHeight = 25.sp)
/**
  The patient's counts ("4 of 15"): Atkinson bold with tabular figures, so a count sits in the
  same voice as the words around it. (Its zero is slashed on purpose, to tell it from an O.)
*/
val NumberStyle = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 40.sp, lineHeight = 44.sp, fontFeatureSettings = "tnum")

@Composable
fun RemotionTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Forest, onPrimary = Plaster,
            secondary = Forest2, onSecondary = Plaster,
            background = Plaster, onBackground = Forest,
            surface = Plaster, onSurface = Forest,
            surfaceVariant = Panel, onSurfaceVariant = Forest2,
            outline = Forest2.copy(alpha = 0.4f),
            error = TerraDeep, onError = Plaster,
        ),
        typography = Typography().let { t ->
            t.copy(
                bodyLarge = t.bodyLarge.copy(fontFamily = Atkinson),
                bodyMedium = t.bodyMedium.copy(fontFamily = Atkinson),
                bodySmall = t.bodySmall.copy(fontFamily = Atkinson),
                // buttons: room above and below the letters, so a label is never cut by the button's edge
                labelLarge = t.labelLarge.copy(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 24.sp),
                titleMedium = t.titleMedium.copy(fontFamily = Atkinson, fontWeight = FontWeight.Bold),
            )
        },
        content = content,
    )
}
