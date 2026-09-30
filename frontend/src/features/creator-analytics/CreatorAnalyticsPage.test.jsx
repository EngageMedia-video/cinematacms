import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CreatorAnalyticsPage } from './CreatorAnalyticsPage';

const data = {
	unavailable: false,
	days: 30,
	ranges: [7, 30, 90, 365],
	versions: [],
	version: '00000000-0000-4000-8000-000000000002',
	media_views: 12,
	deliberate_starts: 5,
	measurement: {
		watch_seconds: 300,
		measured_plays: 2,
		average_watch_seconds: 150,
		average_percent_watched: 40,
		retention: Array(20).fill(40),
		daily_watch_seconds: { '2026-09-28': 300 },
	},
	cms_totals: { legacy_views: 999, likes: 5, comments: 2 },
	comparison: {
		media_views: 6,
		starts: 4,
		finishes: 2,
		deliberate_starts: 3,
		completion_rate: 50,
		watch_seconds: 120,
		measured_plays: 1,
	},
	totals: { playback_start: 8, progress_25: 7, progress_50: 6, progress_75: 5, finish: 4 },
	completion_rate: 50,
	daily: [
		{
			date: '2026-09-27',
			media_views: 0,
			media_views_percent: 0,
			playback_start: 0,
			playback_start_percent: 0,
			finish: 0,
			finish_percent: 0,
		},
		{
			date: '2026-09-28',
			media_views: 12,
			media_views_percent: 100,
			playback_start: 8,
			playback_start_percent: 100,
			finish: 4,
			finish_percent: 100,
		},
	],
	engagement: [['Like', 3]],
	rows: [
		{
			title: 'My private film',
			state: 'Private',
			url: '/view?m=private',
			analytics_url: '?media=00000000-0000-4000-8000-000000000001&days=30',
			views: 12,
			starts: 8,
			finishes: 4,
			completion_rate: 50,
			legacy_views: 999,
			measured_plays: 2,
			watch_seconds: 300,
		},
	],
	pagination: { number: 1, count: 1, previous: null, next: null },
};

describe('CreatorAnalyticsPage', () => {
	it('shows owner counts, UTC trend, and media state', async () => {
		const user = userEvent.setup();
		render(<CreatorAnalyticsPage data={data} />);

		expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
		const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
		expect(within(breadcrumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
		expect(within(breadcrumb).getByText('Analytics')).toHaveAttribute('aria-current', 'page');
		expect(within(breadcrumb).queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Back to profile/ })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: '30 days' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('group', { name: 'Daily media views chart' })).toBeInTheDocument();
		expect(screen.queryByRole('slider')).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Your media' })).toBeInTheDocument();
		expect(screen.getByText('Average film coverage')).toBeInTheDocument();
		expect(screen.getByText('Starts after interaction')).toBeInTheDocument();
		expect(screen.queryByText('Completion rate')).not.toBeInTheDocument();
		await user.click(screen.getByText('View daily figures'));
		expect(screen.getByText('2026-09-28')).toBeInTheDocument();
		expect(screen.getAllByRole('row')[1]).toHaveTextContent('2026-09-28');
		expect(screen.getAllByRole('link', { name: 'My private film' })[0]).toHaveAttribute(
			'href',
			data.rows[0].analytics_url
		);
		expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
	});

	it('switches the plotted metric and preserves the date range during pagination', async () => {
		const user = userEvent.setup();
		render(
			<CreatorAnalyticsPage
				data={{ ...data, days: 90, pagination: { number: 2, count: 3, previous: 1, next: 3 } }}
			/>
		);
		await user.click(screen.getByRole('button', { name: 'Reached end' }));
		expect(screen.getByRole('button', { name: 'Reached end' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('group', { name: 'Daily reached end chart' })).toBeInTheDocument();
		expect(screen.queryByRole('slider')).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '?days=90&page=3');
		expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '?days=90&page=1');
	});

	it('explains empty activity and keeps new engagement events visible', () => {
		render(
			<CreatorAnalyticsPage
				data={{
					...data,
					media_views: 0,
					totals: { playback_start: 0, finish: 0 },
					completion_rate: 0,
					daily: [],
					rows: [],
					engagement: [['New Feature Action', 2]],
				}}
			/>
		);
		expect(screen.getByText('No activity in this period')).toBeInTheDocument();
		expect(screen.getByText('No media yet')).toBeInTheDocument();
		expect(screen.getByText('New Feature Action')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Daily media views chart' })).not.toBeInTheDocument();
	});

	it('shows one media and keeps its selection when changing the range or retrying', () => {
		const selected_media = {
			...data.rows[0],
			uid: '00000000-0000-4000-8000-000000000001',
			media_type: 'video',
			duration: 125,
			thumbnail_url: '/media/film.jpg',
		};
		const { rerender } = render(<CreatorAnalyticsPage data={{ ...data, rows: [], selected_media }} />);
		expect(screen.getByRole('heading', { name: 'My private film' })).toBeInTheDocument();
		const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
		expect(within(breadcrumb).getAllByRole('listitem')).toHaveLength(3);
		expect(within(breadcrumb).getByRole('link', { name: 'Analytics' })).toHaveAttribute(
			'href',
			'/analytics?days=30'
		);
		expect(within(breadcrumb).getByText('My private film')).toHaveAttribute('aria-current', 'page');
		expect(within(breadcrumb).queryByRole('link', { name: 'My private film' })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open media' })).toHaveAttribute('href', '/view?m=private');
		expect(screen.getByRole('link', { name: '7 days' })).toHaveAttribute(
			'href',
			`?days=7&media=${selected_media.uid}&version=${data.version}`
		);
		expect(screen.queryByRole('heading', { name: 'Your media' })).not.toBeInTheDocument();
		expect(screen.queryByText('No media yet')).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Engagement' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Coverage by film segment' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Film segment coverage chart' })).toBeInTheDocument();
		expect(screen.getByText('Video · 2:05')).toBeInTheDocument();
		const milestones = screen.getByRole('region', { name: 'Playback milestones' });
		expect(within(milestones).getByText('Reached 25%').parentElement).toHaveTextContent('7');
		expect(within(milestones).getByText('Reached 50%').parentElement).toHaveTextContent('6');
		expect(within(milestones).getByText('Reached 75%').parentElement).toHaveTextContent('5');
		rerender(
			<CreatorAnalyticsPage
				data={{ ...data, rows: [], selected_media: { ...selected_media, media_type: 'image' } }}
			/>
		);
		expect(screen.queryByRole('region', { name: 'Playback milestones' })).not.toBeInTheDocument();
		rerender(<CreatorAnalyticsPage data={{ ...data, rows: [], selected_media, unavailable: true }} />);
		expect(
			within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Analytics' })
		).toHaveAttribute('href', '/analytics?days=30');
		expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
			'href',
			`?days=30&media=${selected_media.uid}&version=${data.version}`
		);
	});

	it('keeps CMS metrics and owned media available without substituting Umami counts', () => {
		render(<CreatorAnalyticsPage data={{ ...data, unavailable: true }} />);

		expect(screen.getByRole('status')).toHaveTextContent('Umami event figures unavailable');
		expect(screen.getByRole('heading', { name: 'Viewing time' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Current media totals' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Your media' })).toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: 'My private film' })[0]).toHaveAttribute(
			'href',
			data.rows[0].analytics_url
		);
		expect(screen.queryByRole('columnheader', { name: 'Views' })).not.toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Legacy views (all time)' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Daily watch time (seconds) chart' })).toBeInTheDocument();
	});
});
