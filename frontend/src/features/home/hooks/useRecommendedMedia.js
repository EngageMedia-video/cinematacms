import { HOME_QUERY_KEYS, HOME_QUERY_STALE_TIME_MS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useRecommendedMedia = createMediaQueryHook(HOME_QUERY_KEYS.recommended, '/api/v1/media?show=recommended', {
	staleTime: HOME_QUERY_STALE_TIME_MS,
});
