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
	it('renders populated category cards from grouped entries', () => {
		render(<CommunityImpactSection entries={entries} />);

		expect(screen.getByRole('heading', { name: "Film's Impact" })).toBeVisible();
		expect(
			screen.getByText(
				'For filmmakers & viewers. Add screenings, playlists, or discussions to show how this film is reaching people.'
			)
		).toBeVisible();
		expect(screen.getByText('Screened In')).toBeVisible();
		expect(screen.queryByText('Curated Into')).not.toBeInTheDocument();
		expect(screen.getByText('Academic Usage')).toBeVisible();
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

	it('lists new impact categories with their context and year', () => {
		render(
			<CommunityImpactSection
				entries={{
					screening: [
						{
							uid: 'screening-1',
							category: 'screening',
							title: 'Hanoi Doc Week',
							year: 2024,
							event_date: '2026-10-01',
							city: 'Hanoi',
							country_label: 'Viet Nam',
							organiser: 'Youth Media Collective',
						},
					],
					article: [
						{
							uid: 'article-1',
							category: 'article',
							title: 'Films that changed the conversation',
							year: 2023,
							event_date: '2026-10-02',
							creator: 'Dewi Lestari',
							publication: 'Jakarta Post',
						},
					],
					award: [
						{
							uid: 'award-1',
							category: 'award',
							title: 'Best Documentary',
							year: 2021,
							event_date: '2026-10-03',
							award_result_label: 'Won',
							organiser: 'Jogja-NETPAC',
						},
						{
							uid: 'award-2',
							category: 'award',
							title: 'Audience Choice',
							year: 2020,
							event_date: '2026-10-03',
							award_result_label: 'Nominated',
							organiser: 'Busan IFF',
						},
					],
				}}
			/>
		);

		const screening = screen.getByLabelText('Screened In');
		expect(within(screening).getByText('Hanoi, Viet Nam · Organised by Youth Media Collective')).toBeVisible();
		expect(within(screening).getByText('2024')).toBeVisible();
		expect(within(screening).queryByText('Oct 1, 2026')).not.toBeInTheDocument();

		const article = screen.getByLabelText('Written About In');
		expect(within(article).getByText('By Dewi Lestari · Jakarta Post')).toBeVisible();

		const award = screen.getByLabelText('Awards & Recognition');
		expect(within(award).getByText('Won · Given by Jogja-NETPAC')).toBeVisible();
		expect(within(award).getByText('Nominated · Given by Busan IFF')).toBeVisible();
		expect(within(award).getByText('2020')).toBeVisible();

		expect(screen.queryByLabelText('Referenced In')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Taught & Researched In')).not.toBeInTheDocument();
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
