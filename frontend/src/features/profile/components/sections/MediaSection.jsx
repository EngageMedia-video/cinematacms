import { Text } from '../../../shared/components';
import { useAuthorMedia } from '../../hooks/useAuthorMedia';
import { normalizeMediaList } from '../../utils/media';
import { MediaGrid } from '../MediaGrid';

export function MediaSection({ author }) {
	const { data, isLoading, isError } = useAuthorMedia(author.username);
	const items = normalizeMediaList(data);

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading films" />;
	}
	if (isError) {
		return <Text className="text-text-danger">Films could not be loaded.</Text>;
	}
	if (!items.length) {
		return <Text className="text-text-muted">No films uploaded yet.</Text>;
	}
	return <MediaGrid items={items} authorDisplay="hide" />;
}
