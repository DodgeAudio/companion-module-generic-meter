import type { ModuleInstance } from './main.js'
import { combineRgb } from '@companion-module/base'

export function UpdatePresets(self: ModuleInstance): void {
	self.setPresetDefinitions({
		simple_meter_default: {
			type: 'button',
			category: 'Meters',
			name: 'Simple Meter (default)',
			style: {
				// Keep style simple; advanced feedback draws the meter image
				text: '',
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
				show_topbar: false,
			},
			steps: [
				{
					down: [],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'dBMeter',
					options: {
						value: '-80 dBFS',
						variant: 'v',
						position: 0,
						thickness: 10,
						mindb: -80,
						maxdb: 0,
						scale: 'log',
						gamma: 2.8,
						opacity: 60,
					},
				},
			],
		},
	})
}
