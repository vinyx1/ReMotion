"""
app.py  —  therapist dashboard for the IMU Reach Tracker (post-session, not live).

Run from the repo root:

    streamlit run software/dashboard/app.py

It reads the CSV files the logger wrote to data/raw/ (and the committed
examples in data/sample/) and shows:
    1. every session: how many reps were compensated
    2. one chosen session: peak lean per target and the reach-time trend
    3. one chosen rep: the trunk-angle trace during the reach
"""

import sys
from pathlib import Path

# Let `streamlit run` find the `software` package no matter where it is started from
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import plotly.graph_objects as go
import streamlit as st

from software.dashboard import palette
from software.dashboard.animation import rep_animation
from software.dashboard.data import (
    load_reps, load_samples, order_targets, rep_trace,
    session_threshold, summarize_sessions,
)

# =====================================================================
#  SETTINGS
# =====================================================================
RAW_DIR = REPO_ROOT / "data" / "raw"          # real recordings (git-ignored)
SAMPLE_DIR = REPO_ROOT / "data" / "sample"    # small committed examples

# Chart colours. Blue/orange (not green/red) so the result is still readable
# with colour-blindness, and so it isn't confused with the GREEN/BLUE/RED targets.
COLOR_CLEAN = palette.CLEAN
COLOR_COMPENSATED = palette.COMPENSATED
COLOR_MUTED = palette.INK_MUTED                # threshold line, connecting lines
RESULT_COLORS = {"Clean": COLOR_CLEAN, "Compensated": COLOR_COMPENSATED}
RESULT_SYMBOLS = {"Clean": "circle", "Compensated": "diamond"}   # shape as well as colour

# Where each target sits on the mat (percent of comfortable arm reach)
TARGET_REACH = {"GREEN": "40%", "BLUE": "70%", "RED": "100%"}

CHART_HEIGHT = 340


# =====================================================================
#  LOADING (cached, so changing a dropdown doesn't re-read the files)
# =====================================================================
@st.cache_data(show_spinner=False)
def cached_reps(folders, file_signature):
    # file_signature isn't used here: it changes when files change, which refreshes the cache
    return load_reps(folders)


@st.cache_data(show_spinner=False)
def cached_samples(folder, stamp, session):
    return load_samples(folder, stamp, session)


def folder_signature(folders):
    """Names and modified-times of the CSVs, so new recordings show up after a rerun."""
    return tuple((str(p), p.stat().st_mtime) for f in folders for p in sorted(Path(f).glob("reps_*.csv")))


# =====================================================================
#  CHARTS
# =====================================================================
def base_layout(fig, x_title, y_title):
    """Shared look for every chart: quiet axes, legend on top, no drag-zoom surprises."""
    fig.update_layout(
        height=CHART_HEIGHT,
        margin=dict(l=10, r=10, t=30, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0, title=None),
        xaxis_title=x_title,
        yaxis_title=y_title,
        hoverlabel=dict(align="left"),
        xaxis=dict(fixedrange=True), yaxis=dict(fixedrange=True),   # no accidental zoom
    )
    return fig


def add_threshold_line(fig, threshold):
    fig.add_hline(y=threshold, line=dict(color=COLOR_MUTED, width=1.5, dash="dash"),
                  annotation_text=f"threshold {threshold:g}°", annotation_position="top left",
                  annotation_font_color=COLOR_MUTED)


def sessions_chart(summary):
    """Bar chart: percent of reps compensated in each session."""
    fig = go.Figure(go.Bar(
        x=summary["session_label"],
        y=summary["pct_compensated"],
        marker=dict(color=COLOR_COMPENSATED, cornerradius=4),
        width=0.5 if len(summary) > 2 else 0.25,
        text=[f"{pct:.0f}%" for pct in summary["pct_compensated"]],
        textposition="outside",
        customdata=summary[["compensated", "reps"]],
        hovertemplate="<b>%{x}</b><br>%{customdata[0]} of %{customdata[1]} reps compensated<extra></extra>",
    ))
    base_layout(fig, None, "Compensated reps (%)")
    fig.update_yaxes(range=[0, 110], ticksuffix="%", tickvals=[0, 25, 50, 75, 100])
    fig.update_xaxes(type="category")
    return fig


def peak_lean_chart(reps, threshold):
    """Dot plot: every rep's peak trunk lean, grouped by target."""
    targets = order_targets(reps["target"])
    labels = {t: f"{t} ({TARGET_REACH[t]})" for t in targets}
    fig = go.Figure()
    for result, group in reps.groupby("result"):
        fig.add_trace(go.Box(
            x=group["target"].map(labels),
            y=group["peak_deg"],
            name=result,
            boxpoints="all", jitter=0.5, pointpos=0,          # show the dots, not a box
            fillcolor="rgba(0,0,0,0)", line=dict(color="rgba(0,0,0,0)"),
            marker=dict(color=RESULT_COLORS[result], symbol=RESULT_SYMBOLS[result], size=10,
                        line=dict(color="white", width=1)),
            customdata=group[["rep", "reach_ms"]],
            hovertemplate="<b>Rep %{customdata[0]}</b> · %{x}<br>peak lean %{y:.1f}°"
                          "<br>reach %{customdata[1]} ms<extra>" + result + "</extra>",
            hoveron="points",
        ))
    add_threshold_line(fig, threshold)
    base_layout(fig, "Target (distance as % of arm reach)", "Peak trunk lean (°)")
    fig.update_layout(boxmode="overlay")
    fig.update_xaxes(categoryorder="array", categoryarray=[labels[t] for t in targets])
    fig.update_yaxes(rangemode="tozero", ticksuffix="°")
    return fig


def reach_time_chart(reps):
    """Line chart: reach time for each rep, in the order they were done."""
    reps = reps.sort_values("rep")
    fig = go.Figure()
    fig.add_trace(go.Scatter(                                 # thin line joining the reps
        x=reps["rep"], y=reps["reach_ms"] / 1000, mode="lines",
        line=dict(color=palette.LINE, width=2), hoverinfo="skip", showlegend=False,
    ))
    for result, group in reps.groupby("result"):
        fig.add_trace(go.Scatter(
            x=group["rep"], y=group["reach_ms"] / 1000, mode="markers", name=result,
            marker=dict(color=RESULT_COLORS[result], symbol=RESULT_SYMBOLS[result], size=11,
                        line=dict(color="white", width=1.5)),
            customdata=group[["target", "react_ms", "bursts"]],
            hovertemplate="<b>Rep %{x}</b> · %{customdata[0]}<br>reach %{y:.2f} s"
                          "<br>reaction %{customdata[1]} ms<br>wrist bursts %{customdata[2]}"
                          "<extra>" + result + "</extra>",
        ))
    base_layout(fig, "Rep number", "Reach time (s)")
    fig.update_xaxes(dtick=1)
    fig.update_yaxes(rangemode="tozero", ticksuffix=" s")
    return fig


def trace_chart(trace, reach_end_s, threshold, column, y_title, color, show_threshold):
    """Line chart of one signal during one rep. Time 0 = hand leaves HOME."""
    fig = go.Figure(go.Scatter(
        x=trace["t_s"], y=trace[column], mode="lines",
        line=dict(color=color, width=2),
        hovertemplate="%{x:.2f} s<br>%{y:.1f}<extra></extra>",
    ))
    # Shade the reach itself (leaving HOME -> pressing the target)
    fig.add_vrect(x0=0, x1=reach_end_s, fillcolor=palette.NEUTRAL, opacity=0.15, line_width=0,
                  annotation_text="reach", annotation_position="top left",
                  annotation_font_color=COLOR_MUTED)
    if show_threshold:
        fig.add_hline(y=threshold, line=dict(color=COLOR_MUTED, width=1.5, dash="dash"),
                      annotation_text=f"threshold {threshold:g}°", annotation_position="top right",
                      annotation_font_color=COLOR_MUTED)
    base_layout(fig, "Time since leaving HOME (s)", y_title)
    fig.update_layout(height=280, showlegend=False, hovermode="x")
    fig.update_yaxes(rangemode="tozero")
    return fig


def show_chart(fig):
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})


# =====================================================================
#  PAGE  (look comes from .streamlit/config.toml; no custom CSS)
# =====================================================================
st.set_page_config(page_title="IMU Reach Tracker", page_icon=":material/accessibility_new:", layout="wide")

# ---- Sidebar: which data, which session ----
have_raw = any(RAW_DIR.glob("reps_*.csv"))
with st.sidebar:
    st.subheader("Data", icon=":material/database:")
    show_samples = st.toggle("Include example data", value=not have_raw,
                             help="The committed example sessions in data/sample. "
                                  "Turn off to see only real recordings from data/raw.")
    if st.button("Reload files", icon=":material/refresh:", width="stretch"):
        st.cache_data.clear()

folders = [str(RAW_DIR)] + ([str(SAMPLE_DIR)] if show_samples else [])
all_reps = cached_reps(tuple(folders), folder_signature(folders))

if all_reps.empty:
    st.title("IMU Reach Tracker")
    st.info("No sessions found yet. Record one with `python -m software.tools.logger`, "
            "or turn on the example data in the sidebar.", icon=":material/info:")
    st.stop()

summary = summarize_sessions(all_reps)
labels = list(summary["session_label"])
with st.sidebar:
    chosen_label = st.selectbox("Session", labels, index=len(labels) - 1)     # newest by default
    st.caption(f"{len(labels)} session{'s' if len(labels) != 1 else ''} loaded")

reps = all_reps[all_reps["session_label"] == chosen_label].sort_values("rep")
first = reps.iloc[0]
samples = cached_samples(first["folder"], first["stamp"], int(first["session"]))
threshold = session_threshold(samples)
simulated = str(first["folder"]) == str(SAMPLE_DIR)

# ---- Header ----
if simulated:
    st.badge("Example data, simulated", icon=":material/science:", color="orange")
else:
    st.badge("Recorded session", icon=":material/sensors:", color="blue")
st.title("IMU Reach Tracker")
st.markdown("Clinical scores check **whether** a reach was completed, not **how**. "
            "This device measures trunk lean during each seated reach and flags reps "
            "where the trunk compensated for the arm.")
st.space("small")

# ---- Headline numbers ----
n_reps = len(reps)
n_comp = int(reps["compensated"].sum())
clean_peaks = reps.loc[~reps["compensated"], "peak_deg"]
tiles = st.columns(5)
tiles[0].metric("Reps", n_reps, border=True)
tiles[1].metric("Compensated", f"{100 * n_comp / n_reps:.0f}%", border=True,
                help=f"{n_comp} of {n_reps} reps")
tiles[2].metric(f"Highest lean (limit {threshold:g}°)", f"{reps['peak_deg'].max():.1f}°", border=True)
tiles[3].metric("Typical clean-rep lean", f"{clean_peaks.median():.1f}°" if len(clean_peaks) else "—",
                border=True, help="Median peak lean of the clean reps")
tiles[4].metric("Median reach time", f"{reps['reach_ms'].median() / 1000:.2f} s", border=True)
st.space("small")

LEGEND = (f":blue[●] Clean rep &nbsp;&nbsp; :orange[◆] Compensated rep &nbsp;&nbsp; "
          f":gray[- - -  lean threshold ({threshold:g}°)]")

tab_replay, tab_session, tab_rep, tab_all = st.tabs([
    ":material/play_circle: Replay",
    ":material/insights: Session overview",
    ":material/timeline: Rep detail",
    ":material/table_chart: All sessions",
])

# ---- Tab 1: animated replay, clean vs compensated ----
with tab_replay:
    clean_reps = reps[~reps["compensated"]]
    comp_reps = reps[reps["compensated"]]
    if clean_reps.empty or comp_reps.empty:
        st.info("This session needs at least one clean and one compensated rep to compare.",
                icon=":material/info:")
    else:
        def rep_name(n):
            r = reps[reps["rep"] == n].iloc[0]
            return f"Rep {r.rep} · {r.target} target · peak {r.peak_deg:.1f}°"

        # Defaults: the cleanest clean rep and the biggest lean, for the clearest contrast
        clean_list = list(clean_reps.sort_values("peak_deg")["rep"])
        comp_list = list(comp_reps.sort_values("peak_deg", ascending=False)["rep"])

        panels = st.columns(2)
        for panel, rep_list, label, title in (
                (panels[0], clean_list, "Clean rep", "Clean reach"),
                (panels[1], comp_list, "Compensated rep", "Compensated reach")):
            with panel:
                rep_n = st.selectbox(label, rep_list, format_func=rep_name)
                with st.container(border=True):
                    rep_trace_df, rep_end_s = (rep_trace(samples, int(rep_n)) if samples is not None
                                               else (None, None))
                    if rep_trace_df is None:
                        st.warning(f"Rep {rep_n} not found in the samples.", icon=":material/warning:")
                    else:
                        target = reps[reps["rep"] == rep_n].iloc[0]["target"]
                        st.plotly_chart(rep_animation(rep_trace_df, rep_end_s, target, threshold, title),
                                        width="stretch", config={"displayModeBar": False})
        st.caption("The trunk tilts by the logged trunk angle and turns orange past the threshold. "
                   "The arm is illustrative: the IMUs don't give hand position, so the hand moves from "
                   "HOME to the target over the logged reach time. Drag a figure to rotate it.")

# ---- Tab 2: one session at a glance ----
with tab_session:
    st.markdown(LEGEND)
    left, right = st.columns(2)
    with left.container(border=True):
        st.subheader("Peak lean per target")
        st.caption("Each mark is one rep. Targets get further away from left to right.")
        show_chart(peak_lean_chart(reps, threshold))
    with right.container(border=True):
        st.subheader("Reach time across the session")
        st.caption("Slower reaches late in a session can point to fatigue.")
        show_chart(reach_time_chart(reps))

    with st.expander("All reps in this session", icon=":material/list:"):
        st.dataframe(
            reps[["rep", "target", "react_ms", "reach_ms", "peak_deg", "bursts", "result"]],
            hide_index=True,
            width="stretch",
            column_config={
                "rep": "Rep", "target": "Target", "react_ms": "Reaction (ms)", "reach_ms": "Reach (ms)",
                "peak_deg": st.column_config.NumberColumn("Peak lean", format="%.1f°"),
                "bursts": "Wrist bursts", "result": "Result",
            },
        )

# ---- Tab 3: one rep in detail ----
with tab_rep:
    if samples is None:
        st.warning(f"No samples file for this session (samples_{first['stamp']}.csv), so there is no trace.",
                   icon=":material/warning:")
    else:
        rep_numbers = list(reps["rep"])
        default_rep = int(reps.loc[reps["peak_deg"].idxmax(), "rep"])          # start on the biggest lean
        chosen_rep = st.selectbox(
            "Rep", rep_numbers, index=rep_numbers.index(default_rep),
            format_func=lambda n: "Rep {rep} · {target} · peak {peak_deg:.1f}° · {result}".format(
                **reps[reps["rep"] == n].iloc[0]),
        )
        trace, reach_end_s = rep_trace(samples, chosen_rep)
        if trace is None:
            st.warning("Could not find this rep in the samples file. "
                       "(Was sample streaming turned off with D0 during the session?)",
                       icon=":material/warning:")
        else:
            with st.container(border=True):
                st.subheader("Trunk lean")
                show_chart(trace_chart(trace, reach_end_s, threshold, "trunk_deg", "Trunk lean (°)",
                                       COLOR_CLEAN, show_threshold=True))
            with st.container(border=True):
                st.subheader("Wrist rotation speed")
                show_chart(trace_chart(trace, reach_end_s, threshold, "wrist_dps", "Wrist speed (deg/s)",
                                       COLOR_CLEAN, show_threshold=False))
            st.caption("Time 0 is the hand leaving HOME; the shaded band ends at the target press. "
                       "The trace starts when the target lights up.")

# ---- Tab 4: every session ----
with tab_all:
    if len(summary) > 1:
        with st.container(border=True):
            st.subheader("Compensated reps per session")
            show_chart(sessions_chart(summary))
    st.dataframe(
        summary[["session_label", "reps", "compensated", "pct_compensated", "median_reach_s", "max_peak_deg"]],
        hide_index=True,
        width="stretch",
        column_config={
            "session_label": "Session",
            "reps": "Reps",
            "compensated": "Compensated",
            "pct_compensated": st.column_config.ProgressColumn(
                "% compensated", min_value=0, max_value=100, format="%.0f%%"),
            "median_reach_s": st.column_config.NumberColumn("Median reach time", format="%.2f s"),
            "max_peak_deg": st.column_config.NumberColumn("Highest lean", format="%.1f°"),
        },
    )
