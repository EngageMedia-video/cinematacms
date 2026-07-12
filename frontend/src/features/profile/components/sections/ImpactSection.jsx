import { Text } from '../../../shared/components';
import { CommunityImpactSection } from '../../../video-viewer/components/community-impact';
import { useAuthorImpact } from '../../hooks/useAuthorImpact';
import { ImpactFilmRow } from './ImpactFilmRow';

function normalizeFilms(data) {
	if (Array.isArray(data?.films)) return data.films;
	return [];
}

function filmKey(film, index) {
	return film?.media?.friendly_token || film?.media?.url || index;
}

export function ImpactSection({ author }) {
	const { data, isLoading, isError } = useAuthorImpact(author.username);

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading impact" />;
	}
	if (isError) return <Text className="text-text-danger">Community impact could not be loaded.</Text>;

	const films = normalizeFilms(data);
	if (!films.length) {
		return (
			<Text as="p" variant="body-14" className="m-0 text-text-muted">
				{author.name || author.username} has no community impact entries yet.
			</Text>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			{films.map((film, index) => (
				<section
					key={filmKey(film, index)}
					className="flex flex-col gap-4 rounded-lg border border-border-default p-4"
				>
					<ImpactFilmRow media={film.media} />
					{/* Header/description omitted: the tab-level heading already
					    labels this section. */}
					<CommunityImpactSection entries={film.impact || {}} canAdd={false} title="" description="" />
				</section>
			))}
		</div>
	);
}
