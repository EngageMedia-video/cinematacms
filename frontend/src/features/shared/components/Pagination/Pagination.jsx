import { Link } from '../Link/Link';
import { Text } from '../Text';
import { cn } from '../../utils/classNames';

/** Server navigation; callers supply complete URLs, including their filters. */
export function Pagination({ page, totalPages, previousHref, nextHref, label = 'Pages', className = '' }) {
	if (totalPages <= 1) return null;
	return (
		<nav aria-label={label} className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
			<Text as="span" variant="body-12" color="meta">
				Page {page} of {totalPages}
			</Text>
			<div className="flex gap-4">
				{[
					['Previous', previousHref],
					['Next', nextHref],
				].map(
					([text, href]) =>
						href && (
							<Text
								key={text}
								as={Link}
								action="text-link"
								variant="body-12-medium"
								href={href}
								rel={text === 'Previous' ? 'prev' : 'next'}
								className="inline-flex min-h-11 items-center px-2 text-text-secondary hover:text-text-link"
							>
								{text}
							</Text>
						)
				)}
			</div>
		</nav>
	);
}
