import { formatCount, getMediaCountry, getMediaDescription } from '../../../playlist/utils/playlist';
import { formatDuration } from '../../../shared/utils/formatDuration';

/**
 * Read-only film-row header for the profile Impact tab. Faithfully mirrors the
 * Playlist page FilmRow layout — order number, thumbnail with a duration pill,
 * title, uploader, country · views, and a dedicated Synopsis column — but
 * without the owner reorder/share menu. Impact entries render beneath it.
 */
export function ImpactFilmRow({ media, index = 0 }) {
	const url = media?.url || '#';
	const title = media?.title || 'Untitled video';
	const author = media?.author_name || media?.user || 'Cinemata member';
	const country = getMediaCountry(media);
	const description = getMediaDescription(media);
	const duration = formatDuration(media?.duration);
	const metadata = [country, formatCount(media?.views || 0, 'view')].filter(Boolean).join(' · ');

	return (
		<div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[24px_180px_minmax(140px,0.8fr)_minmax(0,1.2fr)] sm:items-start lg:grid-cols-[24px_220px_200px_minmax(0,1fr)] lg:gap-x-5">
			<span className="hidden text-center text-text-muted body-body-14-regular sm:block sm:self-center">
				{index + 1}
			</span>

			<a
				href={url}
				aria-label={`Open ${title}`}
				className="relative block aspect-video w-full max-w-[220px] shrink-0 overflow-hidden rounded-ds-6 bg-bg-skeleton no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus sm:w-[180px] sm:max-w-none lg:w-[220px]"
			>
				{media?.thumbnail_url ? (
					<img
						src={media.thumbnail_url}
						alt=""
						width="344"
						height="194"
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
					<span className="absolute right-1 bottom-1 rounded-ds-2 bg-bg-overlay-dark/80 px-1 py-0.5 text-text-on-chrome body-body-12-medium">
						{duration}
					</span>
				) : null}
			</a>

			<div className="flex min-w-0 flex-col gap-2">
				<a
					href={url}
					className="line-clamp-3 text-text-strong no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-16-medium"
				>
					{title}
				</a>
				<a
					href={media?.author_profile || '#'}
					className="line-clamp-2 w-fit text-text-link no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-12-regular"
				>
					{author}
				</a>
				{metadata ? <p className="m-0 text-text-muted body-body-12-regular">{metadata}</p> : null}
			</div>

			<div className="min-w-0">
				<p className="m-0 mb-3 text-text-muted body-body-14-regular">Synopsis</p>
				{description ? (
					<p className="m-0 line-clamp-6 break-words text-text-primary body-body-14-regular sm:line-clamp-3">
						{description}
					</p>
				) : (
					<p className="m-0 text-text-muted body-body-14-regular">No synopsis available.</p>
				)}
			</div>
		</div>
	);
}
