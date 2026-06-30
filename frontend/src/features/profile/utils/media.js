import { getMediaDurationLabel, normalizeMediaList } from '../../home/utils/mediaList';
import { buildMetadata, getCategoryBadge } from '../../video-viewer/utils/mediaCardMetadata';

export { normalizeMediaList };

export function getMovieItemProps(item, { hideAuthor = false } = {}) {
	return {
		...getCategoryBadge(item),
		title: item.title,
		imageSrc: item.thumbnail_url,
		link: item.url,
		duration: getMediaDurationLabel(item),
		subtitle: hideAuthor ? '' : item.author_name || item.user || '',
		subtitleLink: hideAuthor ? '' : item.author_profile || '',
		metadata: buildMetadata(item, false),
	};
}
