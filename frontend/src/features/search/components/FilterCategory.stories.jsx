import { expect, within } from 'storybook/test';
import { FilterCategory } from './FilterCategory';

const meta = {
	title: 'Features/Search/FilterCategory',
	component: FilterCategory,
	tags: ['autodocs'],
	args: {
		name: 'country',
		label: 'Country of Origin',
		defaultExpanded: true,
		selectedValues: ['Philippines'],
		options: [
			{ value: 'Philippines', label: 'Philippines', count: 12 },
			{ value: 'Indonesia', label: 'Indonesia', count: 8 },
			{ value: 'Australia', label: 'Australia', count: 4 },
		],
	},
	render: (args) => (
		<div className="w-[211px] bg-bg-page p-6">
			<FilterCategory {...args} />
		</div>
	),
};

export default meta;

export const Expanded = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByLabelText('Philippines')).toBeVisible();
	},
};

export const SingleSelect = {
	args: {
		name: 'length',
		label: 'Length',
		selectMode: 'single',
		selectedValues: 'less_than_10',
		options: [
			{ value: 'less_than_10', label: 'Less than 10 mins' },
			{ value: 'more_than_10', label: 'More than 10 mins' },
		],
	},
};
