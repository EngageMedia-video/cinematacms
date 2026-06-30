import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

const SUPPORTED_ACTIONS = new Set(['history', 'liked']);

export function useOwnerMedia(username, action, enabled) {
	const isSupportedAction = SUPPORTED_ACTIONS.has(action);

	return useProfileQuery({
		enabled: enabled && isSupportedAction,
		queryKey: isSupportedAction
			? PROFILE_QUERY_KEYS[action](username)
			: ['profile', username, 'owner-media-invalid'],
		url: isSupportedAction ? (action === 'history' ? '/api/v1/user/action/watch' : '/api/v1/user/action/like') : '',
	});
}
