"""
animation.py  —  3D replay of one rep, driven by the logged samples.

What is real and what is drawn:
    REAL   trunk lean: the figure's trunk tilts by the logged trunk_deg, sample by sample.
    REAL   timing: cue, leaving HOME and pressing the target come from the state column.
    DRAWN  the arm and hand. The IMUs don't give hand position, so the hand simply
           travels HOME -> target over the logged reach time, then back.
    DRAWN  lean direction. trunk_deg is a size (no direction), so it is shown as
           a forward lean, the usual compensation in a forward reach.

The result is one Plotly figure: the 3D figure on top and the trunk-angle trace
underneath, with a moving dot, both controlled by one Play button and slider.
"""

import math

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from software.dashboard import palette

# ---- Body and table sizes (metres, roughly an adult seated at a table) ----
SEAT_HEIGHT = 0.45          # hip joint height
TRUNK_LENGTH = 0.52         # hip -> shoulder line
NECK_LENGTH = 0.14          # shoulder line -> centre of the head
SHOULDER_HALF_WIDTH = 0.18  # centre of the chest -> each shoulder
UPPER_ARM = 0.31
FOREARM = 0.33              # elbow -> hand
TABLE_HEIGHT = 0.72
TABLE_NEAR_EDGE = 0.20      # distance in front of the hip
TABLE_FAR_EDGE = 0.85
HAND_LIFT = 0.08            # how high the hand arcs above the table mid-reach

# Mat layout on the table, in front of the reaching (right) shoulder
REACH_Y = -SHOULDER_HALF_WIDTH
HOME_X = 0.27
TARGET_X = {"GREEN": 0.37, "BLUE": 0.47, "RED": 0.57}
TARGET_COLORS = palette.TARGET_COLORS

# ---- Animation ----
FRAME_EVERY_N_SAMPLES = 4   # 100 Hz samples -> 25 frames per second
FRAME_MS = 40               # real time: 4 samples x 10 ms

COLOR_BODY = palette.INK_MUTED          # arm
COLOR_OK = palette.CLEAN            # trunk colour while under the threshold
COLOR_LEAN = palette.COMPENSATED    # trunk colour while over the threshold
COLOR_MUTED = palette.NEUTRAL


def smoothstep(f):
    """0 -> 1 with gentle start and stop, like a real hand movement."""
    f = min(max(f, 0.0), 1.0)
    return f * f * (3 - 2 * f)


def body_points(trunk_deg):
    """Hip, shoulder-centre, reaching shoulder, other shoulder and head for a forward lean."""
    a = math.radians(trunk_deg)
    hip = np.array([0.0, 0.0, SEAT_HEIGHT])
    up = np.array([math.sin(a), 0.0, math.cos(a)])          # trunk direction, tilted forward
    chest = hip + TRUNK_LENGTH * up
    side = np.array([0.0, SHOULDER_HALF_WIDTH, 0.0])
    return hip, chest, chest - side, chest + side, chest + NECK_LENGTH * up


def hand_position(t_s, reach_end_s, target, return_s=0.5):
    """Where the hand is drawn: on HOME, travelling to the target, then coming back."""
    home = np.array([HOME_X, REACH_Y, TABLE_HEIGHT])
    goal = np.array([TARGET_X[target], REACH_Y, TABLE_HEIGHT])
    if t_s <= 0:
        f = 0.0
    elif t_s <= reach_end_s:
        f = smoothstep(t_s / reach_end_s)
    else:
        f = 1 - smoothstep((t_s - reach_end_s) / return_s)
    lift = HAND_LIFT * math.sin(math.pi * f) if 0 < t_s < reach_end_s + return_s else 0.0
    return home + f * (goal - home) + np.array([0, 0, lift])


def elbow_position(shoulder, hand):
    """Two-link arm: put the elbow where an upper arm and forearm of fixed length meet."""
    to_hand = hand - shoulder
    d = min(np.linalg.norm(to_hand), UPPER_ARM + FOREARM - 1e-3)
    u = to_hand / np.linalg.norm(to_hand)
    hand = shoulder + d * u                       # can't reach further than the arm is long
    along = (UPPER_ARM**2 - FOREARM**2 + d**2) / (2 * d)
    out = math.sqrt(max(UPPER_ARM**2 - along**2, 0.0))
    down_and_out = np.array([0.0, -0.7, -1.0])    # elbow drops and points out to the side
    bend = down_and_out - down_and_out.dot(u) * u
    bend /= np.linalg.norm(bend)
    return shoulder + along * u + out * bend, hand


def figure_traces(trunk_deg, t_s, reach_end_s, target, threshold):
    """The moving 3D parts for one moment: trunk + shoulders, arm, head."""
    hip, chest, r_shoulder, l_shoulder, head = body_points(trunk_deg)
    elbow, hand = elbow_position(r_shoulder, hand_position(t_s, reach_end_s, target))
    trunk_color = COLOR_LEAN if trunk_deg > threshold else COLOR_OK

    def line(points, color, width):
        pts = np.array(points)
        return go.Scatter3d(x=pts[:, 0], y=pts[:, 1], z=pts[:, 2], mode="lines",
                            line=dict(color=color, width=width), hoverinfo="skip", showlegend=False)

    trunk = line([hip, chest, r_shoulder, chest, l_shoulder], trunk_color, 14)
    arm = line([r_shoulder, elbow, hand], COLOR_BODY, 10)
    head_dot = go.Scatter3d(x=[head[0]], y=[head[1]], z=[head[2]], mode="markers",
                            marker=dict(size=22, color=trunk_color), hoverinfo="skip", showlegend=False)
    return [trunk, arm, head_dot]


def static_scene(target):
    """Things that don't move: table top, chair, mat buttons."""
    x0, x1 = TABLE_NEAR_EDGE, TABLE_FAR_EDGE
    table = go.Mesh3d(x=[x0, x1, x1, x0], y=[-0.6, -0.6, 0.6, 0.6], z=[TABLE_HEIGHT] * 4,
                      i=[0, 0], j=[1, 2], k=[2, 3], color=palette.SURFACE_MUTED, opacity=0.9,
                      hoverinfo="skip", showlegend=False)
    chair = go.Scatter3d(x=[-0.2, -0.2, 0.2, 0.2], y=[0, 0, 0, 0],
                         z=[SEAT_HEIGHT + 0.5, SEAT_HEIGHT - 0.03, SEAT_HEIGHT - 0.03, 0],
                         mode="lines", line=dict(color=palette.LINE, width=8),
                         hoverinfo="skip", showlegend=False)
    names = ["HOME"] + list(TARGET_X)
    xs = [HOME_X] + list(TARGET_X.values())
    colors = [TARGET_COLORS["HOME"]] + [TARGET_COLORS[n] for n in TARGET_X]
    sizes = [9] + [14 if n == target else 7 for n in TARGET_X]     # the cued target is bigger
    buttons = go.Scatter3d(x=xs, y=[REACH_Y] * 4, z=[TABLE_HEIGHT + 0.005] * 4, mode="markers",
                           marker=dict(size=sizes, color=colors, line=dict(color=palette.INK_MUTED, width=1)),
                           text=names, hoverinfo="text", showlegend=False)
    return [table, chair, buttons]


def rep_animation(trace, reach_end_s, target, threshold, title):
    """Build the full animated figure for one rep (3D on top, trunk trace below)."""
    rows = trace.iloc[::FRAME_EVERY_N_SAMPLES].reset_index(drop=True)

    fig = make_subplots(rows=2, cols=1, row_heights=[0.62, 0.38], vertical_spacing=0.02,
                        specs=[[{"type": "scene"}], [{"type": "xy"}]])

    for tr in static_scene(target):                                   # traces 0-2
        fig.add_trace(tr, row=1, col=1)
    first = rows.iloc[0]
    for tr in figure_traces(first.trunk_deg, first.t_s, reach_end_s, target, threshold):
        fig.add_trace(tr, row=1, col=1)                               # traces 3-5 (move)

    fig.add_trace(go.Scatter(x=trace["t_s"], y=trace["trunk_deg"], mode="lines",
                             line=dict(color=COLOR_MUTED, width=2), hoverinfo="skip",
                             showlegend=False), row=2, col=1)          # trace 6
    fig.add_trace(go.Scatter(x=[first.t_s], y=[first.trunk_deg], mode="markers",
                             marker=dict(size=12, color=COLOR_OK, line=dict(color="white", width=2)),
                             hoverinfo="skip", showlegend=False), row=2, col=1)   # trace 7 (moves)
    # Threshold line and the shaded reach (drawn as plain shapes on the 2D axes "x"/"y")
    fig.update_layout(shapes=[
        dict(type="line", xref="x domain", yref="y", x0=0, x1=1, y0=threshold, y1=threshold,
             line=dict(color=COLOR_MUTED, width=1.5, dash="dash")),
        dict(type="rect", xref="x", yref="y domain", x0=0, x1=reach_end_s, y0=0, y1=1,
             fillcolor=COLOR_MUTED, opacity=0.12, line_width=0),
    ])

    peak_so_far = 0.0
    frames = []
    for i, r in rows.iterrows():
        peak_so_far = max(peak_so_far, r.trunk_deg)
        color = COLOR_LEAN if r.trunk_deg > threshold else COLOR_OK
        dot = go.Scatter(x=[r.t_s], y=[r.trunk_deg], mode="markers",
                         marker=dict(size=12, color=color, line=dict(color="white", width=2)))
        phase = {"CUED": "target lit", "REACHING": "reaching", "RETURNING": "returning"}.get(r.state, r.state)
        frames.append(go.Frame(
            name=str(i),
            data=figure_traces(r.trunk_deg, r.t_s, reach_end_s, target, threshold) + [dot],
            traces=[3, 4, 5, 7],
            layout=dict(title=dict(
                text=f"{title}<br><sup>{r.t_s:+.2f} s · {phase} · "
                     f"trunk {r.trunk_deg:.1f}° (peak {peak_so_far:.1f}°)</sup>",
                x=0.02, y=0.985, yanchor="top",
                font=dict(size=16, weight=600, color=palette.INK))),
        ))
    fig.frames = frames

    play = dict(frame=dict(duration=FRAME_MS, redraw=True), fromcurrent=True, transition=dict(duration=0))
    fig.update_layout(
        height=700,
        margin=dict(l=10, r=10, t=130, b=10),
        title=dict(text=f"{title}<br><sup>press Play</sup>", x=0.02, y=0.985, yanchor="top",
                   font=dict(size=16, weight=600, color=palette.INK)),
        scene=dict(
            aspectmode="data",
            xaxis=dict(visible=False, range=[-0.35, 0.9]),
            yaxis=dict(visible=False, range=[-0.6, 0.6]),
            zaxis=dict(visible=False, range=[0, 1.3]),
            camera=dict(eye=dict(x=0.35, y=-1.55, z=0.35), center=dict(x=0, y=0, z=-0.05)),
        ),
        updatemenus=[dict(type="buttons", direction="left", showactive=False, x=0, y=1.07,
                          xanchor="left", yanchor="bottom",
                          buttons=[dict(label="▶ Play", method="animate", args=[None, play]),
                                   dict(label="❚❚ Pause", method="animate",
                                        args=[[None], dict(mode="immediate", frame=dict(duration=0))])])],
        sliders=[dict(active=0, x=0.32, len=0.68, y=1.085, yanchor="bottom", pad=dict(t=0),
                      currentvalue=dict(visible=False), ticklen=0, minorticklen=0,
                      steps=[dict(label="", method="animate",
                                  args=[[f.name], dict(mode="immediate", frame=dict(duration=0, redraw=True))])
                             for f in frames])],
    )
    fig.update_xaxes(title_text="Time since leaving HOME (s)", fixedrange=True, row=2, col=1)
    fig.update_yaxes(fixedrange=True, row=2, col=1)          # no accidental zoom while presenting
    fig.update_yaxes(title_text="Trunk lean (°)", rangemode="tozero",
                     range=[0, max(trace["trunk_deg"].max(), threshold) * 1.15], row=2, col=1)
    return fig
