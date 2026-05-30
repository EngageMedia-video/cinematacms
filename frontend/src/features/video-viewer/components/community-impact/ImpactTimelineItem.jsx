import PropTypes from 'prop-types';
import { Icon } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { formatImpactDate, getSafeHref } from './utils/formatDate';

export function ImpactTimelineItem({ accentClassName = '', date = '', isFirst = false, isLast = false, title, url }) {
	const formattedDate = formatImpactDate(date);
	const safeHref = getSafeHref(url);

	return (
		<li className="relative grid grid-cols-[var(--size-20)_1fr] gap-space-xs pb-space-base last:pb-0">
			<span className="relative flex justify-center pt-[5px]" aria-hidden="true">
				{!isLast ? <span className="absolute top-size-16 bottom-[-2px] w-px bg-border-default" /> : null}
				<span
					className={cn(
						'relative z-10 h-size-10 w-size-10 rounded-full border',
						isFirst
							? cn('border-transparent', accentClassName, 'bg-current')
							: 'border-border-default bg-bg-surface'
					)}
				/>
			</span>

			<div className="min-w-0">
				<p className="body-body-14-bold m-0 break-words text-text-primary">{title}</p>
				<div className="mt-space-2 flex min-w-0 flex-wrap items-center gap-space-2 text-text-muted">
					{formattedDate ? (
						<time className="body-body-12-regular" dateTime={date}>
							{formattedDate}
						</time>
					) : null}
					{safeHref && formattedDate ? <span aria-hidden="true">•</span> : null}
					{safeHref ? (
						<a
							className="inline-flex items-center text-cinemata-sunset-horizon-400p outline-none hover:text-cinemata-sunset-horizon-300 focus-visible:ring-2 focus-visible:ring-ring-focus"
							href={safeHref}
							aria-label={`Open impact link for ${title}`}
							target="_blank"
							rel="noreferrer"
						>
							<Icon name="link" size="xs" decorative />
						</a>
					) : null}
				</div>
			</div>
		</li>
	);
}

ImpactTimelineItem.propTypes = {
	accentClassName: PropTypes.string,
	date: PropTypes.string,
	isFirst: PropTypes.bool,
	isLast: PropTypes.bool,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
};
