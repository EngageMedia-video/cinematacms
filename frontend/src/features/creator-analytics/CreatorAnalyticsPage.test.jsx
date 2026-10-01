import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
	beforeEach(() => window.history.replaceState(null, '', '/analytics'));
	it('offers segment figures only when there is coverage data', async () => {
		const user = userEvent.setup();
		const filmData = { ...data, selected_media: { ...data.rows[0], uid: 'film-id', media_type: 'video' } };
		const { rerender } = render(
			<CreatorAnalyticsPage
				data={{ ...filmData, measurement: { ...data.measurement, measured_plays: 0, retention: [] } }}
			/>
		);
		await user.click(screen.getByRole('tab', { name: 'Viewing details' }));
		expect(screen.getByText('No measured plays in this period.')).toBeInTheDocument();
		expect(screen.queryByText('View segment coverage figures')).not.toBeInTheDocument();
		rerender(<CreatorAnalyticsPage data={filmData} />);
		await user.click(screen.getByText('View segment coverage figures'));
		expect(screen.getByText(`0–5%: ${data.measurement.retention[0]}%`)).toBeVisible();
	});

	it('explains data that cannot be matched to a film version when selected', () => {
		const filmData = {
			...data,
			selected_media: { ...data.rows[0], uid: 'film-id', media_type: 'video' },
			versions: [
				{ value: 'all', label: 'All versions' },
				{ value: 'unknown', label: 'Data without a film version' },
			],
			version: 'unknown',
		};
		const { rerender } = render(<CreatorAnalyticsPage data={filmData} />);
		expect(
			screen.getByRole('button', { name: 'Film version: Data without a film version' })
		).toHaveAccessibleDescription(
			'We can’t tell which film version these views and plays belong to. All versions includes them.'
		);
		rerender(<CreatorAnalyticsPage data={{ ...filmData, version: 'all' }} />);
		expect(screen.queryByText(/We can’t tell which film version/)).not.toBeInTheDocument();
	});

	it('uses keyboard-accessible menus for film versions and CSV exports', async () => {
		const user = userEvent.setup();
		render(
			<CreatorAnalyticsPage
				data={{
					...data,
					selected_media: { ...data.rows[0], uid: 'film-id', media_type: 'video' },
					versions: [
						{ value: 'all', label: 'All versions' },
						{ value: data.version, label: 'Version 2 - Current' },
						{ value: 'previous-id', label: 'Version 1' },
						{ value: 'unknown', label: 'Data without a film version' },
					],
				}}
			/>
		);

		const version = screen.getByRole('button', { name: 'Film version: Version 2 - Current' });
		version.focus();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Version 2 - Current' })).toHaveFocus());
		expect(screen.getByRole('menuitemradio', { name: 'All versions' })).toBeInTheDocument();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Version 1' })).toHaveFocus());
		await user.keyboard('{Escape}');
		await waitFor(() => expect(version).toHaveFocus());
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Export CSV' }));
		for (const name of ['Summary', 'Daily', 'Segment coverage', 'Engagement']) {
			expect(screen.getByRole('menuitemradio', { name })).toBeInTheDocument();
		}
	});

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
		expect(screen.getByRole('group', { name: 'Daily watch time chart' })).toBeInTheDocument();
		expect(screen.queryByRole('slider')).not.toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Your media' })).toBeInTheDocument();
		expect(screen.getByText('Average film coverage')).toBeInTheDocument();
		expect(screen.getByText('Starts after interaction')).toBeInTheDocument();
		expect(screen.queryByText('Completion rate')).not.toBeInTheDocument();
		await user.click(screen.getByText('View daily figures'));
		expect(screen.getByText('2026-09-28')).toBeInTheDocument();
		expect(screen.getAllByRole('row')[1]).toHaveTextContent('2026-09-28');
		await user.click(screen.getByRole('tab', { name: 'Your media' }));
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
		await user.click(screen.getByRole('tab', { name: 'Your media' }));
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '?days=90&page=3#media');
		expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '?days=90&page=1#media');
	});

	it('explains empty activity and keeps new engagement events visible', async () => {
		const user = userEvent.setup();
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
		expect(screen.queryByRole('group', { name: 'Daily watch time chart' })).not.toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: 'Your media' }));
		expect(screen.getByText('No media yet')).toBeVisible();
		await user.click(screen.getByRole('tab', { name: 'Engagement' }));
		expect(screen.getByText('New Feature Action')).toBeVisible();
	});

	it('shows one media and keeps its selection when changing the range or retrying', async () => {
		const user = userEvent.setup();
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
			'/analytics?days=30#media'
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
		expect(screen.getByRole('tab', { name: 'Engagement' })).toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: 'Viewing details' }));
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
		).toHaveAttribute('href', '/analytics?days=30#media');
		expect(screen.queryByRole('link', { name: 'Try again' })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Refresh figures' })).toHaveAttribute(
			'href',
			`?days=30&media=${selected_media.uid}&version=${data.version}#details`
		);
	});

	it('keeps CMS metrics and owned media available without substituting Umami counts', async () => {
		const user = userEvent.setup();
		render(<CreatorAnalyticsPage data={{ ...data, unavailable: true }} />);

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.queryByText(/Umami event figures unavailable/)).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Try again' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Viewing time' })).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Daily watch time chart' })).toBeInTheDocument();
		expect(screen.getByText('Current media totals')).toBeVisible();
		expect(screen.queryByRole('tab', { name: 'Engagement' })).not.toBeInTheDocument();
		await user.click(screen.getByText('Current media totals'));
		expect(screen.getByText('999')).toBeVisible();
		await user.click(screen.getByRole('tab', { name: 'Your media' }));
		expect(screen.getByRole('heading', { name: 'Your media' })).toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: 'My private film' })[0]).toHaveAttribute(
			'href',
			data.rows[0].analytics_url
		);
		expect(screen.queryByRole('columnheader', { name: 'Media views' })).not.toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Legacy views (all time)' })).toBeInTheDocument();
	});

	it('navigates report sections by keyboard and retains the section in date links', async () => {
		const user = userEvent.setup();
		render(<CreatorAnalyticsPage data={data} />);
		expect(screen.queryByRole('heading', { name: 'Your media' })).not.toBeInTheDocument();
		screen.getByRole('tab', { name: 'Overview' }).focus();
		await user.keyboard('{ArrowRight}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Your media' })).toHaveFocus());
		expect(screen.getByRole('tabpanel', { name: 'Your media' })).toBeVisible();
		expect(window.location.hash).toBe('#media');
		expect(screen.getByRole('link', { name: '90 days' })).toHaveAttribute('href', '?days=90#media');
		await user.keyboard('{End}');
		expect(screen.getByRole('tabpanel', { name: 'Engagement' })).toBeVisible();
		expect(screen.getByText('Like')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Refresh figures' })).toHaveAttribute('href', '?days=30#engagement');
	});

	it('opens bookmarked film details and falls back when a section is unavailable', () => {
		window.history.replaceState(null, '', '/analytics#details');
		const { unmount } = render(
			<CreatorAnalyticsPage
				data={{ ...data, selected_media: { ...data.rows[0], uid: 'film-id', media_type: 'video' } }}
			/>
		);
		expect(screen.getByRole('tabpanel', { name: 'Viewing details' })).toBeVisible();
		expect(screen.getByRole('group', { name: 'Film segment coverage chart' })).toBeVisible();
		expect(screen.getByRole('link', { name: '7 days' })).toHaveAttribute(
			'href',
			`?days=7&media=film-id&version=${data.version}#details`
		);
		unmount();
		window.history.replaceState(null, '', '/analytics#engagement');
		render(<CreatorAnalyticsPage data={{ ...data, unavailable: true }} />);
		expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('group', { name: 'Daily watch time chart' })).toBeVisible();
	});

	it('explains missing traffic details for nonplayable media', async () => {
		const user = userEvent.setup();
		render(
			<CreatorAnalyticsPage
				data={{ ...data, selected_media: { ...data.rows[0], uid: 'image-id', media_type: 'image' } }}
			/>
		);
		await user.click(screen.getByRole('tab', { name: 'Traffic details' }));
		expect(screen.getByRole('heading', { name: 'No traffic details yet' })).toBeVisible();
		expect(screen.queryByRole('tab', { name: 'Viewing details' })).not.toBeInTheDocument();
	});

	it('explains viewing units and keeps dates visible in CMS-only reports', async () => {
		const user = userEvent.setup();
		render(<CreatorAnalyticsPage data={{ ...data, unavailable: true }} />);
		expect(screen.getByText('28 Sept – 28 Sept 2026 · UTC')).toBeInTheDocument();
		const viewing = screen.getByRole('region', { name: 'Viewing time' });
		expect(within(viewing).getByText('5 min')).toBeInTheDocument();
		expect(within(viewing).getByText('2 min 30 sec')).toBeInTheDocument();
		await user.click(screen.getByText('How viewing is measured'));
		expect(screen.getByText(/Rewatching adds watch time/)).toBeVisible();
		expect(screen.queryByRole('group', { name: 'Chart metric' })).not.toBeInTheDocument();
		const filters = screen.getByRole('group', { name: 'Report filters' });
		expect(within(filters).getByRole('link', { name: '90 days' })).toHaveAttribute('href', '?days=90');
	});

	it('does not present playback metrics for an image without event reports', () => {
		const { rerender } = render(
			<CreatorAnalyticsPage
				data={{
					...data,
					unavailable: true,
					selected_media: { ...data.rows[0], uid: 'image-id', media_type: 'image' },
				}}
			/>
		);
		expect(screen.queryByText('Measured plays')).not.toBeInTheDocument();
		expect(screen.queryByRole('group', { name: /chart/ })).not.toBeInTheDocument();
		expect(screen.getByText('Current media totals')).toBeVisible();
		rerender(
			<CreatorAnalyticsPage
				data={{ ...data, selected_media: { ...data.rows[0], uid: 'image-id', media_type: 'image' } }}
			/>
		);
		expect(screen.getByRole('heading', { name: 'Media views' })).toBeInTheDocument();
		expect(screen.queryByText('Playback starts')).not.toBeInTheDocument();
		expect(screen.queryByText('Measured plays')).not.toBeInTheDocument();
	});

	it('uses understandable labels for player context and errors', async () => {
		const user = userEvent.setup();
		render(
			<CreatorAnalyticsPage
				data={{
					...data,
					selected_media: { ...data.rows[0], uid: 'film-id', media_type: 'video' },
					contexts: [['embed', 3]],
					initiations: [['unknown', 2]],
					errors: [['media_3', 1]],
				}}
			/>
		);
		await user.click(screen.getByRole('tab', { name: 'Viewing details' }));
		expect(screen.getByText('Embedded player')).toBeInTheDocument();
		expect(screen.getByText('Playback source not captured')).toBeInTheDocument();
		expect(screen.getByText('Media decoding error')).toBeInTheDocument();
		expect(screen.queryByText('media_3')).not.toBeInTheDocument();
	});

	it.each([
		[0, '0 sec'],
		[3661, '1 hr 1 min 1 sec'],
	])('shows explicit watch-time units for %s seconds', (seconds, label) => {
		render(
			<CreatorAnalyticsPage
				data={{ ...data, unavailable: true, measurement: { ...data.measurement, watch_seconds: seconds } }}
			/>
		);
		expect(within(screen.getByRole('region', { name: 'Viewing time' })).getByText(label)).toBeInTheDocument();
	});
});
