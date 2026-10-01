import { Statistic } from './Statistic';

export default {
	title: 'Components/Statistic',
	component: Statistic,
	args: { label: 'Measured plays', value: '42', description: 'Plays with recorded viewing time.' },
	render: (args) => (
		<dl className="m-0 grid max-w-xs">
			<Statistic {...args} />
		</dl>
	),
};

export const Default = {};
export const WithComparison = { args: { comparison: '+12% vs previous period' } };
export const NoData = { args: { value: '—', description: 'No measured plays in this period.' } };

export const UnevenLabels = {
	render: () => (
		<dl className="m-0 grid w-64 grid-cols-2 gap-x-8">
			<Statistic label="Legacy views (all time)" value="1,024" />
			<Statistic label="Current likes" value="24" />
		</dl>
	),
};
