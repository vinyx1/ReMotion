"""
palette.py  —  the dashboard's colours, in one place.

The page itself is themed by .streamlit/config.toml (a neutral zinc theme,
Inter font). Charts follow that theme automatically. Only these colours are
set by hand, and every chart and the 3D replay import them from here, so
the whole dashboard stays consistent.

Rule: blue and orange carry meaning (clean / compensated). Everything else
is a shade of neutral grey, so nothing competes with them.
"""

# Meaning
CLEAN = "#2a78d6"          # clean rep (blue)
COMPENSATED = "#eb6834"    # compensated rep, or trunk past the threshold (orange)

# Neutrals (zinc scale, matching the theme)
INK = "#09090B"            # main text
INK_MUTED = "#71717A"      # secondary text, threshold line
NEUTRAL = "#A1A1AA"        # connecting lines, shaded reach band
LINE = "#D4D4D8"           # chair, table edge
SURFACE_MUTED = "#F4F4F5"  # table top

# The mat buttons (the real colours of the arcade buttons)
TARGET_COLORS = {"HOME": "#E4E4E7", "GREEN": "#1baf7a", "BLUE": "#2a78d6", "RED": "#e34948"}
