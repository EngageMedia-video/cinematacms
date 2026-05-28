import { useRef, useState } from 'react';
import { Button } from '../../shared/components/Button';
import { useSubmitComment } from '../hooks/useSubmitComment';
import { usePlayerReady } from '../hooks/usePlayerReady';
import { getCurrentPlayerTime } from '../utils/videoPlayer';
import { formatTimestamp } from '../utils/timestamp';
import { gradientForName, initialFor } from '../utils/avatar';

function getUser() {
	if (typeof window === 'undefined') return null;
	return window.MediaCMS?.user ?? null;
}

function getSignInHref() {
	if (typeof window === 'undefined') return '/accounts/login/';
	const next = window.location.pathname + window.location.search;
	return `/accounts/login/?next=${encodeURIComponent(next)}`;
}

function Avatar({ name, thumbnail }) {
	if (thumbnail) {
		return <img src={thumbnail} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />;
	}
	const { from, to } = gradientForName(name);
	return (
		<span
			aria-hidden="true"
			className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
			style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }}
		>
			{initialFor(name)}
		</span>
	);
}

/**
 * Comment input block. Always rendered on dark navy bg (`pacific-deep-900`)
 * regardless of the surrounding theme so it stands apart visually.
 *
 * The "insert timestamp" affordance is an icon-only toggle: a click captures
 * the player's current time and renders it as a non-editable orange chip at
 * the left of the input; clicking again clears the chip. The chip is a
 * separate element outside the textarea so Backspace cannot remove it.
 */
export function CommentForm({ friendlyToken }) {
	const user = getUser();
	const isAnonymous = !user || user.is?.anonymous;
	const textareaRef = useRef(null);
	const [value, setValue] = useState('');
	const [timestamp, setTimestamp] = useState(null);
	const [error, setError] = useState(null);
	const playerReady = usePlayerReady();
	const submitMutation = useSubmitComment(friendlyToken);

	const trimmed = value.trim();
	const composed = timestamp ? `${timestamp} ${trimmed}`.trim() : trimmed;
	// Submit only enables when the user has actually typed text. Inserting a
	// timestamp alone is not enough — the comment body itself must be present.
	const disabled = trimmed === '' || submitMutation.isPending;

	const submit = () => {
		if (disabled) return;
		setError(null);
		submitMutation.mutate(composed, {
			onSuccess: () => {
				setValue('');
				setTimestamp(null);
			},
			onError: (err) => setError(err?.message || 'Failed to submit comment.'),
		});
	};

	const toggleTimestamp = () => {
		if (timestamp) {
			setTimestamp(null);
			requestAnimationFrame(() => textareaRef.current?.focus());
			return;
		}
		const t = getCurrentPlayerTime();
		if (t === null) return;
		setTimestamp(formatTimestamp(t));
		requestAnimationFrame(() => textareaRef.current?.focus());
	};

	const handleKeyDown = (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		}
	};

	if (isAnonymous) {
		return (
			<div className="rounded-lg bg-cinemata-pacific-deep-900 px-4 py-3 text-sm text-cinemata-pacific-deep-100">
				<a
					href={getSignInHref()}
					className="font-bold text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-sm"
				>
					Sign in
				</a>{' '}
				to leave a comment.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 rounded-lg bg-cinemata-pacific-deep-900 px-3 py-2.5">
			<div className="flex items-center gap-2">
				{timestamp ? (
					<button
						type="button"
						onClick={toggleTimestamp}
						aria-label={`Clear inserted timestamp ${timestamp}`}
						className="inline-flex shrink-0 cursor-pointer items-center rounded-sm border-0 bg-cinemata-sunset-horizon-500 px-1.5 py-0.5 text-xs font-bold tracking-tight text-white hover:bg-cinemata-sunset-horizon-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					>
						{timestamp}
					</button>
				) : null}
				<label htmlFor={`comment-input-${friendlyToken}`} className="sr-only">
					Leave a comment
				</label>
				<input
					ref={textareaRef}
					id={`comment-input-${friendlyToken}`}
					type="text"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Leave a comment..."
					className="block min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-5 text-cinemata-pacific-deep-50 placeholder:text-cinemata-pacific-deep-100 focus:outline-none focus:ring-0"
				/>
			</div>

			{error ? <p className="text-xs text-text-danger">{error}</p> : null}

			<div className="flex items-center justify-between gap-2">
				<Avatar name={user?.name || user?.username} thumbnail={user?.thumbnail} />

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={toggleTimestamp}
						disabled={!playerReady}
						title={
							playerReady
								? timestamp
									? 'Clear inserted timestamp'
									: 'Insert the video’s current time'
								: 'Start the video to insert a timestamp'
						}
						aria-label={timestamp ? 'Clear inserted timestamp' : 'Insert current video timestamp'}
						aria-pressed={!!timestamp}
						className={
							'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:opacity-50 ' +
							(timestamp
								? 'bg-cinemata-sunset-horizon-500 text-white hover:bg-cinemata-sunset-horizon-600'
								: 'bg-cinemata-pacific-deep-950 text-white hover:bg-cinemata-pacific-deep-800')
						}
					>
						<i aria-hidden="true" className="material-icons" style={{ fontSize: 16 }}>
							schedule
						</i>
					</button>

					<Button variant="primary" type="button" onClick={submit} disabled={disabled}>
						{submitMutation.isPending ? 'SUBMITTING…' : 'SUBMIT'}
					</Button>
				</div>
			</div>
		</div>
	);
}
