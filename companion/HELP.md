# Generic dB Meter

This module provides a **visual meter feedback** you can place on buttons (Stream Deck / XL) using a numeric value (including values coming from variables such as Shure metering like `-19 dBFS`).

## Quick Start

1. Add the module in **Connections**
2. Go to **Buttons**
3. Add feedback: **dB Meter**
4. In the value field, enter either:
   - a number (example: `-24`)
   - a variable (example: `$(shure-wx:ch_1_meter)`)

## Meter Feedback Options

- **Value**: number or a variable string (units like `dBFS` are OK)
- **Min dB / Max dB**: meter range (example `-80` to `0`)
- **Scale**:
  - `Log` (recommended for audio feel)
  - `Linear`
- **Gamma**: used for log curve feel (example `2.8`)
- **Variant**:
  - Vertical (recommended)
  - Horizontal
- **Thickness**: how wide/tall the track is
- **Position**:
  - Vertical: -50 = left, +50 = right
  - Horizontal: -50 = bottom, +50 = top
- **Opacity**: 1–100

## Notes

- If your meter looks blank, ensure the button does **not** use a top bar overlay (some styles can cover the image).
- If using Shure variables, metering update rate is controlled by the Shure module’s metering interval.
- Ballistics and peak-hold (if enabled) are applied per-button and depend on Companion’s feedback refresh timing.

## Examples

### Shure channel meter

Value:
`$(shure-wx:ch_1_meter)`

Range:
`Min dB = -80`, `Max dB = 0`

Scale:
`Log`, `Gamma = 2.8`

Opacity:
`60`

### Support / feedback

If you encounter issues or have feature ideas:

- Check variable update rates first
- Confirm numeric values are being received
- Then open an issue or discussion on the module’s GitHub page
