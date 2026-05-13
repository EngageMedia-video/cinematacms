import { QueryClientProvider } from '@tanstack/react-query';
import homeQueryClient from '../queryClient';
import { HeroSection } from './HeroSection';
import { SectionRow } from './SectionRow';
import { useRecommendedMedia } from '../hooks/useRecommendedMedia';
import { useRecentMedia } from '../hooks/useRecentMedia';
import { useIndexFeaturedPlaylists } from '../hooks/useIndexFeaturedPlaylists';
import { usePlaylistMedia } from '../hooks/usePlaylistMedia';
import { normalizeMediaList } from '../utils/mediaList';
import { Text } from '../../shared/components/Text';

const HOME_PLAYLIST_ITEM_LIMIT = 20;
const HOME_RECENT_ITEM_LIMIT = 20;
const PLAYLIST_LOADING_ROW_COUNT = 2;
const HOME_TRACK_CLASS = 'mx-auto min-h-screen w-full max-w-[1680px] space-y-10';

function FeaturedByCuratorsRow() {
	const { data, isLoading, isError } = useRecommendedMedia();
	const items = normalizeMediaList(data);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<div className="flex flex-col gap-2">
				<SectionRow.Title viewAllHref="/recommended">Featured by Curators</SectionRow.Title>
				<SectionRow.Description text="Hand-picked stories from our editorial team." />
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
			key={playlist.api_url ?? playlist.url ?? `${playlist.title}-${playlist.ordering ?? index}`}
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
			<div className="space-y-8">
				<Text as="h1" variant="h4" className="text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50">
					Most Popular
				</Text>

				<HeroSection>
					<HeroSection.Player />
					<HeroSection.Card />
				</HeroSection>
			</div>

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
