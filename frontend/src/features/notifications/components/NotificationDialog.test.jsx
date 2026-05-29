import { render, screen } from '@testing-library/react';
import { NotificationDialog } from './NotificationDialog';

describe('NotificationDialog', () => {
	it('renders header, children, and footer actions', () => {
		render(
			<NotificationDialog onMarkAllAsRead={() => {}} unreadCount={3}>
				<div>New follower notification</div>
			</NotificationDialog>
		);

		expect(screen.getByText('Notifications')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('New follower notification')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeEnabled();
		expect(screen.getByRole('link', { name: 'See All Notifications' })).toHaveAttribute('href', '/notifications/');
	});

	it('disables the mark-all action when there is nothing unread', () => {
		render(<NotificationDialog onMarkAllAsRead={() => {}} unreadCount={0} />);

		expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
		expect(screen.queryByText('0')).toBeNull();
	});

	it('renders the empty state when no notification items are provided', () => {
		render(<NotificationDialog onMarkAllAsRead={() => {}} />);

		expect(screen.getByText('No notifications')).toBeInTheDocument();
	});

	it('renders the loading state instead of the empty state', () => {
		render(<NotificationDialog onMarkAllAsRead={() => {}} isLoading />);

		expect(screen.getByText('Loading…')).toBeInTheDocument();
		expect(screen.queryByText('No notifications')).toBeNull();
	});

	it('shows the pending header label and disables the action', () => {
		render(<NotificationDialog onMarkAllAsRead={() => {}} isMarkAllAsReadPending />);

		const button = screen.getByRole('button', { name: 'Marking…' });

		expect(button).toBeDisabled();
	});
});
