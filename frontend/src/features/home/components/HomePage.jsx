import { QueryClientProvider } from '@tanstack/react-query';
import homeQueryClient from '../queryClient';
import { HeroSection } from './HeroSection';
import { SectionRow } from './SectionRow';
import { useRecommendedMedia } from '../hooks/useRecommendedMedia';
import { useCategoryMedia } from '../hooks/useCategoryMedia';
import { normalizeMediaList } from '../utils/mediaList';

// Provisional category list — declared at module scope, never inside the render function.
// These categories display as empty rows today (useCategoryMedia returns []).
// The deferred category-source work replaces useCategoryMedia bodies without touching this list.
const PROVISIONAL_CATEGORIES = [
	{
		id: 'gender-sexuality',
		label: 'GENDER & SEXUALITY',
		color: '#A855F7',
		viewAllHref: '/search?c=Gender',
		searchTerm: 'Gender',
	},
	{ id: 'film', label: 'FILM', color: '#3B82F6', viewAllHref: '/search?c=Film', searchTerm: 'Film' },
	{ id: 'webinar', label: 'WEBINAR', color: '#10B981', viewAllHref: '/search?c=Webinar', searchTerm: 'Webinar' },
	{
		id: 'documentary',
		label: 'DOCUMENTARY',
		color: '#ED7C30',
		viewAllHref: '/search?c=Documentary',
		searchTerm: 'Documentary',
	},
	{
		id: 'animal-rights',
		label: 'ANIMAL RIGHTS',
		color: '#F6A474',
		viewAllHref: '/search?c=Animal+Rights',
		searchTerm: 'Animal Rights',
	},
	{
		id: 'indigenous',
		label: 'INDIGENOUS',
		color: '#00876A',
		viewAllHref: '/search?c=Indigenous',
		searchTerm: 'Indigenous',
		heading: 'Featured by Curators',
	},
];

// Card-variant indices match the Figma rhythm: alternating bands plus the final
// Indigenous row, which the design treats as a featured callout with a card surface.
const CARD_INDICES = new Set([0, 2, 4, 5]);

function FeaturedByCuratorsRow() {
	const { data, isLoading, isError } = useRecommendedMedia();
	const items = normalizeMediaList(data);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<SectionRow.Title>Featured by Curators</SectionRow.Title>
			<SectionRow.Description text="Hand-picked stories from our editorial team." />
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function CategorySectionRow({ category, variant }) {
	const { data, isLoading, isError } = useCategoryMedia(category.searchTerm);
	const items = normalizeMediaList(data);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError} variant={variant}>
			<SectionRow.Header
				badgeLabel={category.label}
				badgeColor={category.color}
				viewAllHref={category.viewAllHref}
			/>
			{category.heading ? <SectionRow.Title>{category.heading}</SectionRow.Title> : null}
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function HomePageContent() {
	return (
		<div data-modern-track className="min-h-screen w-full px-6 lg:px-28 py-6 space-y-10">
			<h1 className="heading-h4-32-medium m-0">Most Popular</h1>

			<HeroSection>
				<HeroSection.Player />
				<HeroSection.Card />
			</HeroSection>

			<FeaturedByCuratorsRow />

			{PROVISIONAL_CATEGORIES.map((category, index) => (
				<CategorySectionRow
					key={category.id}
					category={category}
					variant={CARD_INDICES.has(index) ? 'card' : 'default'}
				/>
			))}
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
