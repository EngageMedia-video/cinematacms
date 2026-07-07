import { QueryClientProvider } from '@tanstack/react-query';
import '../../static/css/tailwind.css';
import playlistQueryClient from './queryClient';
import { PlaylistPage } from './components/PlaylistPage';

export function PlaylistFeature() {
	return (
		<QueryClientProvider client={playlistQueryClient}>
			<PlaylistPage />
		</QueryClientProvider>
	);
}
