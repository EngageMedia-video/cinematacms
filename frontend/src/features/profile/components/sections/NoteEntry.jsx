import { formatDuration } from '../../../shared/utils/formatDuration';
import { formatClock, formatTimestamp } from '../../../video-viewer/private-journal/utils/journalMedia';

// Deep-link back into the film at the note's timestamp, opening the Notes tab:
// /view?m=<token>&t=<seconds>&tab=notes. The `tab=notes` marker tells the media
// page to select the "Your Notes" tab instead of the default Comments tab.
function noteHref(media) {
	const seconds = Math.max(0, Math.floor(Number(media?.timestamp_seconds) || 0));
	const base = mediaBase(media);
	if (base === '#') return base;
	const separator = base.includes('?') ? '&' : '?';
	return `${base}${separator}t=${seconds}&tab=notes`;
}

function filmHref(media) {
	const base = mediaBase(media);
	if (base === '#') return base;
	const separator = base.includes('?') ? '&' : '?';
	return `${base}${separator}tab=notes`;
}

function mediaBase(media) {
	return media?.url || (media?.friendly_token ? `/view?m=${encodeURIComponent(media.friendly_token)}` : '#');
}

function formatDay(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const today = new Date();
	const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayDelta = Math.round((startOfToday - startOfDate) / 86400000);
	if (dayDelta === 0) return 'Today';
	if (dayDelta === 1) return 'Yesterday';
	return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function NoteEntry({ note, noteCount = 1 }) {
	const media = note?.media || {};
	const seconds = Math.max(0, Math.floor(Number(note?.timestamp_seconds) || 0));
	const href = noteHref({ ...media, timestamp_seconds: seconds });
	const allNotesHref = filmHref(media);
	const title = media.title || 'Untitled film';
	const noteTime = formatTimestamp(seconds);
	const duration = formatDuration(media.duration);
	const dayLabel = formatDay(note?.add_date || note?.edit_date);
	const clockLabel = formatClock(note?.add_date || note?.edit_date);
	const noteCountLabel = `${noteCount} ${noteCount === 1 ? 'Note' : 'Notes'}`;

	return (
		<li className="grid w-full max-w-[360px] min-w-0 grid-cols-1 gap-y-[16px] sm:max-w-none sm:grid-cols-[220px_16px_36px_17px_1px_33px_minmax(0,1fr)]">
			<a
				href={href}
				aria-label={`Open ${title} at ${noteTime}`}
				className="relative col-span-full block aspect-[360/202] w-full overflow-hidden rounded-ds-6 bg-bg-skeleton no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus sm:col-span-1 sm:aspect-auto sm:h-[123px] sm:w-[220px]"
			>
				{media.thumbnail_url ? (
					<img
						src={media.thumbnail_url}
						alt=""
						width="220"
						height="123"
						loading="lazy"
						decoding="async"
						className="h-full w-full object-cover"
					/>
				) : (
					<span className="flex h-full w-full items-center justify-center text-text-muted body-body-12-regular">
						No thumbnail
					</span>
				)}
				{duration ? (
					<span className="absolute right-[4px] bottom-[4px] inline-flex h-[18px] min-w-[33px] items-center justify-center rounded-ds-2 bg-bg-note-thumbnail-duration px-[4px] text-text-note-thumbnail-duration body-body-12-medium">
						{duration}
					</span>
				) : null}
			</a>

			<div className="col-span-full grid min-w-0 grid-cols-[36px_17px_1px_33px_minmax(0,1fr)] sm:col-start-3 sm:col-end-8 sm:row-start-1">
				<a
					href={href}
					className="col-start-1 self-start text-text-accent no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-medium"
				>
					{noteTime}
				</a>

				<span aria-hidden="true" className="col-start-3 block h-[97px] w-px bg-border-note-divider" />

				<div className="col-start-5 min-w-0">
					<div className="flex items-center gap-[12px] text-text-muted body-body-14-regular">
						<span>Last Note</span>
					</div>
					<p className="m-0 mt-[12px] line-clamp-2 break-words whitespace-pre-line text-text-primary body-body-16-regular">
						{note?.text || ''}
					</p>
					{dayLabel || clockLabel ? (
						<p className="m-0 mt-[28px] flex items-center gap-[18px] text-text-muted body-body-14-regular">
							{dayLabel ? <span>{dayLabel}</span> : null}
							{dayLabel && clockLabel ? <span aria-hidden="true">•</span> : null}
							{clockLabel ? <span>{clockLabel}</span> : null}
						</p>
					) : null}
				</div>
			</div>

			<div className="col-span-full sm:col-start-1 sm:row-start-2">
				<a
					href={href}
					className="line-clamp-1 text-text-primary no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-16-medium"
				>
					{title}
				</a>
				<a
					href={allNotesHref}
					className="mt-[6px] block text-text-accent no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-medium"
				>
					View all {noteCountLabel} on this Film
				</a>
			</div>
		</li>
	);
}
