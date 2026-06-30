import { Icon, Text } from '../../../shared/components';

export function NotesSection() {
	return (
		<div className="flex min-h-[280px] flex-col items-center justify-center gap-4 py-8 text-center">
			<span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-surface-muted text-text-muted">
				<Icon name="note" size="md" decorative />
			</span>
			<Text as="h3" variant="h6-bold" className="m-0 text-text-primary">
				Notes are coming soon
			</Text>
			<Text as="p" variant="body-14" className="m-0 max-w-md text-text-muted">
				Your private, time-stamped film notes will appear here when the notes feature is ready.
			</Text>
		</div>
	);
}
