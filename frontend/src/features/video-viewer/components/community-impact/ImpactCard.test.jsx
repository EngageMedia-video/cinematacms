import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ImpactCard } from './ImpactCard';

const entries = [
	{ title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
	{ title: '2026 Film Festival, Dakar', date: '2025-02-15', url: 'https://example.com/dakar' },
	{ title: 'Jakarta Mutual Aid Screening', date: '2025-03-08', url: 'https://example.com/jakarta' },
	{ title: 'Berlin Solidarity Cinema', date: '2025-04-12', url: 'https://example.com/berlin' },
];

describe('ImpactCard', () => {
	it('renders the preview list and opens a modal with the full list', async () => {
		const user = userEvent.setup();

		render(<ImpactCard entries={entries} subtitle="This film has been screened 8x" title="Screened In" />);

		expect(screen.getByLabelText('Screened In')).toBeVisible();
		expect(screen.getByText('Manila Community Film Night')).toBeVisible();

		const toggle = screen.getByRole('button', { name: 'Open Screened In details' });
		expect(toggle).toHaveAttribute('aria-haspopup', 'dialog');
		expect(toggle.querySelector('svg')).toHaveAttribute('data-icon', 'arrowsOutSimple');

		await user.click(toggle);

		const dialog = screen.getByRole('dialog');
		expect(dialog).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Screened In' })).toBeVisible();
		expect(screen.getAllByText('Berlin Solidarity Cinema').length).toBeGreaterThan(0);
	});

	it('applies a max-height and scroll when more than three entries', () => {
		render(<ImpactCard entries={entries} subtitle="This film has been screened 8x" title="Screened In" />);

		const list = screen.getByLabelText('Screened In').querySelector('ul');
		expect(list?.className).toMatch(/overflow-y-auto/);
		expect(list?.className).toMatch(/max-h-/);
	});

	it('does not scroll when there are three or fewer entries', () => {
		render(
			<ImpactCard entries={entries.slice(0, 2)} subtitle="This film has been screened 2x" title="Screened In" />
		);

		const list = screen.getByLabelText('Screened In').querySelector('ul');
		expect(list?.className).not.toMatch(/overflow-y-auto/);
	});

	it('shows summary entry as the preview for saves cards', () => {
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
		expect(screen.getByText('90')).toBeVisible();
		expect(screen.getByText('Last Saved')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Open Saves & Playlists details' })).toBeVisible();
	});

	it('renders academic summary cards as the same timeline structure', () => {
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

		expect(screen.getByText('Academic Usage')).toBeVisible();
		expect(screen.getByText('14')).toHaveClass('text-text-accent');
		expect(screen.getByText('Last Reported')).toBeVisible();
	});
});
