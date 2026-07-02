import { Button } from '../../../shared/components/Button';
import { Icon } from '../../../shared/components/Icon';
import { Text } from '../../../shared/components';

export function JournalEntry({ note }) {
	return (
		<li className="grid grid-cols-[34px_1fr] gap-4">
			<div className="flex flex-col items-center">
				<span className="w-full text-left text-sm leading-5 text-bg-secondary">{note.timestamp}</span>
				<span aria-hidden="true" className="mt-1 h-full w-px bg-border-divider" />
			</div>

			<div className="flex min-w-0 gap-3 items-start">
				<div className="min-w-0 flex-1">
					<Text variant="body-14" className="m-0 text-text-disabled">
						{note.title}
					</Text>
					<Text as="h6" variant="body-16" className="m-0 mt-2">
						{note.text}
					</Text>
					<Text variant="body-14" className="m-0 text-text-disabled mt-2 flex items-center gap-2">
						<span>{note.dayLabel}</span>
						<span aria-hidden="true">•</span>
						<span>{note.timeLabel}</span>
					</Text>
				</div>

				<Button variant="icon" aria-label={`Open ${note.title} actions`} icon={<Icon name="threeDots" size={22} />} />
			</div>
		</li>
	);
}
