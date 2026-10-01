import { useEffect, useState } from 'react';
import {
	Badge,
	DataTable,
	LineChart,
	Pagination,
	Button,
	Card,
	Disclosure,
	Dropdown,
	Icon,
	Link,
	SegmentButton,
	SquareImage,
	Statistic,
	TabContent,
	TabView,
	Text,
	Tooltip,
} from '../shared/components';
import { formatRelativeTime } from '../shared/utils/formatRelativeTime';
import { formatDuration } from '../shared/utils/formatDuration';

const number = new Intl.NumberFormat('en');
// These are local calendar-day keys, not instants; format without shifting the date again.
const dateLabel = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const metrics = [
	{ key: 'media_views', label: 'Media views', color: 'secondary' },
	{ key: 'playback_start', label: 'Playback starts', color: 'primary' },
	{ key: 'finish', label: 'Reached end', color: 'success' },
];
const watchMetrics = [{ key: 'watch_seconds', label: 'Watch time', color: 'primary' }];
const activityMetrics = [...watchMetrics, ...metrics];
const contextLabels = { page: 'Media page', embed: 'Embedded player', hero: 'Homepage player' };
const initiationLabels = {
	deliberate: 'After viewer interaction',
	autoplay: 'Autoplay',
	unknown: 'Playback source not captured',
};
const errorLabels = {
	media_1: 'Playback aborted',
	media_2: 'Network error',
	media_3: 'Media decoding error',
	media_4: 'Unsupported media',
	other: 'Other player errors',
};

function comparisonLabel(current, previous) {
	if (typeof previous !== 'number') return null;
	if (!previous) return current ? 'No earlier events recorded' : null;
	const change = Math.round(((current - previous) / previous) * 100);
	return `${change > 0 ? '+' : ''}${change}% vs equal-length period`;
}

function watchTimeLabel(seconds) {
	const total = Math.floor(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const remainder = total % 60;
	return (
		[hours && `${hours} hr`, minutes && `${minutes} min`, remainder && `${remainder} sec`]
			.filter(Boolean)
			.join(' ') || '0 sec'
	);
}

function ActivityChart({ daily, height = 220, metricSet = metrics, incompleteWatchTime = false }) {
	const [metricIndex, setMetricIndex] = useState(0);
	const metric = metricSet[metricIndex] || metricSet[0];
	const incomplete = incompleteWatchTime && metric.key === 'watch_seconds';
	const metricOptions = metricSet.map((item, index) => ({ value: index, label: item.label }));
	const hasActivity = daily.some((day) => day[metric.key] > 0);
	const tickStep = Math.max(1, Math.ceil((daily.length - 1) / 6));
	const tickDates = daily
		.filter((_, index) => index % tickStep === 0 || index === daily.length - 1)
		.map((day) => day.date);

	return (
		<section aria-labelledby="activity-heading" className="min-w-0">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Text as="h2" id="activity-heading" variant="h6-bold" className="m-0 text-text-primary">
					Daily activity
				</Text>
				{metricOptions.length > 1 && (
					<SegmentButton
						aria-label="Chart metric"
						layout="fill"
						className="sm:w-auto [&>button]:min-h-11 [&>button]:px-1 sm:[&>button]:px-4 [&>button>span]:whitespace-normal"
						options={metricOptions}
						value={metricIndex}
						onValueChange={setMetricIndex}
					/>
				)}
				{metricOptions.length === 1 && (
					<Text as="span" variant="body-14" className="m-0">
						{metric.label}
					</Text>
				)}
			</div>
			{hasActivity ? (
				<LineChart
					className="mt-5"
					data={daily}
					xKey="date"
					yKey={metric.key}
					label={`Daily ${metric.label.toLowerCase()} chart`}
					xTicks={tickDates}
					height={height}
					color={metric.color}
					formatX={(date) => shortDate.format(new Date(date))}
					formatY={(value) => `${number.format(value)}${metric.key === 'watch_seconds' ? 's' : ''}`}
					formatTooltipTitle={(date) => dateLabel.format(new Date(date))}
					formatTooltipValue={(value) =>
						metric.key === 'watch_seconds'
							? watchTimeLabel(value)
							: `${number.format(value)} ${metric.label.toLowerCase()}`
					}
				/>
			) : (
				<div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center">
					<Icon name="playCircle" size={40} className="mb-2 text-text-muted" />
					<Text as="h3" variant="h6" className="m-0 text-text-strong">
						{incomplete ? 'No local-day watch time yet' : 'No activity in this period'}
					</Text>
					<Text as="p" variant="body-14" className="m-0 max-w-xs text-text-muted">
						{incomplete
							? 'Older watch time cannot be dated locally. New viewing activity will appear here.'
							: `Your ${metric.label.toLowerCase()} will appear here as viewers engage with your media. Try a longer date range to check for earlier activity.`}
					</Text>
				</div>
			)}
			<Disclosure title="View daily figures" className="mt-4">
				<DataTable
					caption="Daily activity counts in the report timezone, newest first"
					stickyHeader
					className="max-h-72"
					rows={[...daily].reverse()}
					rowKey={(day) => day.date}
					columns={[
						{ key: 'date', label: 'Date', rowHeader: true, render: (day) => day.date },
						...metricSet.map((item) => ({
							key: item.key,
							label: item.label,
							align: 'right',
							render: (day) =>
								item.key === 'watch_seconds'
									? watchTimeLabel(day[item.key])
									: number.format(day[item.key]),
						})),
					]}
				/>
			</Disclosure>
		</section>
	);
}

function Engagement({ items }) {
	const sorted = items.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
	return (
		<Card as="section" aria-labelledby="engagement-heading" className="min-w-0 p-5 sm:p-8">
			<Text as="h2" id="engagement-heading" variant="h6-bold" className="m-0 text-text-primary">
				Engagement
			</Text>
			<Text as="p" variant="body-14" className="mt-2 mb-4 max-w-prose">
				Recorded likes, shares, downloads, comments, and other actions in this period. Repeat actions count.
			</Text>
			{sorted.length ? (
				<dl className="m-0 mt-2 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
					{sorted.map(([label, count]) => (
						<div key={label} className="flex justify-between gap-4 py-2">
							<Text as="dt" variant="body-14" className="text-text-secondary">
								{label}
							</Text>
							<Text as="dd" variant="body-14-medium" className="m-0 tabular-nums">
								{number.format(count)}
							</Text>
						</div>
					))}
				</dl>
			) : (
				<Text as="p" variant="body-14" color="meta" className="mt-4 mb-0">
					No engagement recorded in this period. Try a longer date range to see earlier activity.
				</Text>
			)}
		</Card>
	);
}

function PlaybackMilestones({ totals }) {
	return (
		<Card as="section" aria-labelledby="milestones-heading" className="mt-6 p-5 sm:p-8">
			<Text as="h2" id="milestones-heading" variant="h6-bold" className="m-0 text-text-primary">
				Playback milestones
			</Text>
			<dl className="m-0 mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-5">
				{[
					['Started', 'playback_start'],
					['Reached 25%', 'progress_25'],
					['Reached 50%', 'progress_50'],
					['Reached 75%', 'progress_75'],
					['Reached end', 'finish'],
				].map(([label, key]) => (
					<Statistic key={key} label={label} value={number.format(totals[key] ?? 0)} />
				))}
			</dl>
			<Text as="p" variant="body-12" color="meta" className="mt-2 mb-0 max-w-prose">
				Recorded events in this period, not unique viewers. Seeking and plays spanning dates can affect these
				counts.
			</Text>
		</Card>
	);
}

function MeasuredViewing({ measurement, selectedMedia }) {
	const hasPlays = measurement.measured_plays > 0;
	return (
		<Card as="section" aria-labelledby="viewing-heading" className="p-5 sm:p-8">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<Text as="h2" id="viewing-heading" variant="h6-bold" className="m-0 text-text-primary">
					{selectedMedia ? 'How this film is watched' : 'Viewing time'}
				</Text>
				<Text as="span" variant="body-12" color="meta">
					Measured plays
				</Text>
			</div>
			<dl className="m-0 mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
				<Statistic
					label="Watch time"
					value={
						measurement.watch_time_incomplete && !measurement.watch_seconds
							? '—'
							: watchTimeLabel(measurement.watch_seconds)
					}
					description={
						measurement.watch_time_incomplete
							? 'Time spent actively watching in this period. Older records with only a UTC date cannot be grouped into local days and are excluded.'
							: 'Time spent actively watching in this period.'
					}
				/>
				<Statistic
					label="Measured plays"
					value={number.format(measurement.measured_plays)}
					description="Plays with recorded viewing time, not unique viewers."
				/>
				<Statistic
					label="Average watch time"
					value={
						measurement.average_watch_seconds != null
							? watchTimeLabel(measurement.average_watch_seconds)
							: '—'
					}
					description="Average active watch time per measured play. Replays count."
				/>
				<Statistic
					label="Average film coverage"
					value={hasPlays ? `${measurement.average_percent_watched}%` : '—'}
					description="Average share of a film watched, counting each part once per play."
				/>
			</dl>
			<Disclosure title="How viewing is measured" className="mt-3">
				<Text as="p" className="m-0 max-w-prose">
					Watch time follows when viewing happened. Measured plays and averages use plays started in the
					selected dates. Rewatching adds watch time but does not increase film coverage. Recent plays may
					still be in progress.
				</Text>
			</Disclosure>
		</Card>
	);
}

function FilmCoverage({ measurement }) {
	const hasPlays = measurement.measured_plays > 0;
	const retention = measurement.retention.map((value, index) => ({
		segment: `${index * 5}–${(index + 1) * 5}%`,
		value,
	}));

	return (
		<Card as="section" aria-labelledby="coverage-heading" className="p-5 sm:p-8">
			<Text as="h2" id="coverage-heading" variant="h6-bold" className="m-0 mb-2 text-text-primary">
				Coverage by film segment
			</Text>
			<Text as="p" variant="body-14" color="body" className="m-0 max-w-prose">
				See which parts of the film are watched. Each point shows average coverage of a 5% segment, not the
				number of viewers still watching.
			</Text>
			{hasPlays ? (
				<LineChart
					className="mt-4"
					data={retention}
					xKey="segment"
					yKey="value"
					label="Film segment coverage chart"
					yMax={100}
					xTicks={retention
						.filter((_, index) => [0, 5, 10, 15, 19].includes(index))
						.map((part) => part.segment)}
					formatX={(segment) => (segment.startsWith('95') ? '100%' : `${segment.split('–')[0]}%`)}
					formatY={(value) => `${value}%`}
					formatTooltipTitle={(segment) => `Film segment ${segment}`}
					formatTooltipValue={(value) => `${number.format(value)}% average coverage`}
				/>
			) : (
				<Text as="p" variant="body-14" color="body" className="mt-5 mb-0">
					No measured plays in this period.
				</Text>
			)}
			{retention.length > 0 && (
				<Disclosure title="View segment coverage figures" className="mt-3">
					<ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
						{retention.map((part) => (
							<Text as="li" variant="body-12" key={part.segment}>
								{part.segment}: {part.value}%
							</Text>
						))}
					</ol>
				</Disclosure>
			)}
		</Card>
	);
}

function Breakdown({ title, items, labels = {}, empty = 'No data in this period.' }) {
	return (
		<Card as="section" className="min-w-0 p-5 sm:p-8">
			<Text as="h2" variant="h6-bold" className="m-0 text-text-primary">
				{title}
			</Text>
			{items?.length ? (
				<dl className="m-0 mt-3 space-y-2">
					{items.map(([label, value]) => (
						<div key={label} className="flex justify-between gap-4">
							<Text as="dt" variant="body-14" className="min-w-0 break-words text-text-secondary">
								{labels[label] || label}
							</Text>
							<Text as="dd" variant="body-14" className="m-0 shrink-0 tabular-nums">
								{number.format(value)}
							</Text>
						</div>
					))}
				</dl>
			) : (
				<Text as="p" variant="body-14" color="meta" className="mt-4 mb-0">
					{empty}
				</Text>
			)}
		</Card>
	);
}

function MediaPerformance({ rows, pagination, days, timezoneQuery, eventsAvailable = true }) {
	const pageUrl = (page) => `?days=${days}&page=${page}${timezoneQuery}#media`;
	const columns = eventsAvailable
		? [
				['Media views', (row) => number.format(row.views)],
				['Playback starts', (row) => number.format(row.starts)],
				['Reached end', (row) => number.format(row.finishes)],
				['Watch time', (row) => watchTimeLabel(row.watch_seconds)],
			]
		: [
				['Measured plays', (row) => number.format(row.measured_plays)],
				['Watch time', (row) => watchTimeLabel(row.watch_seconds)],
				['Legacy views (all time)', (row) => number.format(row.legacy_views)],
			];
	return (
		<Card as="section" aria-labelledby="media-heading" className="min-w-0 p-5 sm:p-8">
			<div className="flex flex-wrap items-center justify-between gap-2 pb-4">
				<Text as="h2" id="media-heading" variant="h6-bold" className="m-0 text-text-primary">
					Your media
				</Text>
				<Text as="span" variant="body-12" color="meta" className="m-0">
					{eventsAvailable ? 'Ranked by media views' : 'Newest media first'}
				</Text>
			</div>
			<Text as="p" variant="body-14" className="m-0 mb-4 max-w-prose">
				Open a media title to explore its viewing patterns and engagement.
			</Text>
			{rows.length ? (
				<DataTable
					caption={`Media performance for the last ${days} days`}
					responsive
					rows={rows}
					rowKey={(row) => row.url}
					columns={[
						{
							key: 'media',
							label: 'Media',
							rowHeader: true,
							render: (row) => (
								<div className="max-w-xs">
									<Text
										as={Link}
										action="text-link"
										variant="body-14-medium"
										href={row.analytics_url}
										className="flex min-h-11 items-center break-words text-text-link underline underline-offset-2 hover:text-text-link-hover"
									>
										{row.title}
									</Text>
									<Badge color="bg/chip" className="mt-2 text-text-primary">
										{row.state}
									</Badge>
								</div>
							),
						},
						...columns.map(([label, render]) => ({ key: label, label, render, align: 'right' })),
					]}
				/>
			) : (
				<div className="p-10 text-center">
					<Icon name="myMedia" size={32} className="mx-auto mb-3 text-text-muted" />
					<Text as="h3" variant="h6" className="m-0 text-text-strong">
						No media yet
					</Text>
					<Text as="p" variant="body-14" className="mt-2 mb-0 text-text-muted">
						Once you add media, its performance will appear here.
					</Text>
				</div>
			)}
			{pagination && rows.length > 0 && (
				<Pagination
					page={pagination.number}
					totalPages={pagination.count}
					label="Media pages"
					className="pt-4"
					previousHref={pagination.previous ? pageUrl(pagination.previous) : undefined}
					nextHref={pagination.next ? pageUrl(pagination.next) : undefined}
				/>
			)}
		</Card>
	);
}

export function CreatorAnalyticsPage({ data }) {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), 60000);
		return () => window.clearInterval(timer);
	}, []);
	const reportTimezone = data.timezone || 'UTC';
	const timezoneQuery = `&tz=${encodeURIComponent(reportTimezone)}`;
	const updated = new Date(data.updated_at);
	const updatedLabel = Number.isNaN(updated.getTime())
		? ''
		: updated.toLocaleString(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: reportTimezone,
			});
	const daily = data.daily || [];
	const totals = data.totals || {};
	const reportDates = data.unavailable
		? Object.keys(data.measurement.daily_watch_seconds || {}).sort()
		: daily.map((day) => day.date);
	const firstDate = reportDates[0];
	const lastDate = reportDates[reportDates.length - 1];
	const selectedMedia = data.selected_media;
	const canMeasureViewing = !selectedMedia || ['video', 'audio'].includes(selectedMedia.media_type);
	const viewingDaily = Object.entries(data.measurement.daily_watch_seconds || {})
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, watch_seconds]) => ({ date, watch_seconds }));
	const chartDaily = daily.map((day) => ({
		...day,
		watch_seconds: data.measurement.daily_watch_seconds?.[day.date] || 0,
	}));
	const mediaQuery = selectedMedia
		? `&media=${encodeURIComponent(selectedMedia.uid)}&version=${encodeURIComponent(data.version)}`
		: '';
	const sections = [
		'overview',
		...(!selectedMedia ? ['media'] : canMeasureViewing || !data.unavailable ? ['details'] : []),
		...(!data.unavailable ? ['engagement'] : []),
	];
	const [requestedSection, setRequestedSection] = useState(() => window.location.hash.slice(1));
	const section = sections.includes(requestedSection) ? requestedSection : 'overview';
	const sectionHash = section === 'overview' ? '' : `#${section}`;
	const rangeUrl = (days) => `?days=${days}${mediaQuery}${timezoneQuery}${sectionHash}`;
	const selectSection = (value) => {
		setRequestedSection(value);
		window.history.replaceState(
			window.history.state,
			'',
			`${window.location.pathname}${window.location.search}${value === 'overview' ? '' : `#${value}`}`
		);
	};
	return (
		<div className="min-h-screen bg-bg-page px-4 py-6 text-text-primary sm:px-8 sm:py-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div className="flex w-full min-w-0 items-center gap-4 sm:gap-6 lg:w-auto lg:flex-1">
						{selectedMedia && (
							<div className="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-ds-8 bg-bg-surface-muted sm:w-32">
								<SquareImage
									src={selectedMedia.thumbnail_url}
									alt=""
									aria-hidden
									iconName="myMedia"
									style={{ width: '100%', height: '100%' }}
								/>
							</div>
						)}
						<div className="min-w-0">
							<Text as="h1" variant="h4-bold" className="m-0 break-words text-text-primary">
								{selectedMedia ? selectedMedia.title : 'Analytics'}
							</Text>
							{!selectedMedia && (
								<Text as="p" variant="body-14" className="m-0 mt-2">
									Viewing and engagement across all media you own.
								</Text>
							)}
							{selectedMedia && (
								<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
									<Badge color="bg/chip" className="text-text-primary">
										{selectedMedia.state}
									</Badge>
									<Text as="span" variant="body-12" color="meta">
										{selectedMedia.media_type === 'pdf'
											? 'PDF'
											: selectedMedia.media_type?.replace(/^./, (letter) => letter.toUpperCase())}
										{selectedMedia.duration > 0 && ` · ${formatDuration(selectedMedia.duration)}`}
									</Text>
									<Text
										as={Link}
										action="text-link"
										variant="body-12-medium"
										href={selectedMedia.url}
										className="inline-flex min-h-11 items-center underline underline-offset-2"
									>
										Open media
									</Text>
								</div>
							)}
							{firstDate && lastDate && (
								<Text as="p" variant="body-12" color="meta" className="mt-1 mb-0">
									{shortDate.format(new Date(firstDate))} – {dateLabel.format(new Date(lastDate))} ·{' '}
									{reportTimezone.replaceAll('_', ' ')}
								</Text>
							)}
						</div>
					</div>
					<div className="flex w-full shrink-0 items-center justify-end gap-4 sm:w-auto">
						<Text
							as={Link}
							action="text-link"
							variant="body-14-medium"
							href={rangeUrl(data.days)}
							className="inline-flex min-h-11 items-center"
						>
							Refresh figures
						</Text>
						{selectedMedia ? (
							<Dropdown
								appearance="compact"
								className="[&>div>button]:min-h-11"
								menuClassName="right-0 left-auto w-max max-w-[calc(100vw-2rem)]"
								placeholder="Export CSV"
								value={null}
								options={[
									{ value: 'summary', label: 'Summary' },
									{ value: 'daily', label: 'Daily' },
									{ value: 'retention', label: 'Segment coverage' },
									{ value: 'engagement', label: 'Engagement' },
								]}
								onChange={(dataset) => {
									window.location.href = `/analytics/export?days=${data.days}${mediaQuery}${timezoneQuery}&dataset=${dataset}`;
								}}
							/>
						) : (
							<Text
								as={Link}
								action="text-link"
								variant="body-14-medium"
								className="inline-flex min-h-11 items-center underline underline-offset-2"
								href={`/analytics/export?days=${data.days}${timezoneQuery}&dataset=portfolio`}
							>
								Export CSV
							</Text>
						)}
					</div>
				</header>
				<div
					className="mb-6 flex flex-wrap items-end justify-between gap-3"
					role="group"
					aria-label="Report filters"
				>
					<div className="min-w-0">
						<Text as="p" variant="body-14-medium" className="m-0 mb-2">
							Date range
						</Text>

						<div className="min-w-0">
							<TabView
								aria-label="Date range"
								selectedTab={String(data.days)}
								tabMode="wrap"
								className="max-w-full"
								listClassName="rounded-ds-8"
								triggerClassName="px-2 py-3 no-underline aria-[current=page]:bg-brand-primary sm:px-4"
							>
								{data.ranges.map((range) => (
									<TabContent
										key={range}
										value={String(range)}
										title={
											<Text
												as="span"
												variant="body-12-bold"
												className={
													range === data.days ? 'text-btn-text' : 'text-text-on-chrome'
												}
											>
												{range} days
											</Text>
										}
										href={rangeUrl(range)}
									/>
								))}
							</TabView>
						</div>
					</div>

					{selectedMedia && data.versions.length > 1 && (
						<div className="flex w-full max-w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
							<Text as="span" variant="body-12" color="meta">
								Film version
							</Text>
							<Dropdown
								appearance="compact"
								className="[&>div>button]:min-h-11"
								menuClassName="right-0 left-auto w-max max-w-[calc(100vw-2rem)]"
								label="Film version"
								aria-describedby={data.version === 'unknown' ? 'film-version-help' : undefined}
								value={data.version}
								options={data.versions}
								onChange={(version) => {
									window.location.href = `?days=${data.days}&media=${encodeURIComponent(selectedMedia.uid)}&version=${encodeURIComponent(version)}${timezoneQuery}${sectionHash}`;
								}}
							/>
						</div>
					)}
				</div>
				{selectedMedia && data.version === 'unknown' && (
					<Text as="p" id="film-version-help" variant="body-14" color="body" className="m-0 mb-5 max-w-2xl">
						We can’t tell which film version these views and plays belong to. All versions includes them.
					</Text>
				)}
				{data.measurement.watch_time_incomplete && (
					<Text as="p" variant="body-14" className="mb-5 max-w-prose">
						Watch time is incomplete for older activity. Average watch time is unavailable.
					</Text>
				)}

				<TabView
					aria-label="Analytics sections"
					selectedTab={section}
					onSelectedTabChange={selectSection}
					hideTabList={sections.length === 1}
					listClassName="rounded-none bg-transparent border-b border-border-divider"
					triggerClassName="min-w-0 min-h-11 whitespace-normal px-2 py-3 normal-case tracking-normal bg-transparent text-text-secondary border-b-2 border-transparent aria-selected:border-text-link aria-selected:text-text-link focus-visible:ring-offset-bg-page"
					panelClassName="mt-6 focus:outline-none"
				>
					<TabContent value="overview" title="Overview">
						{canMeasureViewing && (
							<MeasuredViewing measurement={data.measurement} selectedMedia={selectedMedia} />
						)}
						{(canMeasureViewing || !data.unavailable) && (
							<Card as="div" className="mt-6 p-5 sm:p-8">
								<ActivityChart
									incompleteWatchTime={data.measurement.watch_time_incomplete}
									daily={data.unavailable ? viewingDaily : chartDaily}
									height={260}
									metricSet={
										data.unavailable
											? watchMetrics
											: canMeasureViewing
												? activityMetrics
												: [metrics[0]]
									}
								/>
							</Card>
						)}
						{!data.unavailable && (
							<Card as="div" className="mt-6 p-5 sm:p-8">
								<section aria-labelledby="summary-heading">
									<Text as="h2" id="summary-heading" variant="h6-bold" className="m-0">
										{canMeasureViewing ? 'Views and playback events' : 'Media views'}
									</Text>
									<dl
										aria-label="Summary"
										className={`m-0 mt-3 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4 ${selectedMedia && canMeasureViewing ? 'xl:grid-cols-5' : ''}`}
									>
										<Statistic
											label="Media views"
											description="Media page and embed loads. Repeat loads count."
											value={number.format(data.media_views)}
											comparison={comparisonLabel(data.media_views, data.comparison?.media_views)}
										/>
										{canMeasureViewing && (
											<>
												<Statistic
													label="Starts after interaction"
													description="Playback started after a player action or on-site navigation."
													value={number.format(data.deliberate_starts)}
													comparison={comparisonLabel(
														data.deliberate_starts,
														data.comparison?.deliberate_starts
													)}
												/>
												<Statistic
													label="Playback starts"
													description="Start events, including autoplay and repeat plays."
													value={number.format(totals.playback_start)}
													comparison={comparisonLabel(
														totals.playback_start,
														data.comparison?.starts
													)}
												/>
												<Statistic
													label="Reached end"
													description="End events. A seek to the end also counts."
													value={number.format(totals.finish)}
													comparison={comparisonLabel(
														totals.finish,
														data.comparison?.finishes
													)}
												/>
												{selectedMedia && (
													<Statistic
														label="Starts per page/embed load"
														description="Start events divided by loads. Repeat starts can put this above 100%."
														value={
															data.start_per_load == null
																? '—'
																: `${data.start_per_load}%`
														}
													/>
												)}
											</>
										)}
									</dl>
									{canMeasureViewing && (
										<Disclosure
											title="How playback events differ from measured plays"
											className="mt-3"
										>
											<Text as="p" className="m-0 max-w-prose">
												These counts come from Umami events. Viewing time comes from CMS
												playback measurements, so playback starts and measured plays may differ.
												Neither is a unique viewer count. Comparisons use the same elapsed time
												in the previous period.
											</Text>
										</Disclosure>
									)}
								</section>
							</Card>
						)}
					</TabContent>
					{!selectedMedia && (
						<TabContent value="media" title="Your media">
							<MediaPerformance
								rows={data.rows}
								pagination={data.pagination}
								days={data.days}
								timezoneQuery={timezoneQuery}
								eventsAvailable={!data.unavailable}
							/>
						</TabContent>
					)}
					{selectedMedia && (canMeasureViewing || !data.unavailable) && (
						<TabContent value="details" title={canMeasureViewing ? 'Viewing details' : 'Traffic details'}>
							{canMeasureViewing && <FilmCoverage measurement={data.measurement} />}
							{!canMeasureViewing && ![data.contexts, data.referrers].some((items) => items?.length) && (
								<Card className="p-5 sm:p-8">
									<Text as="h2" variant="h6-bold" className="m-0">
										No traffic details yet
									</Text>
									<Text as="p" className="mt-2 mb-0">
										Traffic sources will appear here when recorded. Try a longer date range for
										earlier activity.
									</Text>
								</Card>
							)}
							{!data.unavailable && (
								<>
									{canMeasureViewing && <PlaybackMilestones totals={totals} />}
									{selectedMedia &&
										[data.contexts, data.initiations, data.referrers, data.errors].some(
											(items) => items?.length
										) && (
											<div className="mt-6 grid gap-5 md:grid-cols-2">
												{!!data.contexts?.length && (
													<Breakdown
														title="Where viewing happened"
														items={data.contexts}
														labels={contextLabels}
													/>
												)}
												{!!data.initiations?.length && (
													<Breakdown
														title="How playback began"
														items={data.initiations}
														labels={initiationLabels}
													/>
												)}
												{!!data.referrers?.length && (
													<Breakdown title="Referral domains" items={data.referrers} />
												)}
												{!!data.errors?.length && (
													<Breakdown
														title="Player errors"
														items={data.errors}
														labels={errorLabels}
													/>
												)}
											</div>
										)}
								</>
							)}
						</TabContent>
					)}
					{!data.unavailable && (
						<TabContent value="engagement" title="Engagement">
							<Engagement items={data.engagement || []} />
						</TabContent>
					)}
				</TabView>
				<Card as="footer" aria-label="Report information" className="mt-6 p-5 sm:p-8">
					{data.cms_totals && (
						<Disclosure title="Current media totals" open={!canMeasureViewing && data.unavailable}>
							<Text as="p" variant="body-14" className="mt-2 mb-0 max-w-prose">
								From the CMS database, across all versions. These totals do not follow the date range.
								Legacy views use the existing media counter, not page views or playback starts.
							</Text>
							<dl className="m-0 mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
								<Statistic
									label="Legacy views (all time)"
									value={number.format(data.cms_totals.legacy_views)}
								/>
								<Statistic label="Current likes" value={number.format(data.cms_totals.likes)} />
								<Statistic label="Current comments" value={number.format(data.cms_totals.comments)} />
							</dl>
						</Disclosure>
					)}
					<Disclosure title="About these figures" className="mt-2">
						<Text as="p" variant="body-14" className="m-0 max-w-prose">
							Only you can see these reports. They cover media you currently own in every visibility
							state. Days follow {reportTimezone.replaceAll('_', ' ')}. Recorded activity is retained for
							up to 12 months. A zero count may mean tracking had not started or no eligible activity was
							recorded.
						</Text>
					</Disclosure>
					{updatedLabel && (
						<div className="mt-4">
							<Tooltip
								trigger="click"
								placement="top"
								content={`${updatedLabel} · ${reportTimezone.replaceAll('_', ' ')}`}
							>
								<Button
									variant="text"
									className="min-h-11 p-0 normal-case text-text-muted"
									aria-label="Report update time"
								>
									<Text as="time" dateTime={data.updated_at} variant="body-12" color="meta">
										Updated {formatRelativeTime(data.updated_at, now)}
									</Text>
								</Button>
							</Tooltip>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
