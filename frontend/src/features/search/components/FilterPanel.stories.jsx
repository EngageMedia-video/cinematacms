import { expect, within } from 'storybook/test';
import { COMMUNITY_IMPACT_OPTIONS, LENGTH_OPTIONS, UPLOAD_DATE_OPTIONS } from '../constants';
import { FilterPanel } from './FilterPanel';

const sections = [
	{
		key: 'country',
		label: 'Country of Origin',
		defaultExpanded: true,
		selectMode: 'multi',
		selectedValues: ['Philippines'],
		options: [
			{ value: 'Philippines', label: 'Philippines', count: 12 },
			{ value: 'Indonesia', label: 'Indonesia', count: 8 },
		],
	},
	{
		key: 'length',
		label: 'Length',
		selectMode: 'single',
		selectedValues: 'less_than_10',
		options: LENGTH_OPTIONS,
	},
	{
		key: 'upload_date',
		label: 'Upload Date',
		selectMode: 'single',
		selectedValues: '',
		options: UPLOAD_DATE_OPTIONS,
	},
	{
		key: 'community_impact',
		label: 'Community Impact',
		selectMode: 'multi',
		selectedValues: ['saves'],
		options: COMMUNITY_IMPACT_OPTIONS,
	},
];

const meta = {
	title: 'Features/Search/FilterPanel',
	component: FilterPanel,
	tags: ['autodocs'],
	args: {
		sections,
		onReset: () => {},
		onSectionChange: () => {},
	},
	render: (args) => (
		<div className="w-[260px] bg-bg-page p-6">
			<FilterPanel {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Choose Filters')).toBeVisible();
		await expect(canvas.getByText('Community Impact')).toBeVisible();
	},
};
