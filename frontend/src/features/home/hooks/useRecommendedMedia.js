import { HOME_QUERY_KEYS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useRecommendedMedia = createMediaQueryHook(HOME_QUERY_KEYS.recommended, '/api/v1/media?show=recommended');
