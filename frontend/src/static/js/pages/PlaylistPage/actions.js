import Dispatcher from '../../classes_instances/dispatcher.js';

export function removedMediaFromPlaylist(media_id, playlist_id) {
	Dispatcher.dispatch({
		type: 'MEDIA_REMOVED_FROM_PLAYLIST',
		media_id,
		playlist_id,
	});
}
