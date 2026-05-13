import { HOME_QUERY_KEYS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useRecentMedia = createMediaQueryHook(HOME_QUERY_KEYS.recent, '/api/v1/media?show=latest');
