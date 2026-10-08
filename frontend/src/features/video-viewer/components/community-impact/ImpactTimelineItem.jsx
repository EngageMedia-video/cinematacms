import PropTypes from 'prop-types';
import { Icon } from '../../../shared/components';
import { formatImpactDate, getSafeHref } from './utils/formatDate';

export function ImpactTimelineItem({ date = '', summary = '', title, url, year }) {
	const formattedDate = year ? String(year) : formatImpactDate(date);
	const dateTime = year ? String(year) : date;
	const safeHref = getSafeHref(url);

	return (
		<li className="relative grid min-h-24.75 grid-cols-[var(--size-32)_1fr] gap-space-sm">
			<span className="relative flex min-h-24.75 justify-center" aria-hidden="true">
				<span className="absolute top-0 bottom-0 w-px bg-border-default" />
				<span className="absolute top-7.25 z-10 h-size-6 w-size-6 translate-y-1/2 rounded-full bg-bg-timeline-dot" />
			</span>

			<div className="min-w-0 pt-7.25">
				<p className="body-body-14-bold m-0 wrap-break-word text-text-primary">{title}</p>
				{summary ? (
					<p className="body-body-12-regular m-0 mt-space-xs wrap-break-word text-text-muted">{summary}</p>
				) : null}
				<div className="mt-space-xs flex min-w-0 flex-wrap items-center gap-space-xs text-text-muted">
					{formattedDate ? (
						<time className="body-body-12-regular" dateTime={dateTime}>
							{formattedDate}
						</time>
					) : null}
					{safeHref && formattedDate ? (
						<span className="body-body-12-regular text-text-muted" aria-hidden="true">
							•
						</span>
					) : null}
					{safeHref ? (
						<a
							className="inline-flex shrink-0 items-center justify-center text-text-link outline-none hover:text-text-link-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
							href={safeHref}
							aria-label={`Open impact link for ${title}`}
							target="_blank"
							rel="noreferrer"
						>
							<Icon name="impactUrlLogo" size={20} decorative />
						</a>
					) : null}
				</div>
			</div>
		</li>
	);
}

ImpactTimelineItem.propTypes = {
	date: PropTypes.string,
	summary: PropTypes.string,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
	year: PropTypes.number,
};
