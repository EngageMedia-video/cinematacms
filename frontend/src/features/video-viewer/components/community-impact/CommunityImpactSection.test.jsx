import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommunityImpactSection } from './CommunityImpactSection';

const entries = {
	academic: {
		label: 'University Courses',
		lastReportedAt: '2026-02-14',
		totalCount: 14,
	},
	featured: {
		entries: [{ title: 'Regional documentary roundup', date: '2025-04-20', url: 'https://example.com/roundup' }],
		totalCount: 1,
	},
	curated: [
		{
			title: 'Climate Justice Watchlist',
			event_date: '2025-06-10',
			url: 'https://example.com/watchlist',
		},
	],
	saves: {
		lastEventAt: '2026-05-28T08:00:00Z',
		totalCount: { saves: 181, playlists: 90 },
	},
	screening: {
		entries: [{ title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' }],
		totalCount: 8,
	},
};

describe('CommunityImpactSection', () => {
	it('renders the new header and the cards in two rows', () => {
		render(<CommunityImpactSection entries={entries} />);

		expect(screen.getByRole('heading', { name: "Film's Impact" })).toBeInTheDocument();
		expect(
			screen.getByText(
				'For filmmakers & viewers. A list of where the film has been screened, written about, taught, or recognised'
			)
		).toBeVisible();
		expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
			'User Playlists',
			'Academic Usage',
			'Screenings',
			'Reviews and Features',
		]);
		expect(
			within(screen.getByRole('article', { name: 'User Playlists' })).getByText('In 90 playlists')
		).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'Academic Usage' })).getByText('Used in 14 classes')
		).toBeVisible();
		expect(screen.queryByRole('article', { name: 'Cinemata Curated Playlists' })).not.toBeInTheDocument();
		expect(screen.queryByText('Where has this film made an impact?')).not.toBeInTheDocument();
	});

	it('renders the empty state when there are no entries', () => {
		render(<CommunityImpactSection entries={{}} />);

		expect(screen.getByText('Where has this film made an impact?')).toBeVisible();
	});

	it('renders submitted-for-review feedback', () => {
		render(<CommunityImpactSection entries={{}} submitMessage="Submitted for review." />);

		expect(screen.getByText('Submitted for review.')).toBeVisible();
	});

	it('keeps the header ADD IMPACT button visible in the empty state', () => {
		render(<CommunityImpactSection entries={{}} />);

		expect(screen.getAllByRole('button', { name: 'ADD IMPACT' })).toHaveLength(2);
	});

	it('opens the add dialog and forwards submitted values', async () => {
		const user = userEvent.setup();
		const onAddImpact = vi.fn();

		render(<CommunityImpactSection entries={{}} onAddImpact={onAddImpact} />);

		await user.click(screen.getAllByRole('button', { name: 'ADD IMPACT' })[0]);
		await user.click(screen.getByRole('radio', { name: /^Article or Review/ }));
		await user.type(screen.getByLabelText('Title'), 'Films that changed the conversation');
		await user.type(screen.getByLabelText('Year'), '2023');
		await user.type(screen.getByLabelText('Written by'), 'Dewi Lestari');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onAddImpact).toHaveBeenCalledWith({
			category: 'article',
			title: 'Films that changed the conversation',
			year: 2023,
			creator: 'Dewi Lestari',
			publication: '',
			details: '',
			url: '',
		});
	});

	it('groups the stored categories into the design cards', () => {
		render(
			<CommunityImpactSection
				entries={{
					screening: [{ uid: 's1', title: 'Hanoi Doc Week', year: 2024, url: 'https://example.com/hanoi' }],
					article: [{ uid: 'a1', title: 'Films that changed the conversation', year: 2023 }],
					featured: [{ uid: 'f1', title: 'Regional documentary roundup', event_date: '2025-04-20' }],
					referenced: [{ uid: 'r1', title: 'Tide Lines', year: 2022 }],
					award: [
						{ uid: 'w1', title: 'Best Documentary', year: 2021 },
						{ uid: 'w2', title: 'Audience Choice', year: 2020 },
					],
					teaching: [{ uid: 't1', title: 'Media and Climate Justice', year: 2025 }],
				}}
			/>
		);

		const reviews = screen.getByRole('article', { name: 'Reviews and Features' });
		expect(
			within(reviews)
				.getAllByRole('listitem')
				.map((item) => item.querySelector('p').textContent)
		).toEqual(['Regional documentary roundup', 'Films that changed the conversation']);
		expect(within(reviews).getByText('April 2025')).toBeVisible();
		expect(within(screen.getByRole('article', { name: 'Awards' })).getByText('2 recognitions')).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'Academic Usage' })).getByText('Used in 1 class')
		).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'Referenced in Works' })).getByText('Tide Lines')
		).toBeVisible();
		expect(screen.queryByRole('article', { name: 'Featured In' })).not.toBeInTheDocument();
		expect(screen.queryByRole('article', { name: 'Teaching or Research' })).not.toBeInTheDocument();
	});

	it('clears a submit error when the add dialog is cancelled', async () => {
		const user = userEvent.setup();
		const onSubmitErrorClear = vi.fn();

		render(
			<CommunityImpactSection
				entries={{}}
				onSubmitErrorClear={onSubmitErrorClear}
				submitStatus="error"
				submitError={{ field: 'year', message: 'Enter a year between 1900 and 2026.' }}
			/>
		);

		await user.click(screen.getAllByRole('button', { name: 'ADD IMPACT' })[0]);
		await user.click(screen.getByRole('button', { name: 'CANCEL' }));

		expect(onSubmitErrorClear).toHaveBeenCalledTimes(1);
	});

	it('forwards submit errors into the add dialog', async () => {
		const user = userEvent.setup();

		render(
			<CommunityImpactSection
				entries={{}}
				submitStatus="error"
				submitError={{
					field: 'url',
					message: 'Link is not trustworthy. Please use a secure HTTPS link.',
				}}
			/>
		);

		await user.click(screen.getAllByRole('button', { name: 'ADD IMPACT' })[0]);

		expect(screen.getByText('Link is not trustworthy. Please use a secure HTTPS link.')).toBeVisible();
	});
});
