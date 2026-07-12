import { formatCreatedDate } from '../../../playlist/utils/playlist';
import { Icon, Text } from '../../../shared/components';
import { useAuthorPlaylists } from '../../hooks/useAuthorPlaylists';

function normalizeList(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
}

function PlaylistCard({ playlist }) {
	const link = playlist.url || '#';
	const title = playlist.title || 'Untitled playlist';
	const count = playlist.media_count || 0;

	return (
		<li className="min-w-0">
			<a
				href={link}
				title={title}
				aria-label={`Play all in ${title}`}
				className="group relative block aspect-video overflow-hidden rounded bg-bg-skeleton no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
			>
				{playlist.thumbnail_url ? (
					<img src={playlist.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : null}

				{/* Right-side count panel (old-page style): count above the
				    playlist-play icon, centered in a fixed 92px column. */}
				<span className="absolute inset-y-0 right-0 flex w-[92px] flex-col items-center justify-center gap-0.5 bg-bg-overlay-dark/80 text-text-on-chrome">
					<span className="leading-tight body-body-14-regular">{count}</span>
					<Icon name="playlistPlay" size={29} decorative />
				</span>

				{/* Hover "PLAY ALL" overlay. */}
				<span className="absolute inset-0 flex items-center justify-center gap-2 bg-bg-overlay-dark/80 text-text-on-chrome opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
					<Icon name="play" size="sm" decorative />
					<Text as="span" variant="body-14-medium" className="uppercase">
						Play all
					</Text>
				</span>
			</a>

			<div className="mt-3 flex min-w-0 flex-col items-start">
				<a
					href={link}
					className="line-clamp-2 text-text-primary no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-16-medium"
				>
					{title}
				</a>
				<Text as="p" variant="body-12" className="mt-2 mb-0 text-text-muted">
					{formatCreatedDate(playlist.add_date)}
				</Text>
				<a
					href={link}
					className="mt-1 text-text-link no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-12-medium uppercase"
				>
					View full playlist
				</a>
			</div>
		</li>
	);
}

export function PlaylistsSection({ author }) {
	const { data, isLoading, isError } = useAuthorPlaylists(author.username);
	const playlists = normalizeList(data);

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading playlists" />;
	}
	if (isError) return <Text className="text-text-danger">Playlists could not be loaded.</Text>;
	if (!playlists.length) return <Text className="text-text-muted">No playlists created yet.</Text>;

	return (
		// Match the legacy profile grid: cards cap at --default-item-width
		// (372px) rather than stretching to fill the column, up to 4 per row.
		<ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),372px))] justify-start gap-x-[27px] gap-y-8 p-0">
			{playlists.map((playlist) => (
				<PlaylistCard key={playlist.url || playlist.title} playlist={playlist} />
			))}
		</ul>
	);
}
