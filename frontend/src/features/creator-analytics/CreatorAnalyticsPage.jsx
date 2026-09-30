import { useMemo, useState } from 'react';
import { defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { Badge, Card, Icon, Link, SegmentButton, TabContent, TabView, Text } from '../shared/components';
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
	{ key: 'playback_start', label: 'Playback starts', color: 'text-bg-secondary' },
	{ key: 'finish', label: 'Reached end', color: 'text-bg-success' },
];
const watchMetrics = [{ key: 'watch_seconds', label: 'Watch time (seconds)', color: 'text-bg-secondary' }];

function comparisonLabel(current, previous) {
	if (typeof previous !== 'number') return null;
	if (!previous) return current ? 'No earlier events recorded' : null;
	const change = Math.round(((current - previous) / previous) * 100);
	return `${change > 0 ? '+' : ''}${change}% vs equal-length period`;
}

function CountCard({ label, value, stacked = false, comparison = null }) {
	return (
		<div
			className={`flex min-w-0 py-3 ${stacked || comparison ? 'flex-col gap-1' : 'items-baseline justify-between gap-4'}`}
		>
			<Text as="dt" variant="body-14" color="meta" className="m-0">
				{label}
			</Text>
			<Text as="dd" variant={stacked ? 'h4-bold' : 'body-18-bold'} className="m-0 tabular-nums text-text-primary">
				{value}
			</Text>
			{comparison && (
				<Text as="span" variant="body-12" color="meta" className="tabular-nums">
					{comparison}
				</Text>
			)}
		</div>
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
					strokeWidth: 2,
				}),
			],
			scales: {
				x: {
					scale: () => scalePoint().padding(0.2),
					axis: {
						line: false,
						ticks: { values: tickDates, size: 0, format: (date) => shortDate.format(new Date(date)) },
						tickLabels: { fontSize: 11, thin: true },
					},
				},
				y: {
					scale: scaleLinear().domain([0, maximum]),
					nice: true,
					grid: { strokeOpacity: 0.1 },
					axis: {
						line: false,
						ticks: { count: Math.min(4, maximum), size: 0, format: (value) => number.format(value) },
						tickLabels: { fontSize: 12 },
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
				<SegmentButton
					aria-label="Chart metric"
					layout="fill"
					className="sm:w-auto [&>button]:min-h-11 [&>button]:px-1 sm:[&>button]:px-4 [&>button>span]:whitespace-normal"
					options={metricOptions}
					value={metricIndex}
					onValueChange={setMetricIndex}
				/>
			</div>
			{hasActivity ? (
				<>
					<div
						role="group"
						aria-label={`Daily ${metric.label.toLowerCase()} chart`}
						className={`mt-5 min-w-0 ${metric.color}`}
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
											{number.format(points[0].yValue)} {metric.label.toLowerCase()}
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
						Your {metric.label.toLowerCase()} will appear here as viewers engage with your media.
					</Text>
				</div>
			)}
			<details className="mt-4">
				<summary
					className={`cursor-pointer py-3 body-body-14-medium text-text-secondary hover:text-text-link ${focus}`}
				>
					View daily figures
				</summary>
				<div
					className={`max-h-72 overflow-auto ${focus}`}
					tabIndex={0}
					role="region"
					aria-label="Daily figures"
				>
					<table className="w-full border-collapse text-right body-body-14-regular">
						<caption className="sr-only">Daily activity counts in UTC, newest first</caption>
						<thead className="sticky top-0 border-b border-border-divider bg-bg-surface-muted body-body-12-medium text-text-secondary">
							<tr>
								{['Date (UTC)', ...metricSet.map((item) => item.label)].map((label) => (
									<th key={label} scope="col" className="px-3 py-3 font-medium">
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...daily].reverse().map((day) => (
								<tr key={day.date} className="hover:bg-bg-surface-muted">
									<th scope="row" className="whitespace-nowrap px-3 py-3 font-normal">
										{day.date}
									</th>
									{metricSet.map((item) => (
										<td key={item.key} className="px-3 py-3 tabular-nums">
											{number.format(day[item.key])}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	);
}

function Engagement({ items }) {
	const sorted = items.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
	return (
		<Card as="section" aria-labelledby="engagement-heading" className="mt-6 min-w-0 p-5 sm:p-8">
			<Text as="h2" id="engagement-heading" variant="h6-bold" className="m-0 text-text-primary">
				Engagement
			</Text>
			{sorted.length ? (
				<dl className="m-0 mt-2 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
					{sorted.map(([label, count]) => (
						<div key={label} className="flex justify-between gap-4 py-2 body-body-14-regular">
							<dt className="text-text-secondary">{label}</dt>
							<dd className="m-0 body-body-14-medium tabular-nums text-text-primary">
								{number.format(count)}
							</dd>
						</div>
					))}
				</dl>
			) : (
				<Text as="p" variant="body-14" color="meta" className="mt-4 mb-0">
					No engagement in this period.
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
					<CountCard key={key} label={label} value={number.format(totals[key] ?? 0)} stacked />
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
	const retention = measurement.retention.map((value, index) => ({
		segment: `${index * 5}–${(index + 1) * 5}%`,
		value,
	}));
	const definition = defineChart({
		marks: [lineY(retention, { x: 'segment', y: 'value', stroke: 'currentColor', strokeWidth: 2 })],
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
					tickLabels: { fontSize: 10 },
				},
			},
			y: {
				scale: scaleLinear().domain([0, 100]),
				axis: { line: false, ticks: { size: 0, format: (value) => `${value}%` } },
				grid: { strokeOpacity: 0.1 },
			},
		},
		tooltip: { use: tooltip },
	});
	return (
		<Card as="section" aria-labelledby="viewing-heading" className="mt-6 p-5 sm:p-8">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<Text as="h2" id="viewing-heading" variant="h6-bold" className="m-0 text-text-primary">
					{selectedMedia ? 'How this film is watched' : 'Viewing time'}
				</Text>
				<Text as="span" variant="body-12" color="meta">
					Measured plays · UTC
				</Text>
			</div>
			<dl className="m-0 mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
				<CountCard label="Watch time" value={formatDuration(measurement.watch_seconds)} stacked />
				<CountCard label="Measured plays" value={number.format(measurement.measured_plays)} stacked />
				<CountCard
					label="Avg. watch"
					value={hasPlays ? formatDuration(measurement.average_watch_seconds) : '—'}
					stacked
				/>
				<CountCard
					label="Average film coverage"
					value={hasPlays ? `${measurement.average_percent_watched}%` : '—'}
					stacked
				/>
			</dl>
			{selectedMedia && (
				<>
					<Text as="h3" variant="body-14-bold" className="mt-8 mb-1 text-text-primary">
						Coverage by film segment
					</Text>
					<Text as="p" variant="body-12" color="meta" className="m-0 max-w-prose">
						Each point is the average share of that 5% part of the film actually watched per measured play.
						Recent plays may still be in progress.
					</Text>
					{hasPlays ? (
						<div className="mt-4 text-bg-secondary" role="group" aria-label="Film segment coverage chart">
							<Chart
								definition={definition}
								height={220}
								ariaLabel="Film segment coverage in 5 percent intervals"
							/>
						</div>
					) : (
						<Text as="p" variant="body-14" color="meta" className="mt-5 mb-0">
							No measured plays in this period.
						</Text>
					)}
					<details className="mt-3">
						<summary className={`cursor-pointer py-3 body-body-14-medium text-text-secondary ${focus}`}>
							View segment coverage figures
						</summary>
						<ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
							{retention.map((part) => (
								<li key={part.segment} className="body-body-12-regular">
									{part.segment}: {part.value}%
								</li>
							))}
						</ol>
					</details>
				</>
			)}
		</Card>
	);
}

function Breakdown({ title, items, empty = 'No data in this period.' }) {
	return (
		<Card as="section" className="min-w-0 p-5 sm:p-8">
			<Text as="h2" variant="h6-bold" className="m-0 text-text-primary">
				{title}
			</Text>
			{items?.length ? (
				<dl className="m-0 mt-3 space-y-2">
					{items.map(([label, value]) => (
						<div key={label} className="flex justify-between gap-4 body-body-14-regular">
							<dt className="min-w-0 break-words text-text-secondary">{label}</dt>
							<dd className="m-0 shrink-0 tabular-nums text-text-primary">{number.format(value)}</dd>
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
	const pageUrl = (page) => `?days=${days}&page=${page}`;
	const columns = eventsAvailable
		? [
				['Views', (row) => number.format(row.views)],
				['Starts', (row) => number.format(row.starts)],
				['Reached end', (row) => number.format(row.finishes)],
				['Watch time', (row) => formatDuration(row.watch_seconds)],
			]
		: [
				['Measured plays', (row) => number.format(row.measured_plays)],
				['Watch time', (row) => formatDuration(row.watch_seconds)],
				['Legacy views (all time)', (row) => number.format(row.legacy_views)],
			];
	return (
		<Card as="section" aria-labelledby="media-heading" className="mt-6 min-w-0 p-5 sm:p-8">
			<div className="flex flex-wrap items-center justify-between gap-2 pb-4">
				<Text as="h2" id="media-heading" variant="h6-bold" className="m-0 text-text-primary">
					Your media
				</Text>
				<Text as="span" variant="body-12" color="meta" className="m-0">
					{eventsAvailable ? 'Ranked by media views' : 'Newest media first'}
				</Text>
			</div>
			{rows.length ? (
				<>
					<div className="hidden overflow-x-auto md:block">
						<table className="w-full border-collapse text-right body-body-14-regular">
							<caption className="sr-only">Media performance for the last {days} days</caption>
							<thead className="border-b border-border-divider body-body-12-regular text-text-secondary">
								<tr>
									<th scope="col" className="px-6 py-3 text-left font-medium">
										Media
									</th>
									{columns.map(([label]) => (
										<th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.url} className="hover:bg-bg-surface-muted">
										<th scope="row" className="max-w-xs px-6 py-4 text-left font-normal">
											<Link
												href={row.analytics_url}
												className={`block break-words body-body-14-medium text-text-link underline underline-offset-2 hover:text-text-link-hover ${focus}`}
											>
												{row.title}
											</Link>
											<Badge color="bg/chip" className="mt-2 text-text-primary">
												{row.state}
											</Badge>
										</th>
										{columns.map(([label, display]) => (
											<td key={label} className="px-4 py-4 tabular-nums">
												{display(row)}
											</td>
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
									<Link
										href={row.analytics_url}
										className={`min-w-0 break-words body-body-14-medium text-text-link underline underline-offset-2 hover:text-text-link-hover ${focus}`}
									>
										{row.title}
									</Link>
									<Badge color="bg/chip" className="shrink-0 text-text-primary">
										{row.state}
									</Badge>
								</div>
								<dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
									{columns.map(([label, display]) => (
										<div key={label}>
											<dt className="body-body-12-regular text-text-muted">{label}</dt>
											<dd className="m-0 mt-1 body-body-14-medium tabular-nums text-text-strong">
												{display(row)}
											</dd>
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
				<nav
					aria-label="Media pages"
					className="flex items-center justify-between gap-3 pt-4 body-body-12-regular text-text-muted"
				>
					<span>
						Page {pagination.number} of {pagination.count}
					</span>
					<div className="flex gap-4">
						{pagination.previous && (
							<Link
								href={pageUrl(pagination.previous)}
								className={`rounded-ds-4 px-2 py-2 text-text-secondary hover:text-text-link ${focus}`}
							>
								Previous
							</Link>
						)}
						{pagination.next && (
							<Link
								href={pageUrl(pagination.next)}
								className={`rounded-ds-4 px-2 py-2 text-text-secondary hover:text-text-link ${focus}`}
							>
								Next
							</Link>
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
	const first = daily[0];
	const last = daily[daily.length - 1];
	const selectedMedia = data.selected_media;
	const mediaQuery = selectedMedia
		? `&media=${encodeURIComponent(selectedMedia.uid)}&version=${encodeURIComponent(data.version)}`
		: '';
	const rangeUrl = (days) => `?days=${days}${mediaQuery}`;
	const breadcrumbs = [
		{ label: 'Home', href: '/' },
		{ label: 'Analytics', href: selectedMedia ? `/analytics?days=${data.days}` : null },
		...(selectedMedia ? [{ label: selectedMedia.title }] : []),
	];
	return (
		<div className="min-h-screen bg-bg-page px-4 py-6 text-text-primary sm:px-8 sm:py-8">
			<div className="mx-auto max-w-7xl">
				<nav aria-label="Breadcrumb" className="mb-4 body-body-14-medium">
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
									<Link
										href={item.href}
										className={`inline-flex min-h-11 items-center text-text-secondary hover:underline ${focus}`}
									>
										{item.label}
									</Link>
								) : (
									<span aria-current="page" className="min-w-0 break-words py-3 text-text-muted">
										{item.label}
									</span>
								)}
							</li>
						))}
					</ol>
				</nav>
				<header className="mb-6 flex flex-wrap items-center justify-between gap-6">
					<div className="flex w-full min-w-0 items-center gap-4 sm:gap-6 lg:w-auto lg:flex-1">
						{selectedMedia && (
							<div className="flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-ds-8 bg-bg-surface-muted sm:w-48">
								{selectedMedia.thumbnail_url ? (
									<img
										src={selectedMedia.thumbnail_url}
										alt=""
										className="h-full w-full object-cover"
									/>
								) : (
									<Icon name="myMedia" size={32} className="text-text-muted" />
								)}
							</div>
						)}
						<div className="min-w-0">
							<Text as="h1" variant="h4-bold" className="m-0 break-words text-text-primary">
								{selectedMedia ? selectedMedia.title : 'Analytics'}
							</Text>
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
									<Link href={selectedMedia.url} className={`body-body-12-medium ${focus}`}>
										Open media
									</Link>
								</div>
							)}
							{first && last && !data.unavailable && (
								<Text as="p" variant="body-12" color="meta" className="mt-1 mb-0">
									{shortDate.format(new Date(first.date))} – {dateLabel.format(new Date(last.date))} ·
									UTC
								</Text>
							)}
						</div>
					</div>
					{
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
					}
				</header>
				<div className="mb-5 flex flex-wrap items-center gap-3 body-body-12-regular text-text-muted">
					<span>
						Updated{' '}
						{new Date(data.updated_at).toLocaleString('en-GB', {
							timeZone: 'UTC',
							dateStyle: 'medium',
							timeStyle: 'short',
						})}{' '}
						UTC
					</span>
					<Link href={rangeUrl(data.days)} className={focus}>
						Refresh
					</Link>
					{selectedMedia ? (
						<details className="relative">
							<summary className={`cursor-pointer ${focus}`}>Export CSV</summary>
							<Card
								as="div"
								className="absolute left-0 z-20 mt-2 flex min-w-40 flex-col gap-3 p-4 shadow-lg"
							>
								{['summary', 'daily', 'retention', 'engagement'].map((dataset) => (
									<Link
										key={dataset}
										href={`/analytics/export?days=${data.days}${mediaQuery}&dataset=${dataset}`}
										className={focus}
									>
										{dataset.charAt(0).toUpperCase() + dataset.slice(1)}
									</Link>
								))}
							</Card>
						</details>
					) : (
						<Link href={`/analytics/export?days=${data.days}&dataset=portfolio`} className={focus}>
							Export CSV
						</Link>
					)}
					{selectedMedia && data.versions.length > 1 && (
						<label className="flex items-center gap-2">
							<span>Film cut</span>
							<select
								value={data.version}
								onChange={(event) => {
									window.location.href = `?days=${data.days}&media=${encodeURIComponent(selectedMedia.uid)}&version=${encodeURIComponent(event.target.value)}`;
								}}
								className={`min-h-11 rounded-ds-8 bg-bg-surface px-3 text-text-primary ${focus}`}
							>
								{data.versions.map((version) => (
									<option key={version.value} value={version.value}>
										{version.label}
									</option>
								))}
							</select>
						</label>
					)}
				</div>
				{!data.unavailable && (
					<>
						<MeasuredViewing measurement={data.measurement} selectedMedia={selectedMedia} />
						<Card
							as="div"
							className={`mt-6 grid gap-6 p-5 sm:p-8 ${selectedMedia ? 'sm:gap-8' : 'lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10'}`}
						>
							<section aria-labelledby="summary-heading">
								<Text
									as="h2"
									id="summary-heading"
									variant="h6-bold"
									className={selectedMedia ? 'sr-only' : 'm-0'}
								>
									Last {data.days} days
								</Text>
								<dl
									aria-label="Summary"
									className={
										selectedMedia
											? 'm-0 grid grid-cols-2 gap-x-6 sm:grid-cols-3 xl:grid-cols-5'
											: 'm-0 mt-3'
									}
								>
									<CountCard
										label="Media views"
										value={number.format(data.media_views)}
										comparison={comparisonLabel(data.media_views, data.comparison?.media_views)}
										stacked={!!selectedMedia}
									/>
									<CountCard
										label="Starts after interaction"
										value={number.format(data.deliberate_starts)}
										comparison={comparisonLabel(
											data.deliberate_starts,
											data.comparison?.deliberate_starts
										)}
										stacked={!!selectedMedia}
									/>
									<CountCard
										label="Playback starts"
										value={number.format(totals.playback_start)}
										comparison={comparisonLabel(totals.playback_start, data.comparison?.starts)}
										stacked={!!selectedMedia}
									/>
									<CountCard
										label="Reached end"
										value={number.format(totals.finish)}
										comparison={comparisonLabel(totals.finish, data.comparison?.finishes)}
										stacked={!!selectedMedia}
									/>
									{selectedMedia && (
										<CountCard
											label="Starts per page/embed load"
											value={data.start_per_load == null ? '—' : `${data.start_per_load}%`}
											stacked
										/>
									)}
								</dl>
								<Text as="p" variant="body-12" color="meta" className="m-0">
									Reached end includes seeks to the end. Earlier comparisons use the same elapsed UTC
									time.
									{selectedMedia &&
										' Starts per page/embed load compares event counts and can exceed 100%.'}
								</Text>
							</section>
							<ActivityChart daily={daily} height={selectedMedia ? 300 : 220} />
						</Card>
						{selectedMedia && ['video', 'audio'].includes(selectedMedia.media_type) && (
							<PlaybackMilestones totals={totals} />
						)}
						{!selectedMedia && (
							<MediaPerformance rows={data.rows} pagination={data.pagination} days={data.days} />
						)}
						{selectedMedia &&
							[data.contexts, data.initiations, data.referrers, data.errors].some(
								(items) => items?.length
							) && (
								<div className="mt-6 grid gap-5 md:grid-cols-2">
									{!!data.contexts?.length && (
										<Breakdown title="Where viewing happened" items={data.contexts} />
									)}
									{!!data.initiations?.length && (
										<Breakdown title="How playback began" items={data.initiations} />
									)}
									{!!data.referrers?.length && (
										<Breakdown title="Referral domains" items={data.referrers} />
									)}
									{!!data.errors?.length && <Breakdown title="Player errors" items={data.errors} />}
								</div>
							)}
						<Engagement items={data.engagement || []} />
						<details className="px-5 py-6 text-text-muted sm:px-8">
							<summary className={`w-fit cursor-pointer body-body-12-medium ${focus}`}>
								About these figures
							</summary>
							<Text as="p" variant="body-12" color="meta" className="mt-3 mb-0 max-w-prose">
								Media views count page and embed loads. Only you can see these figures, covering media
								you currently own in every visibility state. Dates use UTC and data is retained for up
								to 12 months. Starts after interaction include player actions and on-site navigation. A
								zero count in the earlier window may mean tracking had not started. CMS measured plays
								and Umami start events use different sources and may differ.
							</Text>
						</details>
					</>
				)}
				{data.unavailable && (
					<>
						<MeasuredViewing measurement={data.measurement} selectedMedia={selectedMedia} />
						<Card as="div" className="mt-6 p-5 sm:p-8">
							<ActivityChart
								daily={Object.entries(data.measurement.daily_watch_seconds || {}).map(
									([date, watch_seconds]) => ({ date, watch_seconds })
								)}
								metricSet={watchMetrics}
							/>
						</Card>
						{!selectedMedia && (
							<MediaPerformance
								rows={data.rows}
								pagination={data.pagination}
								days={data.days}
								eventsAvailable={false}
							/>
						)}
					</>
				)}
				{data.cms_totals && (
					<Card as="section" aria-labelledby="cms-totals-heading" className="mt-6 p-5 sm:p-8">
						<Text as="h2" id="cms-totals-heading" variant="h6-bold" className="m-0 text-text-primary">
							Current media totals
						</Text>
						<Text as="p" variant="body-12" color="meta" className="mt-2 mb-0 max-w-prose">
							From the CMS database, across all cuts. These totals do not follow the date range. Legacy
							views use the existing media counter, not page views or playback starts.
						</Text>
						<dl className="m-0 mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
							<CountCard
								label="Legacy views (all time)"
								value={number.format(data.cms_totals.legacy_views)}
								stacked
							/>
							<CountCard label="Current likes" value={number.format(data.cms_totals.likes)} stacked />
							<CountCard
								label="Current comments"
								value={number.format(data.cms_totals.comments)}
								stacked
							/>
						</dl>
					</Card>
				)}
			</div>
		</div>
	);
}
