# dB-Meter

dB Meter — Companion Module Help
Overview

The dB Meter module provides a lightweight, high-performance audio level meter for Bitfocus Companion buttons.
It is designed to visualize live audio or RF levels using Companion variables (e.g. Shure Wireless, Yamaha, or other sources).

The meter is rendered entirely as an advanced feedback, so it does not require actions, timers, or external dependencies.

What this meter is (and is not)

✅ Good for
Visualizing mic levels (speech, music)
Monitoring RF or audio levels on Stream Deck buttons
Compact, always-visible level indicators
1–16 channels comfortably on a typical system

❌ Not intended as
A precision measurement tool
A replacement for console meters
A waveform or scope

This meter is optimized for clarity and responsiveness, not calibration.

Basic usage

    1.  Add the dB Meter feedback to a button (or use the included preset as a starting point)

    2.  Set Value to:
            a Companion variable (recommended), e.g.
                $(shure-wx:ch_1_audio_level)
            or a literal number (for testing), e.g.
                -18

    3.  The meter will automatically parse values such as:
            -12
            -12 dB
            -12 dBFS
        Non-numeric characters are ignored.

Meter options explained

    Value
        Text or variable containing the level value.
        Units are optional — only the numeric portion is used.

    Min dB / Max dB
        Defines the displayed range of the meter.
        Common values:
            -80 → 0 (wide dynamic range)
            -60 → 0 (speech-focused)
            -40 → 0 (compressed sources)
        Values outside this range are clamped.

    Scale
        Controls how the meter maps dB values to screen space.
            Log (recommended): More resolution near 0 dB, similar to console meters.
            Linear: Uniform spacing from min to max.

    Gamma (log scale only)
        Controls how aggressive the log curve feels.
        Typical values:
            2.4–2.6 → smoother, more gradual
            2.8 → console-like (recommended)
            3.2+ → very top-heavy

    Variant
        Vertical (default)
        Horizontal

    Position
        Controls where the meter sits within the button.
            Vertical:
                -50 = far left → +50 = far right
            Horizontal:
                -50 = bottom → +50 = top
            0 centers the meter.

    Thickness
        Width (or height) of the meter track in pixels.
        Typical values:
        8–10 → subtle
        12–16 → bold
        20+ → dominant

    Opacity
        Controls meter transparency.
        100 → fully opaque
        60 → blends nicely with labels/icons
        30 → very subtle

Peak hold indicator

The meter includes a peak hold line:
Peaks latch immediately
Hold briefly
Decay smoothly over time
This helps identify transient peaks without cluttering the display.

Meter ballistics (smoothing)

The meter uses audio-style ballistics:
Fast rise
Smooth decay
This makes the display:
less jittery
more readable
closer to real console behavior
No additional timers or performance-heavy loops are used.

Performance notes
-Designed to be lightweight
-Safe for ~16 meters at 200–500 ms update rates
-Rendering cost is minimal (small ARGB buffer)
If a source variable updates slowly, the meter will reflect that cadence.

Known limitations
-Meter update speed depends on the source variable
-Some Companion modules expose level values at slower intervals
-This module does not force faster polling
For best results, use variables that update frequently (e.g. Shure metering variables).

Tips
-Disable the button top bar for best visuals
-Pair with minimal text or icons
-Use presets as a starting point
-Log scale + gamma ≈ 2.8 gives the most “console-like” feel

Support / feedback
If you encounter issues or have feature ideas:
-Check variable update rates first  
 -Confirm numeric values are being received
-Then open an issue or discussion on the module’s GitHub page
