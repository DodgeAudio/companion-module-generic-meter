import type { ModuleInstance } from './main.js'

function toText(v: unknown): string {
	if (v === null || v === undefined) return ''
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
	try {
		return JSON.stringify(v)
	} catch {
		return ''
	}
}

function parseNumberLoose(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v
	if (v == null) return null

	let s = toText(v).trim()
	if (!s) return null

	// Normalize common "weird" characters seen in some sources:
	// Unicode minus (−), en-dash (–), em-dash (—) -> '-'
	s = s.replace(/[\u2212\u2013\u2014]/g, '-')

	// Normalize non-breaking space to normal space
	s = s.replace(/\u00A0/g, ' ')

	// Normalize decimal comma -> dot (optional)
	s = s.replace(',', '.')

	// Extract first numeric token, ignoring any units
	const m = s.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)
	if (!m) return null

	const n = Number(m[0])
	return Number.isFinite(n) ? n : null
}

type MeterOpts = {
	variant: 'v' | 'h'
	position: number
	thickness: number
	minDb: number
	maxDb: number
	scale: 'linear' | 'log'
	gamma: number
	opacity: number
	peakDb?: number
}

function setPixelARGB(
	buf: Uint8Array,
	width: number,
	x: number,
	y: number,
	r: number,
	g: number,
	b: number,
	a: number,
) {
	const idx = (width * y + x) * 4
	buf[idx + 0] = a
	buf[idx + 1] = r
	buf[idx + 2] = g
	buf[idx + 3] = b
}

function drawMeterARGBFromDb(dbIn: number, opts: MeterOpts): Buffer {
	const W = 72
	const H = 72
	const padH = 6 // horizontal padding (left/right)
	const padV = 2 // vertical side meters: hug the edge

	const buf = new Uint8Array(W * H * 4) // transparent

	const alphaMul = Math.round((opts.opacity / 100) * 255)

	const lumaLow = 0.85 // dim end
	const lumaHigh = 1.1 // hot end

	// Clamp to -60..0
	const db = Math.min(opts.maxDb, Math.max(opts.minDb, dbIn))

	const range = opts.maxDb - opts.minDb

	function dbToPos01(dbVal: number): number {
		const clampedDb = Math.min(opts.maxDb, Math.max(opts.minDb, dbVal))
		const lin = (clampedDb - opts.minDb) / range
		const u = Math.min(1, Math.max(0, lin))
		return opts.scale === 'linear' ? u : Math.pow(u, opts.gamma)
	}

	// meter fill position (0..1) using selected scale
	const value01 = dbToPos01(db)
	const peak01 = opts.peakDb !== undefined ? dbToPos01(opts.peakDb) : undefined

	function clamp01(x: number) {
		return Math.min(1, Math.max(0, x))
	}

	function clamp255(n: number) {
		return Math.min(255, Math.max(0, Math.round(n)))
	}

	function applyLuma(c: { r: number; g: number; b: number; a: number }, luma: number) {
		return {
			r: clamp255(c.r * luma),
			g: clamp255(c.g * luma),
			b: clamp255(c.b * luma),
			a: c.a,
		}
	}

	function unscaleToDb(pos01: number) {
		// Convert a *scaled* position (0..1 in “meter space”) back into the dB value
		// that should control the color at that position.
		const p = clamp01(pos01)

		const lin = opts.scale === 'linear' ? p : Math.pow(p, 1 / opts.gamma)

		return opts.minDb + range * lin
	}

	// Your zones:
	// green: -60..-18, yellow: -18..-1, red: 0+
	function lerp(a: number, b: number, t: number) {
		return a + (b - a) * t
	}

	function lerpColor(
		c1: { r: number; g: number; b: number; a: number },
		c2: { r: number; g: number; b: number; a: number },
		t: number,
	) {
		const tt = Math.min(1, Math.max(0, t))
		return {
			r: Math.round(lerp(c1.r, c2.r, tt)),
			g: Math.round(lerp(c1.g, c2.g, tt)),
			b: Math.round(lerp(c1.b, c2.b, tt)),
			a: Math.round(lerp(c1.a, c2.a, tt)),
		}
	}

	// Smooth zones (no hard bands)
	function colorForDbRow(db: number) {
		// Base colors (edit these freely)
		const green = { r: 80, g: 180, b: 90, a: alphaMul }
		const yellow = { r: 210, g: 170, b: 60, a: alphaMul }
		const red = { r: 210, g: 60, b: 60, a: alphaMul }

		// Transition widths in dB (edit these to taste)
		const g2yStart = -22
		const g2yEnd = -14

		const y2rStart = -6
		const y2rEnd = 0

		if (db <= g2yStart) return green
		if (db >= y2rEnd) return red

		// Green → Yellow blend
		if (db < g2yEnd) {
			const t = (db - g2yStart) / (g2yEnd - g2yStart)
			return lerpColor(green, yellow, t)
		}

		// Yellow → Red blend
		if (db >= y2rStart) {
			const t = (db - y2rStart) / (y2rEnd - y2rStart)
			return lerpColor(yellow, red, t)
		}

		// Solid yellow region
		return yellow
	}

	// Track area (full height/width), but "skinny"
	const thickness = Math.min(24, Math.max(4, Math.floor(opts.thickness)))

	// Frame color
	const fr = 255,
		fg = 255,
		fb = 255
	const fa = Math.round(alphaMul * 0.7)

	if (opts.variant === 'v') {
		// Vertical skinny meter on left or right
		// Map -50..+50 to 0..1
		const pos01 = (Math.min(50, Math.max(-50, opts.position)) + 50) / 100

		// Available horizontal travel for the meter track (within pads)
		const minX0 = padV
		const maxX0 = W - padV - thickness

		// Choose x0 based on pos01
		const x0 = Math.round(minX0 + (maxX0 - minX0) * pos01)

		const x1 = x0 + thickness - 1
		const y0 = padH
		const y1 = H - padH - 1

		// Draw a simple frame around the skinny track
		for (let x = x0; x <= x1; x++) {
			setPixelARGB(buf, W, x, y0, fr, fg, fb, fa)
			setPixelARGB(buf, W, x, y1, fr, fg, fb, fa)
		}
		for (let y = y0; y <= y1; y++) {
			setPixelARGB(buf, W, x0, y, fr, fg, fb, fa)
			setPixelARGB(buf, W, x1, y, fr, fg, fb, fa)
		}

		// Inner fill area
		const innerX0 = x0 + 1
		const innerX1 = x1 - 1
		const innerY0 = y0 + 1
		const innerY1 = y1 - 1
		const innerH = innerY1 - innerY0 + 1

		const filled = Math.round(innerH * Math.min(1, Math.max(0, value01)))
		const fillTop = innerY1 - filled + 1

		for (let y = fillTop; y <= innerY1; y++) {
			const t = (innerY1 - y) / Math.max(1, innerH - 1) // 0 bottom → 1 top
			const rowDb = unscaleToDb(t)
			const base = colorForDbRow(rowDb)
			const luma = lumaLow + (lumaHigh - lumaLow) * t
			const { r, g, b, a } = applyLuma(base, luma)

			for (let x = innerX0; x <= innerX1; x++) {
				setPixelARGB(buf, W, x, y, r, g, b, a)
			}
		}
		// Peak hold line (1px)
		if (peak01 !== undefined) {
			const yPeak = innerY1 - Math.round(peak01 * (innerH - 1))

			// white peak line (slightly brighter than fill)
			const pr = 255,
				pg = 255,
				pb = 255,
				pa = 230

			if (yPeak >= innerY0 && yPeak <= innerY1) {
				for (let x = innerX0; x <= innerX1; x++) {
					setPixelARGB(buf, W, x, yPeak, pr, pg, pb, pa)
				}
			}
		}
	} else {
		// Horizontal skinny meter, centered vertically
		// Map -50..+50 to 0..1
		const pos01 = (Math.min(50, Math.max(-50, opts.position)) + 50) / 100

		// Available vertical travel for the horizontal meter
		const minY0 = padH
		const maxY0 = H - padH - thickness

		const y0 = Math.round(minY0 + (maxY0 - minY0) * (1 - pos01))
		const y1 = y0 + thickness - 1

		const x0 = padH
		const x1 = W - padH - 1

		// Frame
		for (let x = x0; x <= x1; x++) {
			setPixelARGB(buf, W, x, y0, fr, fg, fb, fa)
			setPixelARGB(buf, W, x, y1, fr, fg, fb, fa)
		}
		for (let y = y0; y <= y1; y++) {
			setPixelARGB(buf, W, x0, y, fr, fg, fb, fa)
			setPixelARGB(buf, W, x1, y, fr, fg, fb, fa)
		}

		// Inner fill
		const innerX0 = x0 + 1
		const innerX1 = x1 - 1
		const innerY0 = y0 + 1
		const innerY1 = y1 - 1
		const innerW = innerX1 - innerX0 + 1

		const filled = Math.round(innerW * Math.min(1, Math.max(0, value01)))
		const fillRight = innerX0 + filled - 1

		for (let x = innerX0; x <= fillRight; x++) {
			// For horizontal: color by the dB represented at this x position
			const t = (x - innerX0) / Math.max(1, innerW - 1) // 0 left → 1 right
			const colDb = unscaleToDb(t)
			const base = colorForDbRow(colDb)
			const luma = lumaLow + (lumaHigh - lumaLow) * t
			const { r, g, b, a } = applyLuma(base, luma)

			for (let y = innerY0; y <= innerY1; y++) {
				setPixelARGB(buf, W, x, y, r, g, b, a)
			}
		}
		// Peak hold line (1px)
		if (peak01 !== undefined) {
			const xPeak = innerX0 + Math.round(peak01 * (innerW - 1))

			const pr = 255,
				pg = 255,
				pb = 255,
				pa = 230

			if (xPeak >= innerX0 && xPeak <= innerX1) {
				for (let y = innerY0; y <= innerY1; y++) {
					setPixelARGB(buf, W, xPeak, y, pr, pg, pb, pa)
				}
			}
		}
	}

	return Buffer.from(buf)
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		dBMeter: {
			name: 'dB Meter',
			type: 'advanced',
			options: [
				{
					id: 'value',
					type: 'textinput',
					label: 'Level (-80-20) or variable',
					default: '$(internal:custom_Test_Meter)',
					useVariables: true,
				},
				{
					id: 'variant',
					type: 'dropdown',
					label: 'Variant',
					default: 'v',
					choices: [
						{ id: 'v', label: 'Vertical' },
						{ id: 'h', label: 'Horizontal' },
					],
				},
				{
					id: 'scale',
					type: 'dropdown',
					label: 'Scale',
					default: 'log',
					choices: [
						{ id: 'linear', label: 'Linear' },
						{ id: 'log', label: 'Log / VU' },
					],
				},
				{
					id: 'mindb',
					type: 'number',
					label: 'Min',
					default: -60,
					min: -120,
					max: -1,
				},
				{
					id: 'maxdb',
					type: 'number',
					label: 'Max',
					default: 0,
					min: -60,
					max: 20,
				},
				{
					id: 'gamma',
					type: 'number',
					label: 'Gamma',
					default: 2.8,
					min: 1.2,
					max: 6.0,
					step: 0.1,
					isVisibleExpression: '$(options:scale) == "log"',
				},
				{
					id: 'position',
					type: 'number',
					label: 'Position',
					default: 0,
					min: -50,
					max: 50,
					step: 1,
				},
				{
					id: 'thickness',
					type: 'number',
					label: 'Thickness (px)',
					default: 10,
					min: 4,
					max: 24,
				},
				{
					id: 'opacity',
					type: 'number',
					label: 'Opacity (%)',
					default: 100,
					min: 1,
					max: 100,
					step: 1,
				},
			],

			callback: async (feedback, context) => {
				const raw = String(feedback.options.value ?? '')
				const parsed = await context.parseVariablesInString(raw)
				const dbIn = parseNumberLoose(parsed) ?? -60

				const variant = String(feedback.options.variant ?? 'v')
				const position = Number(feedback.options.position ?? 0)
				const thickness = Number(feedback.options.thickness ?? 10)
				const opacityPct = Number(feedback.options.opacity ?? 100)

				const opacity = Number.isFinite(opacityPct) ? Math.min(100, Math.max(1, Math.round(opacityPct))) : 100

				const scaleOpt = String(feedback.options.scale ?? 'log')
				const scale = scaleOpt === 'linear' ? 'linear' : 'log'

				let minDb = Number(feedback.options.mindb ?? -60)
				let maxDb = Number(feedback.options.maxdb ?? 0)
				let gamma = Number(feedback.options.gamma ?? 2.8)

				// sanity
				if (!Number.isFinite(minDb)) minDb = -60
				if (!Number.isFinite(maxDb)) maxDb = 0
				if (minDb >= maxDb) minDb = maxDb - 1

				if (!Number.isFinite(gamma)) gamma = 2.8
				gamma = Math.min(6.0, Math.max(1.2, gamma))

				const thick = Number.isFinite(thickness) ? Math.min(24, Math.max(4, Math.floor(thickness))) : 10
				const pos = Number.isFinite(position) ? Math.min(50, Math.max(-50, Math.round(position))) : 0

				// --- Ballistics + Peak hold ---
				const releaseMs = 600

				// Peak behavior tuning
				const peakHoldMs = 800 // how long peak stays frozen
				const peakReleaseMs = 1200 // how quickly peak falls after hold

				const now = Date.now()
				const key = `${feedback.controlId}:${feedback.feedbackId}`

				const prev = self.meterState.get(key)

				let db = dbIn
				let peak = dbIn
				let peakTs = now

				if (prev) {
					const dt = Math.max(0, now - prev.ts)

					// Smooth main meter (fast rise, smooth fall)
					if (dbIn < prev.value) {
						const k = Math.exp(-dt / releaseMs)
						db = dbIn + (prev.value - dbIn) * k
					} else {
						db = dbIn
					}

					// Peak hold logic (use raw dbIn for peak tracking)
					peak = prev.peak
					peakTs = prev.peakTs

					if (dbIn >= peak) {
						// New higher peak -> latch it
						peak = dbIn
						peakTs = now
					} else {
						// If hold time has elapsed, let peak fall toward current level
						const heldFor = now - peakTs
						if (heldFor > peakHoldMs) {
							const dtPeak = heldFor - peakHoldMs
							const kPeak = Math.exp(-dtPeak / peakReleaseMs)
							peak = dbIn + (peak - dbIn) * kPeak
						}
					}

					self.meterState.set(key, { value: db, ts: now, peak, peakTs })
				} else {
					self.meterState.set(key, { value: db, ts: now, peak, peakTs })
				}

				return {
					imageBuffer: drawMeterARGBFromDb(db, {
						variant: variant === 'h' ? 'h' : 'v',
						thickness: thick,
						position: pos,
						peakDb: peak,
						minDb,
						maxDb,
						scale,
						gamma,
						opacity,
					}),
				}
			},
		},
	})
}
