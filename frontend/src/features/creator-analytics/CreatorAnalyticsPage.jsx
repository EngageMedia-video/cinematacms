import { useMemo, useState } from 'react';
import { defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import {
	Badge,
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
} from '../shared/components';
import { formatDuration } from '../shared/utils/formatDuration';

const number = new Intl.NumberFormat('en');
const dateLabel = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus';
const metrics = [
	{ key: 'media_views', label: 'Media views', color: 'text-text-secondary' },
	{ key: 'playback_start', label: 'Playback starts', color: 'text-text-link' },
	{ key: 'finish', label: 'Reached end', color: 'text-text-success' },
];
const watchMetrics = [{ key: 'watch_seconds', label: 'Watch time', color: 'text-text-link' }];
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

function ActivityChart({ daily, height = 220, metricSet = metrics }) {
	const [metricIndex, setMetricIndex] = useState(0);
	const metric = metricSet[metricIndex] || metricSet[0];
	const metricOptions = metricSet.map((item, index) => ({ value: index, label: item.label }));
	const hasActivity = daily.some((day) => day[metric.key] > 0);
	const definition = useMemo(() => {
		const maximum = Math.max(1, ...daily.map((day) => day[metric.key]));
		const tickStep = Math.max(1, Math.ceil((daily.length - 1) / 6));
		const tickDates = daily
			.filter((_, index) => index % tickStep === 0 || index === daily.length - 1)
			.map((day) => day.date);
		return defineChart({
			marks: [
				lineY(daily, {
					x: 'date',
					y: metric.key,
					stroke: 'currentColor',
					strokeWidth: 3,
				}),
			],
			scales: {
				x: {
					scale: () => scalePoint().padding(0.2),
					axis: {
						line: false,
						ticks: { values: tickDates, size: 0, format: (date) => shortDate.format(new Date(date)) },
						tickLabels: { fontSize: 14, opacity: 1, thin: true },
					},
				},
				y: {
					scale: scaleLinear().domain([0, maximum]),
					nice: true,
					grid: { strokeOpacity: 0.5 },
					axis: {
						line: false,
						ticks: {
							count: Math.min(4, maximum),
							size: 0,
							format: (value) => `${number.format(value)}${metric.key === 'watch_seconds' ? 's' : ''}`,
						},
						tickLabels: { fontSize: 14, opacity: 1 },
					},
				},
			},
			tooltip: {
				use: tooltip,
				content: (points) => ({
					title: dateLabel.format(new Date(points[0].xValue)),
					rows: [{ label: metric.label, value: number.format(points[0].yValue) }],
				}),
			},
		});
	}, [daily, metric]);

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
				<>
					<div
						role="group"
						aria-label={`Daily ${metric.label.toLowerCase()} chart`}
						className={`mt-5 min-w-0 ${metric.color} [&_svg_text]:fill-text-primary [&_svg_line]:stroke-border-default`}
					>
						<Chart
							definition={definition}
							height={height}
							ariaLabel={`Daily ${metric.label.toLowerCase()} chart`}
							renderTooltipBody={({ points }) =>
								points.length ? (
									<div>
										<Text as="p" variant="body-12" color="meta" className="m-0">
											{dateLabel.format(new Date(points[0].xValue))}
										</Text>
										<Text
											as="p"
											variant="body-14-medium"
											className="m-0 tabular-nums text-text-primary"
										>
											{metric.key === 'watch_seconds'
												? watchTimeLabel(points[0].yValue)
												: `${number.format(points[0].yValue)} ${metric.label.toLowerCase()}`}
										</Text>
									</div>
								) : null
							}
						/>
					</div>
				</>
			) : (
				<div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center">
					<Icon name="playCircle" size={40} className="mb-2 text-text-muted" />
					<Text as="h3" variant="h6" className="m-0 text-text-strong">
						No activity in this period
					</Text>
					<Text as="p" variant="body-14" className="m-0 max-w-xs text-text-muted">
						Your {metric.label.toLowerCase()} will appear here as viewers engage with your media. Try a
						longer date range to check for earlier activity.
					</Text>
				</div>
			)}
			<Disclosure title="View daily figures" className="mt-4">
				<div
					className={`max-h-72 overflow-auto ${focus}`}
					tabIndex={0}
					role="region"
					aria-label="Daily figures"
				>
					<table className="w-full border-collapse text-right">
						<Text as="caption" variant="body-14" className="sr-only">
							Daily activity counts in UTC, newest first
						</Text>
						<thead className="sticky top-0 border-b border-border-divider bg-bg-surface-muted">
							<tr>
								{['Date (UTC)', ...metricSet.map((item) => item.label)].map((label) => (
									<Text
										as="th"
										variant="body-12-medium"
										key={label}
										scope="col"
										className="px-3 py-3 text-text-secondary"
									>
										{label}
									</Text>
								))}
							</tr>
						</thead>
						<tbody>
							{[...daily].reverse().map((day) => (
								<tr key={day.date} className="hover:bg-bg-surface-muted">
									<Text as="th" variant="body-14" scope="row" className="whitespace-nowrap px-3 py-3">
										{day.date}
									</Text>
									{metricSet.map((item) => (
										<Text
											as="td"
											variant="body-14"
											key={item.key}
											className="px-3 py-3 tabular-nums"
										>
											{item.key === 'watch_seconds'
												? watchTimeLabel(day[item.key])
												: number.format(day[item.key])}
										</Text>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
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
					Measured plays · UTC
				</Text>
			</div>
			<dl className="m-0 mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
				<Statistic
					label="Watch time"
					value={watchTimeLabel(measurement.watch_seconds)}
					description="Time spent actively watching in this period."
				/>
				<Statistic
					label="Measured plays"
					value={number.format(measurement.measured_plays)}
					description="Plays with recorded viewing time, not unique viewers."
				/>
				<Statistic
					label="Average watch time"
					value={hasPlays ? watchTimeLabel(measurement.average_watch_seconds) : '—'}
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
	const definition = defineChart({
		marks: [lineY(retention, { x: 'segment', y: 'value', stroke: 'currentColor', strokeWidth: 3 })],
		scales: {
			x: {
				scale: () => scalePoint().padding(0.2),
				axis: {
					line: false,
					ticks: {
						values: retention
							.filter((_, index) => [0, 5, 10, 15, 19].includes(index))
							.map((part) => part.segment),
						size: 0,
						format: (segment) => (segment.startsWith('95') ? '100%' : `${segment.split('–')[0]}%`),
					},
					tickLabels: { fontSize: 14, opacity: 1, thin: true },
				},
			},
			y: {
				scale: scaleLinear().domain([0, 100]),
				axis: {
					line: false,
					ticks: { size: 0, format: (value) => `${value}%` },
					tickLabels: { fontSize: 14, opacity: 1 },
				},
				grid: { strokeOpacity: 0.5 },
			},
		},
		tooltip: { use: tooltip },
	});
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
				<div
					className="mt-4 text-text-link [&_svg_text]:fill-text-primary [&_svg_line]:stroke-border-default"
					role="group"
					aria-label="Film segment coverage chart"
				>
					<Chart
						definition={definition}
						height={220}
						ariaLabel="Film segment coverage in 5 percent intervals"
						renderTooltipBody={({ points }) =>
							points.length ? (
								<div>
									<Text as="p" variant="body-14-medium" className="m-0">
										Film segment {points[0].xValue}
									</Text>
									<Text as="p" variant="body-14" className="m-0">
										{number.format(points[0].yValue)}% average coverage
									</Text>
								</div>
							) : null
						}
					/>
				</div>
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

function MediaPerformance({ rows, pagination, days, eventsAvailable = true }) {
	const pageUrl = (page) => `?days=${days}&page=${page}#media`;
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
				<>
					<div className="hidden overflow-x-auto md:block">
						<table className="w-full border-collapse text-right">
							<Text as="caption" variant="body-14" className="sr-only">
								Media performance for the last {days} days
							</Text>
							<thead className="border-b border-border-divider">
								<tr>
									<Text
										as="th"
										variant="body-12-medium"
										scope="col"
										className="px-6 py-3 text-left text-text-secondary"
									>
										Media
									</Text>
									{columns.map(([label]) => (
										<Text
											as="th"
											variant="body-12-medium"
											key={label}
											scope="col"
											className="whitespace-nowrap px-4 py-3 text-text-secondary"
										>
											{label}
										</Text>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.url} className="hover:bg-bg-surface-muted">
										<Text
											as="th"
											variant="body-14"
											scope="row"
											className="max-w-xs px-6 py-4 text-left"
										>
											<Text
												as={Link}
												action="text-link"
												variant="body-14-medium"
												href={row.analytics_url}
												className="block break-words text-text-link underline underline-offset-2 hover:text-text-link-hover"
											>
												{row.title}
											</Text>
											<Badge color="bg/chip" className="mt-2 text-text-primary">
												{row.state}
											</Badge>
										</Text>
										{columns.map(([label, display]) => (
											<Text
												as="td"
												variant="body-14"
												key={label}
												className="px-4 py-4 tabular-nums"
											>
												{display(row)}
											</Text>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="space-y-4 md:hidden">
						{rows.map((row) => (
							<article key={row.url} className="py-4">
								<div className="flex items-start justify-between gap-3">
									<Text
										as={Link}
										action="text-link"
										variant="body-14-medium"
										href={row.analytics_url}
										className="min-w-0 break-words text-text-link underline underline-offset-2 hover:text-text-link-hover"
									>
										{row.title}
									</Text>
									<Badge color="bg/chip" className="shrink-0 text-text-primary">
										{row.state}
									</Badge>
								</div>
								<dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
									{columns.map(([label, display]) => (
										<div key={label}>
											<Text as="dt" variant="body-12" color="meta">
												{label}
											</Text>
											<Text
												as="dd"
												variant="body-14-medium"
												className="m-0 mt-1 tabular-nums text-text-strong"
											>
												{display(row)}
											</Text>
										</div>
									))}
								</dl>
							</article>
						))}
					</div>
				</>
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
			{pagination && pagination.count > 1 && rows.length > 0 && (
				<nav aria-label="Media pages" className="flex items-center justify-between gap-3 pt-4">
					<Text as="span" variant="body-12" color="meta">
						Page {pagination.number} of {pagination.count}
					</Text>
					<div className="flex gap-4">
						{pagination.previous && (
							<Text
								as={Link}
								action="text-link"
								variant="body-12-medium"
								href={pageUrl(pagination.previous)}
								className="inline-flex min-h-11 items-center px-2 text-text-secondary hover:text-text-link"
							>
								Previous
							</Text>
						)}
						{pagination.next && (
							<Text
								as={Link}
								action="text-link"
								variant="body-12-medium"
								href={pageUrl(pagination.next)}
								className="inline-flex min-h-11 items-center px-2 text-text-secondary hover:text-text-link"
							>
								Next
							</Text>
						)}
					</div>
				</nav>
			)}
		</Card>
	);
}

export function CreatorAnalyticsPage({ data }) {
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
	const rangeUrl = (days) => `?days=${days}${mediaQuery}${sectionHash}`;
	const selectSection = (value) => {
		setRequestedSection(value);
		window.history.replaceState(
			window.history.state,
			'',
			`${window.location.pathname}${window.location.search}${value === 'overview' ? '' : `#${value}`}`
		);
	};
	const breadcrumbs = [
		{ label: 'Home', href: '/' },
		{ label: 'Analytics', href: selectedMedia ? `/analytics?days=${data.days}#media` : null },
		...(selectedMedia ? [{ label: selectedMedia.title }] : []),
	];
	return (
		<div className="min-h-screen bg-bg-page px-4 py-6 text-text-primary sm:px-8 sm:py-8">
			<div className="mx-auto max-w-7xl">
				<nav aria-label="Breadcrumb" className="mb-2">
					<ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0">
						{breadcrumbs.map((item, index) => (
							<li key={index} className="flex min-w-0 max-w-full items-center gap-2">
								{index > 0 && (
									<Icon
										name="chevronLeft"
										size={14}
										decorative
										className="rotate-180 text-text-muted"
									/>
								)}
								{item.href ? (
									<Text
										as={Link}
										action="text-link"
										variant="body-14-medium"
										href={item.href}
										className="inline-flex min-h-11 items-center text-text-secondary hover:underline"
									>
										{item.label}
									</Text>
								) : (
									<Text
										as="span"
										variant="body-14-medium"
										color="meta"
										aria-current="page"
										className="min-w-0 break-words py-3"
									>
										{item.label}
									</Text>
								)}
							</li>
						))}
					</ol>
				</nav>
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
									>
										Open media
									</Text>
								</div>
							)}
							{firstDate && lastDate && (
								<Text as="p" variant="body-12" color="meta" className="mt-1 mb-0">
									{shortDate.format(new Date(firstDate))} – {dateLabel.format(new Date(lastDate))} ·
									UTC
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
								placeholder="Export CSV"
								value={null}
								options={[
									{ value: 'summary', label: 'Summary' },
									{ value: 'daily', label: 'Daily' },
									{ value: 'retention', label: 'Segment coverage' },
									{ value: 'engagement', label: 'Engagement' },
								]}
								onChange={(dataset) => {
									window.location.href = `/analytics/export?days=${data.days}${mediaQuery}&dataset=${dataset}`;
								}}
							/>
						) : (
							<Text
								as={Link}
								action="text-link"
								variant="body-14-medium"
								className="inline-flex min-h-11 items-center underline underline-offset-2"
								href={`/analytics/export?days=${data.days}&dataset=portfolio`}
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
								triggerClassName="px-2 py-3 no-underline sm:px-4"
							>
								{data.ranges.map((range) => (
									<TabContent
										key={range}
										value={String(range)}
										title={
											<Text as="span" variant="body-12-bold" className="text-text-on-chrome">
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
						<div className="flex max-w-full flex-wrap items-center gap-2">
							<Text as="span" variant="body-12" color="meta">
								Film version
							</Text>
							<Dropdown
								appearance="compact"
								className="[&>div>button]:min-h-11"
								label="Film version"
								aria-describedby={data.version === 'unknown' ? 'film-version-help' : undefined}
								value={data.version}
								options={data.versions}
								onChange={(version) => {
									window.location.href = `?days=${data.days}&media=${encodeURIComponent(selectedMedia.uid)}&version=${encodeURIComponent(version)}${sectionHash}`;
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
										className="m-0 mt-3 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4"
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
												Neither is a unique viewer count. Comparisons use the same elapsed UTC
												time in the previous period.
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
							state. Dates use UTC and recorded activity is retained for up to 12 months. A zero count may
							mean tracking had not started or no eligible activity was recorded.
						</Text>
					</Disclosure>
					<div className="mt-4">
						<Text as="span" variant="body-12" color="meta">
							Updated{' '}
							{new Date(data.updated_at).toLocaleString('en-GB', {
								timeZone: 'UTC',
								dateStyle: 'medium',
								timeStyle: 'short',
							})}{' '}
							UTC
						</Text>
					</div>
				</Card>
			</div>
		</div>
	);
}
