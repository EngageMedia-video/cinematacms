import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationPreferencesForm } from './NotificationPreferencesForm';

const hookMocks = vi.hoisted(() => {
	const defaultPreferences = {
		on_comment: 'email',
		on_like: 'in_app',
		on_added_to_playlist: 'in_app',
		on_follow: 'email',
		on_mention: 'email',
		on_new_media_from_following: 'email',
		on_reply: 'email',
	};

	return {
		defaultPreferences,
		mutate: vi.fn(),
		reset: vi.fn(),
		queryState: {
			data: defaultPreferences,
			isLoading: false,
			isError: false,
			error: null,
		},
		mutationState: {
			isPending: false,
			isSuccess: false,
			isError: false,
			error: null,
		},
		resetMocks() {
			this.mutate.mockReset();
			this.reset.mockReset();
			this.queryState.data = { ...defaultPreferences };
			this.queryState.isLoading = false;
			this.queryState.isError = false;
			this.queryState.error = null;
			this.mutationState.isPending = false;
			this.mutationState.isSuccess = false;
			this.mutationState.isError = false;
			this.mutationState.error = null;
		},
	};
});

vi.mock('../hooks/useNotificationPreferences', () => ({
	useNotificationPreferences: () => hookMocks.queryState,
}));

vi.mock('../hooks/useUpdateNotificationPreferences', () => ({
	useUpdateNotificationPreferences: () => ({
		mutate: hookMocks.mutate,
		reset: hookMocks.reset,
		...hookMocks.mutationState,
	}),
}));

function renderForm() {
	return render(<NotificationPreferencesForm />);
}

function channelGroup(label) {
	return screen.getByRole('group', { name: `${label} notification channel` });
}

describe('NotificationPreferencesForm', () => {
	beforeEach(() => {
		hookMocks.resetMocks();
	});

	it('renders the available preference groups in the issue order', () => {
		renderForm();

		const engagement = screen.getByText('Engagement & Discussions');
		const upload = screen.getByText('Upload & Archive Updates');
		const institutional = screen.getByText('Institutional / Access Notifications');

		expect(engagement.compareDocumentPosition(upload)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(upload.compareDocumentPosition(institutional)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it('hides unavailable security and platform announcement groups', () => {
		renderForm();

		expect(screen.queryByText('Security & Privacy Alerts')).not.toBeInTheDocument();
		expect(screen.queryByText('Platform announcements')).not.toBeInTheDocument();
		expect(screen.queryByText('Account login from new device')).not.toBeInTheDocument();
	});

	it('only exposes Comments, Likes, and Added to playlist as editable rows', () => {
		renderForm();

		expect(screen.getAllByRole('group', { name: /notification channel/i })).toHaveLength(3);
		expect(channelGroup('New comment on your film')).toBeInTheDocument();
		expect(channelGroup('New reactions to your film')).toBeInTheDocument();
		expect(channelGroup('Film added to a curated collection')).toBeInTheDocument();
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.queryByText('Push notification')).not.toBeInTheDocument();
		expect(screen.queryByText('Email Notification')).not.toBeInTheDocument();
	});

	it('uses compact channel labels with full accessible names', () => {
		renderForm();

		for (const label of [
			'New comment on your film',
			'New reactions to your film',
			'Film added to a curated collection',
		]) {
			const group = within(channelGroup(label));

			expect(group.getAllByRole('button').map((button) => button.textContent)).toEqual(['Off', 'App', 'Email']);
			expect(group.getByRole('button', { name: 'In-App' })).toBeInTheDocument();
			expect(group.getByRole('button', { name: 'In-App + Email' })).toBeInTheDocument();
		}
	});

	it('does not mutate other editable rows when one row changes', async () => {
		const user = userEvent.setup();
		renderForm();

		await user.click(within(channelGroup('New comment on your film')).getByRole('button', { name: 'Off' }));

		expect(within(channelGroup('New comment on your film')).getByRole('button', { name: 'Off' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(
			within(channelGroup('New reactions to your film')).getByRole('button', { name: 'In-App' })
		).toHaveAttribute('aria-pressed', 'true');
		expect(
			within(channelGroup('Film added to a curated collection')).getByRole('button', { name: 'In-App' })
		).toHaveAttribute('aria-pressed', 'true');
	});

	it('saves only changed editable preference keys', async () => {
		const user = userEvent.setup();
		renderForm();

		await user.click(within(channelGroup('New comment on your film')).getByRole('button', { name: 'Off' }));
		await user.click(
			within(channelGroup('Film added to a curated collection')).getByRole('button', {
				name: 'In-App + Email',
			})
		);
		await user.click(screen.getByRole('button', { name: 'Save changes' }));

		expect(hookMocks.mutate).toHaveBeenCalledTimes(1);
		expect(hookMocks.mutate).toHaveBeenCalledWith({
			on_comment: 'none',
			on_added_to_playlist: 'email',
		});
	});
});
