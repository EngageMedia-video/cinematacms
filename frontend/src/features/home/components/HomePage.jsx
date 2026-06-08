import { QueryClientProvider } from '@tanstack/react-query';
import homeQueryClient from '../queryClient';
import { HeroSection } from './HeroSection';
import { SectionRow } from './SectionRow';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { useRecentMedia } from '../hooks/useRecentMedia';
import { useIndexFeaturedPlaylists } from '../hooks/useIndexFeaturedPlaylists';
import { usePlaylistMedia } from '../hooks/usePlaylistMedia';
import { normalizeMediaList } from '../utils/mediaList';

const HOME_PLAYLIST_ITEM_LIMIT = 20;
const HOME_RECENT_ITEM_LIMIT = 20;
const PLAYLIST_LOADING_ROW_COUNT = 2;
const HOME_TRACK_CLASS = 'mx-auto min-h-screen w-full max-w-[1515px] space-y-6 px-[27px]';

function getHomepagePlaylistRowKey(playlist, index) {
	const parts = [playlist.api_url, playlist.url, playlist.ordering, playlist.title, index].filter(
		(part) => part != null && part !== ''
	);

	return parts.join('::');
}

function FeaturedByCuratorsRow() {
	const { data, isLoading, isError } = useFeaturedMedia();
	// The hero shows featured[0]; this row shows the remaining featured media,
	// matching the pre-modern home (featuredVideos.slice(1)).
	const items = normalizeMediaList(data).slice(1);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<div className="flex flex-col gap-2">
				<SectionRow.Title viewAllHref="/featured">Featured by Curators</SectionRow.Title>
				<SectionRow.Description text="Selected by Cinemata's community curators" />
			</div>
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function HomepagePlaylistRow({ playlist, variant }) {
	const { data, isLoading, isError } = usePlaylistMedia(playlist.api_url);
	const items = normalizeMediaList(data).slice(0, HOME_PLAYLIST_ITEM_LIMIT);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError} variant={variant}>
			<SectionRow.Title viewAllHref={playlist.url}>{playlist.title}</SectionRow.Title>
			{playlist.text ? <SectionRow.HtmlDescription html={playlist.text} /> : null}
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function HomepagePlaylistRows() {
	const { data, isLoading, isError } = useIndexFeaturedPlaylists();

	if (isLoading) {
		return Array.from({ length: PLAYLIST_LOADING_ROW_COUNT }, (_, index) => (
			<SectionRow key={index} items={[]} isLoading variant={index % 2 === 0 ? 'card' : 'default'} />
		));
	}

	if (isError || !Array.isArray(data) || data.length === 0) {
		return null;
	}

	return data.map((playlist, index) => (
		<HomepagePlaylistRow
			key={getHomepagePlaylistRowKey(playlist, index)}
			playlist={playlist}
			variant={index % 2 === 0 ? 'card' : 'default'}
		/>
	));
}

function RecentVideosRow() {
	const { data, isLoading, isError } = useRecentMedia();
	const items = normalizeMediaList(data).slice(0, HOME_RECENT_ITEM_LIMIT);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<SectionRow.Title viewAllHref="/latest">Recent videos</SectionRow.Title>
			<SectionRow.Grid />
		</SectionRow>
	);
}

function HomePageContent() {
	return (
		<div data-modern-track className={HOME_TRACK_CLASS}>
			<HeroSection>
				<HeroSection.Player />
				<HeroSection.Card />
			</HeroSection>

			<FeaturedByCuratorsRow />

			<HomepagePlaylistRows />

			<RecentVideosRow />
		</div>
	);
}

export function HomePage() {
	return (
		<QueryClientProvider client={homeQueryClient}>
			<HomePageContent />
		</QueryClientProvider>
	);
}
