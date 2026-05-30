import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ImpactCard } from './ImpactCard';

const entries = [
	{ title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
	{ title: '2026 Film Festival, Dakar', date: '2025-02-15', url: 'https://example.com/dakar' },
	{ title: 'Jakarta Mutual Aid Screening', date: '2025-03-08', url: 'https://example.com/jakarta' },
];

describe('ImpactCard', () => {
	it('renders collapsed list cards and expands with accessible state', async () => {
		const user = userEvent.setup();

		render(<ImpactCard entries={entries} subtitle="This film has been screened 8x" title="Screened In" />);

		expect(screen.getByText('Manila Community Film Night')).toBeVisible();
		expect(screen.queryByText('Jakarta Mutual Aid Screening')).not.toBeInTheDocument();

		const toggle = screen.getByRole('button', { name: 'Show all Screened In entries' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await user.click(toggle);

		expect(screen.getByText('Jakarta Mutual Aid Screening')).toBeVisible();
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	it('renders summary cards without an expand button', () => {
		render(
			<ImpactCard
				lastEventAt="2026-05-28T08:00:00Z"
				subtitle="181 saves and 90 playlists"
				title="Saves & Playlists"
				totalCount={{ saves: 181, playlists: 90 }}
				variant="saves"
			/>
		);

		expect(screen.getByText('181')).toBeVisible();
		expect(screen.getByText('Saved by viewers')).toBeVisible();
		expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
	});

	it('renders YYYY-MM-DD summary dates as the same calendar day regardless of timezone', () => {
		render(
			<ImpactCard
				label="University Courses"
				lastReportedAt="2026-02-14"
				subtitle="Used in 14 university courses"
				title="Academic Usage"
				totalCount={14}
				variant="academic"
			/>
		);

		expect(screen.getByText('Feb 14, 2026')).toBeVisible();
	});
});
