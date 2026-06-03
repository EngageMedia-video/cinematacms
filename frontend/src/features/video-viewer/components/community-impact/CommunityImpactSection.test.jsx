import { render, screen } from '@testing-library/react';
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
		await user.type(screen.getByLabelText('Where did you see this film'), 'Jakarta community hall');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onAddImpact).toHaveBeenCalledWith({
			category: 'screening',
			details: '',
			link: '',
			location: 'Jakarta community hall',
			title: 'Jakarta community hall',
			url: '',
		});
	});

	it('forwards submit errors into the add dialog', async () => {
		const user = userEvent.setup();

		render(
			<CommunityImpactSection
				entries={{}}
				submitStatus="error"
				submitError={{
					field: 'url',
					message: 'Link is not trustworthy. Please use a known sharing service.',
				}}
			/>
		);

		await user.click(screen.getAllByRole('button', { name: 'ADD IMPACT' })[0]);

		expect(screen.getByText('Link is not trustworthy. Please use a known sharing service.')).toBeVisible();
	});
});
