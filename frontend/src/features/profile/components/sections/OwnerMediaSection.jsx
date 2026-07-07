import { Text } from '../../../shared/components';
import { useOwnerMedia } from '../../hooks/useOwnerMedia';
import { normalizeMediaList } from '../../utils/media';
import { MediaGrid } from '../MediaGrid';

export function OwnerMediaSection({ author, action }) {
	const { data, isLoading, isError } = useOwnerMedia(author.username, action, author.is_owner);
	const items = normalizeMediaList(data);

	if (!author.is_owner) return null;
	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading films" />;
	}
	if (isError) return <Text className="text-text-danger">Films could not be loaded.</Text>;
	if (!items.length) {
		return (
			<Text className="text-text-muted">
				{action === 'history' ? 'No viewing history yet.' : 'No liked films yet.'}
			</Text>
		);
	}
	return <MediaGrid items={items} />;
}
