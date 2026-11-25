import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilmImpactReviewPage } from './FilmImpactReviewPage';

const config = {
	apiUrl: '/api/v1/manage_film_impact/impact-1',
	csrfToken: 'token-123',
	impactUid: 'impact-1',
	manageUrl: '/manage/film-impact',
};

const waitingImpact = {
	uid: 'impact-1',
	category: 'award',
	category_label: 'Award',
	status: 'waiting_approval',
	status_label: 'Waiting for approval',
	title: 'Honorable Mention',
	award_result: 'special_mention',
	organiser: 'ABC Independent Film Awards',
	year: 2025,
	details: '',
	url: '',
	add_date: '2026-05-01T10:00:00Z',
	media: { friendly_token: 'abc', title: 'On Nature', url: 'https://cinemata.test/view?m=abc' },
	user: { username: 'dewi', name: 'Dewi Lestari' },
};

function respond(data, { ok = true, status = 200 } = {}) {
	return Promise.resolve({ ok, status, json: () => Promise.resolve(data) });
}

describe('FilmImpactReviewPage', () => {
	let fetchMock;

	beforeEach(() => {
		fetchMock = vi.fn((url, options = {}) => {
			if ((options.method ?? 'GET') === 'GET') {
				return respond(waitingImpact);
			}
			const body = JSON.parse(options.body);
			return respond({ ...waitingImpact, ...body, status: body.status ?? waitingImpact.status });
		});
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('loads the impact into the form beside its details', async () => {
		render(<FilmImpactReviewPage config={config} />);

		expect(screen.getByRole('heading', { name: 'Review Community Impact' })).toBeVisible();
		expect(await screen.findByLabelText('Given by')).toHaveValue('ABC Independent Film Awards');
		expect(screen.getByRole('radio', { name: /^Recognition/ })).toBeChecked();
		expect(screen.getByRole('radio', { name: /^Screening/ })).toBeDisabled();

		const details = screen.getByRole('heading', { name: 'Impact details' }).closest('div').parentElement;
		expect(within(details).getByText('WAITING FOR REVIEW')).toBeVisible();
		expect(within(details).getByRole('link', { name: 'On Nature' })).toHaveAttribute(
			'href',
			'https://cinemata.test/view?m=abc'
		);
		expect(within(details).getByText('Dewi Lestari')).toBeVisible();
		expect(fetchMock).toHaveBeenCalledWith(config.apiUrl, expect.objectContaining({ method: 'GET' }));
	});

	it('approves the impact with any corrections', async () => {
		const user = userEvent.setup();

		render(<FilmImpactReviewPage config={config} />);

		const year = await screen.findByLabelText('Year');
		await user.clear(year);
		await user.type(year, '2024');
		await user.click(screen.getByRole('button', { name: 'APPROVE' }));

		const [url, options] = fetchMock.mock.calls.at(-1);
		expect(url).toBe(config.apiUrl);
		expect(options.method).toBe('PATCH');
		expect(options.headers['X-CSRFToken']).toBe('token-123');
		expect(JSON.parse(options.body)).toEqual({
			category: 'award',
			title: 'Honorable Mention',
			award_result: 'special_mention',
			organiser: 'ABC Independent Film Awards',
			year: 2024,
			details: '',
			url: '',
			status: 'approved',
		});
		expect(await screen.findByText('Impact approved. It now shows on the film page.')).toBeVisible();
		expect(screen.getByText('APPROVED')).toBeVisible();
		expect(screen.queryByRole('button', { name: 'APPROVE' })).not.toBeInTheDocument();
	});

	it('saves corrections without changing the status', async () => {
		const user = userEvent.setup();

		render(<FilmImpactReviewPage config={config} />);

		await screen.findByLabelText('Given by');
		await user.click(screen.getByRole('button', { name: 'SAVE CHANGES' }));

		expect(JSON.parse(fetchMock.mock.calls.at(-1)[1].body)).not.toHaveProperty('status');
		expect(await screen.findByText('Changes saved.')).toBeVisible();
		expect(screen.getByText('WAITING FOR REVIEW')).toBeVisible();
	});

	it('shows a server field error on its field', async () => {
		const user = userEvent.setup();
		fetchMock.mockImplementation((url, options = {}) =>
			(options.method ?? 'GET') === 'GET'
				? respond(waitingImpact)
				: respond({ organiser: ['This field is required.'] }, { ok: false, status: 400 })
		);

		render(<FilmImpactReviewPage config={config} />);

		await screen.findByLabelText('Given by');
		await user.click(screen.getByRole('button', { name: 'APPROVE' }));

		expect(await screen.findByText('This field is required.')).toBeVisible();
		expect(screen.getByLabelText('Given by')).toHaveAttribute('aria-invalid', 'true');
	});

	it('explains when the impact cannot be loaded', async () => {
		fetchMock.mockImplementation(() => respond({ detail: 'Not found.' }, { ok: false, status: 404 }));

		render(<FilmImpactReviewPage config={config} />);

		expect(await screen.findByRole('alert')).toHaveTextContent('This impact could not be loaded.');
		expect(screen.getByRole('link', { name: 'Back to Manage Film Impact' })).toHaveAttribute(
			'href',
			'/manage/film-impact'
		);
	});
});
