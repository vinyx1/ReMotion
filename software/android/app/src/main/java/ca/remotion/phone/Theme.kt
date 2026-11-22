package ca.remotion.phone

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The dashboard's colours (software/web/src/index.css). Terracotta only means "leaned".
val Forest = Color(0xFF1F2D27)
val Forest2 = Color(0xFF4A5A52)
val Plaster = Color(0xFFEEF0EC)
val Panel = Color(0xFFF7F8F5)
val Terra = Color(0xFFB4532F)
val TerraDeep = Color(0xFF9A4526)
val Lake = Color(0xFF3F6A8A)

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
        content = content,
    )
}
