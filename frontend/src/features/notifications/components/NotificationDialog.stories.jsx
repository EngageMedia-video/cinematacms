import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, within } from 'storybook/test';
import { NotificationDialog } from './NotificationDialog';
import { NotificationItem } from './NotificationItem';

const queryClient = new QueryClient();

const sampleNotification = {
	id: 101,
	notification_type: 'comment',
	message: 'andriawan24 commented on your upload.',
	is_read: false,
	created_at: '2026-05-05T04:30:00Z',
	action_url: '/media/blue-boat/',
	actor: {
		username: 'andriawan24',
		thumbnail_url: '',
	},
};

const meta = {
	title: 'Notification/Dialog',
	component: NotificationDialog,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Application-level notification popup extracted from the live notifications dropdown. Supports loaded, empty, and loading states while preserving the current header and footer actions.',
			},
		},
	},
	args: {
		title: 'Notifications',
		emptyMessage: 'No notifications',
		loadingMessage: 'Loading…',
		seeAllHref: '/notifications/',
		seeAllLabel: 'See All Notifications',
		isLoading: false,
		isMarkAllAsReadPending: false,
		unreadCount: 0,
		className: 'static top-auto right-auto mt-0',
	},
	argTypes: {
		children: {
			control: false,
			description: 'Notification rows rendered inside the scrollable list area.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional class overrides applied to the dialog container.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'static top-auto right-auto mt-0'" },
			},
		},
		emptyMessage: {
			control: 'text',
			description: 'Message shown when the dialog has no notification items.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'No notifications'" },
			},
		},
		isLoading: {
			control: 'boolean',
			description: 'Shows the loading message instead of items or empty state.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		isMarkAllAsReadPending: {
			control: 'boolean',
			description: 'Disables the header action and swaps its label to the pending state.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		loadingMessage: {
			control: 'text',
			description: 'Message shown while notifications are loading.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Loading…'" },
			},
		},
		onMarkAllAsRead: {
			action: 'mark-all-clicked',
			description: 'Callback fired when the header action is pressed.',
			table: {
				type: { summary: '() => void' },
			},
		},
		seeAllHref: {
			control: 'text',
			description: 'Destination used by the footer link.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'/notifications/'" },
			},
		},
		seeAllLabel: {
			control: 'text',
			description: 'Footer link label.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'See All Notifications'" },
			},
		},
		title: {
			control: 'text',
			description: 'Header title shown at the top of the notification container.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Notifications'" },
			},
		},
	},
	render: (args) => (
		<div className="bg-surface-body p-6">
			<QueryClientProvider client={queryClient}>
				<NotificationDialog {...args} />
			</QueryClientProvider>
		</div>
	),
};

export default meta;

export const WithNotificationItems = {
	args: { unreadCount: 1 },
	render: (args) => (
		<div className="bg-surface-body p-6">
			<QueryClientProvider client={queryClient}>
				<NotificationDialog {...args}>
					<NotificationItem notification={sampleNotification} />
				</NotificationDialog>
			</QueryClientProvider>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Notifications')).toBeVisible();
		await expect(canvas.getByText('andriawan24')).toBeVisible();
		await expect(canvas.getByText(/commented on your upload/i)).toBeVisible();
		await expect(canvas.getByRole('link', { name: 'See All Notifications' })).toBeVisible();
	},
};

export const EmptyState = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('No notifications')).toBeVisible();
	},
};
