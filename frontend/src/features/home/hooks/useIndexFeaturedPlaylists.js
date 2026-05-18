import { HOME_QUERY_KEYS } from '../queryClient';
import { createMediaQueryHook } from './createMediaQueryHook';

export const useIndexFeaturedPlaylists = createMediaQueryHook(HOME_QUERY_KEYS.indexFeatured, '/api/v1/indexfeatured');
