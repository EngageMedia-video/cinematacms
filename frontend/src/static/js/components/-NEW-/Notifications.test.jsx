import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Notifications } from './Notifications';

const pageStoreMock = vi.hoisted(() => {
	const state = {
		notifications: [],
	};

	return {
		state,
		pageStore: {
			get: vi.fn((key) => {
				if (key === 'notifications-size') return state.notifications.length;
				if (key === 'notifications') {
					const nextNotifications = [...state.notifications];
					state.notifications = [];
					return nextNotifications;
				}
				return null;
			}),
			on: vi.fn(),
			removeListener: vi.fn(),
		},
		reset() {
			state.notifications = [];
			this.pageStore.get.mockClear();
			this.pageStore.on.mockClear();
			this.pageStore.removeListener.mockClear();
		},
	};
});

vi.mock('../../pages/_PageStore.js', () => ({
	default: pageStoreMock.pageStore,
}));

describe('Notifications', () => {
	beforeEach(() => {
		pageStoreMock.reset();
		document.body.innerHTML = '';
	});

	it('renders notifications in a body portal so they can sit above the app shell', async () => {
		pageStoreMock.state.notifications = [['notification-1', 'Media added to playlist']];
		const host = document.createElement('div');
		document.body.appendChild(host);

		render(<Notifications />, { container: host });

		await waitFor(() => {
			expect(screen.getByText('Media added to playlist')).toBeInTheDocument();
		});

		const notifications = document.body.querySelector('.notifications');
		expect(notifications).toBeInTheDocument();
		expect(host.querySelector('.notifications')).not.toBeInTheDocument();
	});
});
