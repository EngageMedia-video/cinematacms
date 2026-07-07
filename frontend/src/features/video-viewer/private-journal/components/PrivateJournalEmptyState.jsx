import { Icon } from '../../../shared/components/Icon';
import { Text } from '../../../shared/components';

export function PrivateJournalEmptyState() {
	return (
		<div className="flex flex-col items-center justify-center px-0 py-14 text-center">
			<Icon name="notes" size={58} className="text-text-dialog-accent" />

			<div className="mt-4 flex flex-col items-center gap-2">
				<Text as="h3" variant="body-16" className="m-0">
					No Documented Thoughts
				</Text>

				<Text as="p" variant="body-14" className="m-0 text-text-disabled mx-4">
					You can jot down thoughts, observations, or notes about this film for your own reference later
				</Text>
			</div>
		</div>
	);
}
