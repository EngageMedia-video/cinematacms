import { expect, userEvent, within } from 'storybook/test';
import { COMMUNITY_IMPACT_OPTIONS } from '../constants';
import { MobileFilterSheet } from './MobileFilterSheet';

const meta = {
	title: 'Features/Search/MobileFilterSheet',
	component: MobileFilterSheet,
	tags: ['autodocs'],
	args: {
		sections: [
			{
				key: 'community_impact',
				label: 'Community Impact',
				selectMode: 'multi',
				selectedValues: ['saves'],
				options: COMMUNITY_IMPACT_OPTIONS,
			},
		],
		onReset: () => {},
		onSave: () => {},
		onSectionChange: () => {},
	},
	render: (args) => (
		<div className="min-h-[360px] bg-bg-page p-6">
			<MobileFilterSheet {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'Filters' }));
		await expect(within(document.body).getByRole('dialog', { name: 'Search filters' })).toBeVisible();
	},
};
