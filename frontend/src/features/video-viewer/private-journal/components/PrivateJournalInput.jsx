import { Avatar } from '../../../shared/components/Avatar';
import { resolveAvatarSrc } from '../utils/journalMedia';

function getUser() {
	if (typeof window === 'undefined') return null;
	return window.MediaCMS?.user ?? null;
}

export function PrivateJournalInput({ value, onChange, onSubmit, disabled = false, isSubmitting = false }) {
	const user = getUser();
	const submitDisabled = disabled || isSubmitting || value.trim() === '';

	return (
		<div className="flex flex-col rounded-lg bg-bg-page px-4 py-3">
			<label htmlFor="private-journal-note-input" className="sr-only text-bg-control-unchecked">
				Write a Note
			</label>

			<textarea
				id="private-journal-note-input"
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && event.shiftKey && !event.isComposing && event.keyCode !== 229) {
						event.preventDefault();
						onSubmit();
					}
				}}
				placeholder="Write a Note"
				className="mb-0 block max-h-28 placeholder:text-text-label-private-journal min-w-0 resize-none border-0 bg-transparent p-0 text-sm leading-5 text-text-primary focus:outline-none focus:ring-0"
			/>

			<div className="mt-auto flex items-end justify-between gap-4">
				<Avatar
					src={resolveAvatarSrc(user?.thumbnail) || undefined}
					name={user?.name || user?.username || 'User'}
					size="large"
				/>

				<button
					type="button"
					onClick={onSubmit}
					disabled={submitDisabled}
					className="inline-flex h-8 cursor-pointer items-center rounded-sm border-0 bg-site-accent px-4 text-xs font-bold leading-5 text-white transition-colors duration-200 hover:bg-bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? 'ADDING...' : 'ADD NOTE'}
				</button>
			</div>
		</div>
	);
}
