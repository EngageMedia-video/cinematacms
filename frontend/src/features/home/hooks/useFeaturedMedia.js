import { HOME_QUERY_KEYS, HOME_QUERY_STALE_TIME_MS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useFeaturedMedia = createMediaQueryHook(HOME_QUERY_KEYS.featured, '/api/v1/media?show=featured', {
	staleTime: HOME_QUERY_STALE_TIME_MS,
});
