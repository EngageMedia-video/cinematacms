import { HOME_QUERY_KEYS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useFeaturedMedia = createMediaQueryHook(HOME_QUERY_KEYS.featured, '/api/v1/media?show=featured');
