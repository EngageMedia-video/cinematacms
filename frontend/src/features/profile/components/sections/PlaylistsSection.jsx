import { Card, Text } from '../../../shared/components';
import { useAuthorPlaylists } from '../../hooks/useAuthorPlaylists';

function normalizeList(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
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
		<ul className="grid list-none gap-4 p-0">
			{playlists.map((playlist) => (
				<li key={playlist.url || playlist.title}>
					<Card variant="outlined" className="flex flex-col gap-4 p-4 sm:flex-row">
						<img
							src={playlist.thumbnail_url}
							alt=""
							width="180"
							height="135"
							loading="lazy"
							className="aspect-[4/3] w-full rounded object-cover sm:w-[180px]"
						/>
						<div className="min-w-0">
							<a
								href={playlist.url}
								className="heading-h6-20-medium text-text-primary hover:text-text-link-hover"
							>
								{playlist.title}
							</a>
							<Text as="p" variant="body-14" className="mt-2 mb-0 text-text-muted">
								{playlist.description || `${playlist.media_count || 0} films`}
							</Text>
						</div>
					</Card>
				</li>
			))}
		</ul>
	);
}
