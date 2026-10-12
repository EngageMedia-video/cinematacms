import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageFilmImpactPage } from './ManageFilmImpactPage';

vi.mock('../_Page', () => ({
	Page: class Page extends React.Component {
		render() {
			return this.pageContent();
		}
	},
}));

vi.mock('../components/MediaListWrapper', () => ({
	MediaListWrapper: ({ title, children }) => <section aria-label={title}>{children}</section>,
}));

vi.mock('../../contexts/ApiUrlContext', () => ({
	default: { _currentValue: { manage: { filmImpact: '/api/v1/manage_film_impact' } } },
}));

vi.mock('../../functions/getCSRFToken', () => ({ default: () => 'csrf-token' }));

const UID = '3f2b8c1e-0000-4000-8000-000000000001';

const AWARD_ENTRY = {
	uid: UID,
	title: 'Best Documentary',
	category: 'award',
	category_label: 'Award',
	details: '',
	status: 'waiting_approval',
	event_date: '2026-05-29',
	url: '',
	media: { title: 'Sea Songs' },
	user: { username: 'viewer', name: 'Viewer' },
};

function jsonResponse(body, { ok = true } = {}) {
	return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe('ManageFilmImpactPage edit form', () => {
	beforeEach(() => {
		window.history.pushState({}, '', `/manage/film-impact/${UID}/edit`);
	});

	afterEach(() => {
		window.history.pushState({}, '', '/');
		vi.unstubAllGlobals();
	});

	it('shows the category without letting moderators change it', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => jsonResponse(AWARD_ENTRY))
		);

		render(<ManageFilmImpactPage />);

		const category = await screen.findByLabelText('Category');
		expect(category).toBeDisabled();
		expect(category).toHaveDisplayValue('Award');
		expect(screen.getByText(/Category details can be changed in the Django admin/)).toBeVisible();
	});

	it('shows server errors for fields the form does not display', async () => {
		const user = userEvent.setup();
		const fetchMock = vi
			.fn()
			.mockImplementationOnce(() => jsonResponse(AWARD_ENTRY))
			.mockImplementationOnce(() =>
				jsonResponse(
					{ year: ['This field is required.'], award_result: ['This field is required.'] },
					{ ok: false }
				)
			);
		vi.stubGlobal('fetch', fetchMock);

		render(<ManageFilmImpactPage />);

		await user.click(await screen.findByRole('button', { name: 'Save' }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('year: This field is required.');
		expect(alert).toHaveTextContent('award result: This field is required.');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	});
});
