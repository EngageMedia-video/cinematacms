import { getMediaDurationLabel, normalizeMediaList } from '../../home/utils/mediaList';
import { buildMetadata, getCategoryBadge } from '../../video-viewer/utils/mediaCardMetadata';

export { normalizeMediaList };

// Owners, managers and curators get their non-public media back from /api/v1/media,
// so the card has to say which visibility state each film is in.
const VISIBILITY_INDICATORS = {
	private: { iconName: 'eyeSlash', iconLabel: 'Private' },
	unlisted: { iconName: 'link', iconLabel: 'Unlisted' },
	restricted: { iconName: 'lockKey', iconLabel: 'Restricted' },
};

export function getVisibilityIndicator(state) {
	return VISIBILITY_INDICATORS[state] || {};
}

export function getMovieItemProps(item, { hideAuthor = false } = {}) {
	return {
		...getCategoryBadge(item),
		...getVisibilityIndicator(item.state),
		title: item.title,
		imageSrc: item.thumbnail_url,
		link: item.url,
		duration: getMediaDurationLabel(item),
		subtitle: hideAuthor ? '' : item.author_name || item.user || '',
		subtitleLink: hideAuthor ? '' : item.author_profile || '',
		metadata: buildMetadata(item, false),
	};
}
