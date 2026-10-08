import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImpactFilmGroup } from './ImpactFilmGroup';

const media = { title: 'Tide Lines', url: 'https://example.com/view?m=abc', views: 12 };

describe('ImpactFilmGroup', () => {
	it('lists entries from the new impact categories with their context and year', () => {
		render(
			<ImpactFilmGroup
				film={{
					media,
					impact: {
						award: {
							entries: [
								{
									uid: 'award-1',
									category: 'award',
									title: 'Best Documentary',
									year: 2021,
									event_date: '2026-10-03',
									award_result_label: 'Won',
									organiser: 'Jogja-NETPAC',
								},
							],
						},
						teaching: {
							entries: [
								{
									uid: 'teaching-1',
									category: 'teaching',
									title: 'Media and Climate Justice',
									year: 2025,
									event_date: '2026-10-04',
									creator: 'Dr. Maria Santos',
								},
							],
						},
					},
				}}
			/>
		);

		expect(screen.getByRole('heading', { name: 'Awards & Recognition' })).toBeVisible();
		expect(screen.getByText('Best Documentary')).toBeVisible();
		expect(screen.getByText('Won · Given by Jogja-NETPAC')).toBeVisible();
		expect(screen.getByText('2021')).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Taught & Researched In' })).toBeVisible();
		expect(screen.getByText('Led by Dr. Maria Santos')).toBeVisible();
		expect(screen.queryByText('Oct 3, 2026')).not.toBeInTheDocument();
	});

	it('keeps the full reported date for legacy entries', () => {
		render(
			<ImpactFilmGroup
				film={{
					media,
					impact: {
						featured: {
							entries: [{ uid: 'featured-1', title: 'Regional roundup', event_date: '2025-04-20' }],
						},
					},
				}}
			/>
		);

		expect(screen.getByText('Regional roundup')).toBeVisible();
		expect(screen.getByText('Apr 20, 2025')).toBeVisible();
	});
});
