import { expect, fn, userEvent, within } from 'storybook/test';
import { ImpactEmptyState } from './ImpactEmptyState';

const meta = {
	title: 'Features/Video Viewer/Community Impact/ImpactEmptyState',
	component: ImpactEmptyState,
	tags: ['autodocs'],
	args: {
		canAdd: true,
		onAddImpact: fn(),
	},
	render: (args) => (
		<div className="max-w-2xl bg-bg-page p-space-lg">
			<ImpactEmptyState {...args} />
		</div>
	),
};

export default meta;

export const Empty = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'ADD IMPACT' });

		await expect(canvas.getByText('Where has this film made an impact?')).toBeVisible();
		await userEvent.click(button);
		await expect(args.onAddImpact).toHaveBeenCalled();
	},
};

export const ReadOnly = {
	args: {
		canAdd: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.queryByRole('button', { name: 'ADD IMPACT' })).toBeNull();
	},
};
