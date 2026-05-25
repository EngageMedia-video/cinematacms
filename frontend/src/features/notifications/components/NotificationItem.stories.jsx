import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, within } from 'storybook/test';
import { NotificationItem } from './NotificationItem';

const queryClient = new QueryClient();

const unreadNotification = {
	id: 201,
	message: 'andriawan24 commented on your upload.',
	is_read: false,
	created_at: '2026-05-05T04:30:00Z',
	action_url: '/media/blue-boat/',
	actor: {
		username: 'andriawan24',
		thumbnail_url: '',
	},
};

const readNotification = {
	id: 202,
	message: 'cinemata-team started following you.',
	is_read: true,
	created_at: '2026-05-04T08:15:00Z',
	action_url: '/profile/cinemata-team/',
	actor: {
		username: 'cinemata-team',
		thumbnail_url: '',
	},
};

const meta = {
	title: 'Notification/Item',
	component: NotificationItem,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Current notification row used by the notifications dropdown and page. This isolated story makes the existing item easier to review and iterate on before its planned visual revamp.',
			},
		},
	},
	args: {
		notification: unreadNotification,
	},
	argTypes: {
		notification: {
			control: 'object',
			description:
				'Notification payload used to render actor avatar, message copy, relative timestamp, read state, and destination URL.',
			table: {
				type: { summary: 'Notification' },
			},
		},
	},
	render: (args) => (
		<div className="w-[320px] rounded-lg border border-border-default bg-bg-surface-raised">
			<QueryClientProvider client={queryClient}>
				<NotificationItem {...args} />
			</QueryClientProvider>
		</div>
	),
};

export default meta;

export const Unread = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('andriawan24')).toBeVisible();
		await expect(canvas.getByText(/commented on your upload/i)).toBeVisible();
		await expect(canvas.getByRole('button')).toBeVisible();
	},
};

export const Read = {
	args: {
		notification: readNotification,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('cinemata-team')).toBeVisible();
		await expect(canvas.getByText(/started following you/i)).toBeVisible();
	},
};
