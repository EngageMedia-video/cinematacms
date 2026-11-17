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

	it('lists the working rows under Engagement & Discussions, with Replies last as coming soon', () => {
		renderForm();

		const section = within(screen.getByRole('group', { name: 'Engagement & Discussions' }));
		const rowLabels = [
			'New comment on your film',
			'New reactions to your film',
			'When someone mentions you',
			'Your film is added to a playlist',
			'Replies to your comment',
		].map((label) => section.getByText(label));
		for (let i = 1; i < rowLabels.length; i += 1) {
			expect(rowLabels[i - 1].compareDocumentPosition(rowLabels[i])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		}

		expect(screen.getAllByText('Coming soon')).toHaveLength(1);
		expect(
			screen.queryByRole('group', { name: 'Replies to your comment notification channel' })
		).not.toBeInTheDocument();
	});

	it('explains the App and Email channels and names the emails that are always sent', () => {
		renderForm();

		expect(screen.getByRole('heading', { level: 2, name: 'Notification Preferences' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'Choose how you hear about activity on your films and in discussions. App shows it in your Cinemata notifications. Email sends it to your inbox as well.'
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Some updates are always sent by email, such as when your film is published or its visibility window ends.'
			)
		).toBeInTheDocument();
	});

	it('removes the sections and rows that have no notification behind them', () => {
		renderForm();

		for (const label of [
			'Upload & Archive Updates',
			'Institutional / Access Notifications',
			'Upload completed',
			'Upload failed',
			'Processing completed',
			'Scheduled visibility change',
			'New films from filmmakers you follow',
			'Film accessed by reviewer',
			'Request for screening or usage',
			'Film added to a curated collection',
		]) {
			expect(screen.queryByText(label)).not.toBeInTheDocument();
		}
	});

	it('hides unavailable security and platform announcement groups', () => {
		renderForm();

		expect(screen.queryByText('Security & Privacy Alerts')).not.toBeInTheDocument();
		expect(screen.queryByText('Platform announcements')).not.toBeInTheDocument();
		expect(screen.queryByText('Account login from new device')).not.toBeInTheDocument();
	});

	it('only exposes Comments, Likes, Mentions, and Added to playlist as editable rows', () => {
		renderForm();

		expect(screen.getAllByRole('group', { name: /notification channel/i })).toHaveLength(4);
		expect(channelGroup('New comment on your film')).toBeInTheDocument();
		expect(channelGroup('New reactions to your film')).toBeInTheDocument();
		expect(channelGroup('When someone mentions you')).toBeInTheDocument();
		expect(channelGroup('Your film is added to a playlist')).toBeInTheDocument();
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.queryByText('Push notification')).not.toBeInTheDocument();
		expect(screen.queryByText('Email Notification')).not.toBeInTheDocument();
	});

	it('uses compact channel labels with full accessible names', () => {
		renderForm();

		for (const label of [
			'New comment on your film',
			'New reactions to your film',
			'Your film is added to a playlist',
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
			within(channelGroup('Your film is added to a playlist')).getByRole('button', { name: 'In-App' })
		).toHaveAttribute('aria-pressed', 'true');
	});

	it('saves only changed editable preference keys', async () => {
		const user = userEvent.setup();
		renderForm();

		await user.click(within(channelGroup('New comment on your film')).getByRole('button', { name: 'Off' }));
		await user.click(
			within(channelGroup('Your film is added to a playlist')).getByRole('button', {
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

	it('shows the saved mention channel and saves a change to it', async () => {
		hookMocks.queryState.data = { ...hookMocks.defaultPreferences, on_mention: 'email' };
		const user = userEvent.setup();
		renderForm();

		const mentions = within(channelGroup('When someone mentions you'));
		expect(mentions.getByRole('button', { name: 'In-App + Email' })).toHaveAttribute('aria-pressed', 'true');

		await user.click(mentions.getByRole('button', { name: 'Off' }));
		await user.click(screen.getByRole('button', { name: 'Save changes' }));

		expect(hookMocks.mutate).toHaveBeenCalledWith({ on_mention: 'none' });
	});
});
