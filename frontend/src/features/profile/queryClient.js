import { QueryClient } from '@tanstack/react-query';

export const PROFILE_QUERY_STALE_TIME_MS = 120_000;

const profileQueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: PROFILE_QUERY_STALE_TIME_MS,
			refetchOnWindowFocus: false,
		},
	},
});

export const PROFILE_QUERY_KEYS = {
	author: (username) => ['profile', username, 'author'],
	media: (username) => ['profile', username, 'media'],
	playlists: (username) => ['profile', username, 'playlists'],
	similar: (username, location) => ['profile', username, 'similar', location],
	impact: (username) => ['profile', username, 'impact'],
	notes: (username) => ['profile', username, 'notes'],
	history: (username) => ['profile', username, 'history'],
	liked: (username) => ['profile', username, 'liked'],
};

export default profileQueryClient;
