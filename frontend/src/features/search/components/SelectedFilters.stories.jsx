import { expect, within } from 'storybook/test';
import { SelectedFilters } from './SelectedFilters';

const meta = {
	title: 'Features/Search/SelectedFilters',
	component: SelectedFilters,
	tags: ['autodocs'],
	args: {
		filters: [
			{ key: 'country', value: 'Philippines', label: 'Philippines' },
			{ key: 'country', value: 'Indonesia', label: 'Indonesia' },
			{ key: 'community_impact', value: 'saves', label: 'Saves & Playlists' },
		],
		onDismiss: () => {},
		onClearAll: () => {},
	},
	render: (args) => (
		<div className="max-w-[680px] bg-bg-page p-6">
			<SelectedFilters {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Philippines')).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Clear all' })).toBeVisible();
	},
};
