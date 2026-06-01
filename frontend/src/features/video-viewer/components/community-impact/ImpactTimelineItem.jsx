import PropTypes from 'prop-types';
import { Icon } from '../../../shared/components';
import { formatImpactDate, getSafeHref } from './utils/formatDate';

export function ImpactTimelineItem({ date = '', title, url }) {
	const formattedDate = formatImpactDate(date);
	const safeHref = getSafeHref(url);

	return (
		<li className="relative grid min-h-[99px] grid-cols-[var(--size-32)_1fr] gap-space-sm">
			<span className="relative flex h-[99px] justify-center" aria-hidden="true">
				<span className="absolute top-0 h-[34px] w-px bg-border-default" />
				<span className="absolute top-[57px] h-[42px] w-px bg-border-default" />
				<span className="absolute top-[43px] z-10 h-size-6 w-size-6 rounded-full bg-bg-impact-timeline-dot" />
			</span>

			<div className="min-w-0 pt-[29px]">
				<p className="body-body-14-bold m-0 break-words text-text-primary">{title}</p>
				<div className="mt-space-xs flex min-w-0 flex-wrap items-center gap-space-xs text-text-muted">
					{formattedDate ? (
						<time className="body-body-12-regular" dateTime={date}>
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
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
};
