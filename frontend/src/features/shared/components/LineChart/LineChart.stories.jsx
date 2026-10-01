import { LineChart } from './LineChart';

export default {
	title: 'Components/LineChart',
	component: LineChart,
	args: {
		label: 'Daily plays',
		xKey: 'day',
		yKey: 'plays',
		data: [
			{ day: 'Mon', plays: 4 },
			{ day: 'Tue', plays: 12 },
			{ day: 'Wed', plays: 7 },
			{ day: 'Thu', plays: 18 },
		],
		formatTooltipValue: (value) => `${value} plays`,
	},
};
export const Default = {};
export const Secondary = { args: { color: 'secondary' } };
export const Success = { args: { color: 'success' } };
export const Percentage = {
	args: { yMax: 100, formatY: (value) => `${value}%`, formatTooltipValue: (value) => `${value}%` },
};
