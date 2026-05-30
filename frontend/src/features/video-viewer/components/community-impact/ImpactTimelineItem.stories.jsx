import { expect, within } from 'storybook/test';
import { ImpactTimelineItem } from './ImpactTimelineItem';

const meta = {
	title: 'Features/Video Viewer/Community Impact/ImpactTimelineItem',
	component: ImpactTimelineItem,
	tags: ['autodocs'],
	args: {
		accentClassName: 'text-cinemata-coral-reef-400p',
		date: '2025-02-01',
		isFirst: true,
		isLast: false,
		title: 'Manila Community Film Night',
		url: 'https://example.com/screening',
	},
	render: (args) => (
		<div className="max-w-sm bg-bg-page p-space-lg">
			<ul className="m-0 list-none p-0">
				<ImpactTimelineItem {...args} />
			</ul>
		</div>
	),
};

export default meta;

export const WithLink = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Manila Community Film Night')).toBeVisible();
		await expect(
			canvas.getByRole('link', { name: 'Open impact link for Manila Community Film Night' })
		).toBeVisible();
	},
};

export const WithoutLink = {
	args: {
		isFirst: false,
		isLast: true,
		title: 'Regional screening collective',
		url: '',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.queryByRole('link')).toBeNull();
	},
};
