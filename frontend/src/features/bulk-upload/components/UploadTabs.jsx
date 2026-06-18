import { cn } from '../../shared/utils/classNames';
import { useBulkUploadConfig } from '../bulkUploadConfig';

const SEGMENT_BASE =
	'body-body-12-medium inline-flex min-w-0 flex-1 items-center justify-center gap-1 px-4 py-2 uppercase no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page first:rounded-l-ds-4 last:rounded-r-ds-4';

/**
 * SINGLE FILM UPLOAD | BULK UPLOAD toggle. This is cross-page navigation
 * (decision D1): the single tab links to the single-upload page, the bulk tab
 * is the current page.
 */
export function UploadTabs() {
	const { singleUploadUrl } = useBulkUploadConfig();

	return (
		<nav aria-label="Upload mode" className="flex max-w-[420px] overflow-hidden rounded-ds-4">
			<a
				href={singleUploadUrl}
				className={cn(SEGMENT_BASE, 'bg-bg-chrome text-text-on-chrome hover:bg-bg-chrome-hover')}
			>
				Single Film Upload
			</a>
			<span aria-current="page" className={cn(SEGMENT_BASE, 'bg-bg-primary text-text-on-primary')}>
				Bulk Upload
			</span>
		</nav>
	);
}
