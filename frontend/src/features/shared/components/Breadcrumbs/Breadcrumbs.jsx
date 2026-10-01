import { Icon } from '../Icon';
import { Link } from '../Link/Link';
import { Text } from '../Text';

/** Ordered ancestors followed by the current page (an item without href). */
export function Breadcrumbs({ items, className = '' }) {
	return (
		<nav aria-label="Breadcrumb" className={className}>
			<ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0">
				{items.map((item, index) => (
					<li key={index} className="flex min-w-0 max-w-full items-center gap-2">
						{index > 0 && (
							<Icon name="chevronLeft" size={14} decorative className="rotate-180 text-text-muted" />
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
	);
}
