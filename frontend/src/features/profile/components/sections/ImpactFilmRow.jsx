import { formatDuration } from '../../../shared/utils/formatDuration';
import { formatCount, getMediaCountry, getMediaDescription } from '../../../playlist/utils/playlist';

/**
 * Read-only film header for the profile Impact tab. Mirrors the Playlist page
 * FilmRow layout (thumbnail, title, uploader, country, views, synopsis) but
 * without the owner reorder/menu controls — impact entries render beneath it.
 */
export function ImpactFilmRow({ media }) {
	const title = media?.title || 'Untitled video';
	const author = media?.author_name || media?.user || 'Cinemata member';
	const country = getMediaCountry(media);
	const description = getMediaDescription(media);
	const duration = formatDuration(media?.duration);
	const metadata = [country, formatCount(media?.views || 0, 'view')].filter(Boolean).join(' · ');

	return (
		<div className="grid grid-cols-1 gap-x-4 gap-y-3 @2xl:grid-cols-[220px_minmax(0,1fr)] @2xl:items-start">
			<a
				href={media?.url || '#'}
				className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-ds-6 bg-bg-skeleton no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus @2xl:w-[220px]"
				aria-label={`Open ${title}`}
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
					href={media?.url || '#'}
					className="line-clamp-2 text-text-strong no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-16-medium"
				>
					{title}
				</a>
				<a
					href={media?.author_profile || '#'}
					className="line-clamp-1 w-fit text-text-link no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-12-regular"
				>
					{author}
				</a>
				{metadata ? <p className="m-0 text-text-muted body-body-12-regular">{metadata}</p> : null}
				{description ? (
					<p className="m-0 line-clamp-3 break-words text-text-primary body-body-14-regular">{description}</p>
				) : null}
			</div>
		</div>
	);
}
