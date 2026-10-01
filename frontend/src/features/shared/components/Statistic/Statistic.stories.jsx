import { Statistic } from './Statistic';

export default {
	title: 'Components/Statistic',
	component: Statistic,
	args: { label: 'Measured plays', value: '42', description: 'Plays with recorded viewing time.' },
	decorators: [
		(Story) => (
			<dl className="m-0 max-w-xs">
				<Story />
			</dl>
		),
	],
};

export const Default = {};
export const WithComparison = { args: { comparison: '+12% vs previous period' } };
export const NoData = { args: { value: '—', description: 'No measured plays in this period.' } };
