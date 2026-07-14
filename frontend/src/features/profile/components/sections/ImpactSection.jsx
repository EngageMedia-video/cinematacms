import { Text } from '../../../shared/components';
import { useAuthorImpact } from '../../hooks/useAuthorImpact';
import { ImpactFilmGroup } from './ImpactFilmGroup';

// Categories surfaced on the profile Impact tab (matches ImpactFilmGroup).
const DISPLAY_CATEGORIES = ['screening', 'featured', 'academic'];

function normalizeFilms(data) {
	if (Array.isArray(data?.films)) return data.films;
	return [];
}

function filmKey(film, index) {
	return film?.media?.friendly_token || film?.media?.url || index;
}

function hasDisplayableEntries(film) {
	const impact = film?.impact || {};
	return DISPLAY_CATEGORIES.some((key) => {
		const bucket = impact[key];
		const entries = Array.isArray(bucket) ? bucket : bucket?.entries;
		return Array.isArray(entries) && entries.length > 0;
	});
}

export function ImpactSection({ author }) {
	const { data, isLoading, isError } = useAuthorImpact(author.username);

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading impact" />;
	}
	if (isError) return <Text className="text-text-danger">Community impact could not be loaded.</Text>;

	const films = normalizeFilms(data).filter(hasDisplayableEntries);
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
				<ImpactFilmGroup key={filmKey(film, index)} film={film} index={index} />
			))}
		</div>
	);
}
