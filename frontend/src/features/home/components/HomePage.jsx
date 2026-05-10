import { QueryClientProvider } from '@tanstack/react-query';
import homeQueryClient from '../queryClient';
import { HeroSection } from './HeroSection';
import { SectionRow } from './SectionRow';
import { useRecommendedMedia } from '../hooks/useRecommendedMedia';
import { useCategoryMedia } from '../hooks/useCategoryMedia';

// Provisional category list — declared at module scope, never inside the render function.
// These categories display as empty rows today (useCategoryMedia returns []).
// The deferred category-source work replaces useCategoryMedia bodies without touching this list.
const PROVISIONAL_CATEGORIES = [
	{ id: 'gender-sexuality', label: 'GENDER & SEXUALITY', color: '#A855F7', viewAllHref: '/search?c=Gender' },
	{ id: 'film', label: 'FILM', color: '#3B82F6', viewAllHref: '/search?c=Film' },
	{ id: 'webinar', label: 'WEBINAR', color: '#10B981', viewAllHref: '/search?c=Webinar' },
];

function FeaturedByCuratorsRow() {
	const { data, isLoading, isError } = useRecommendedMedia();
	const items = data?.results ?? (Array.isArray(data) ? data : []);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<SectionRow.Header badgeLabel="FEATURED BY CURATORS" badgeColor="#ED7C30" />
			<SectionRow.Description text="Hand-picked stories from our editorial team." />
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function CategorySectionRow({ category }) {
	const { data, isLoading, isError } = useCategoryMedia(category.id);
	const items = Array.isArray(data) ? data : (data?.results ?? []);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError}>
			<SectionRow.Header
				badgeLabel={category.label}
				badgeColor={category.color}
				viewAllHref={category.viewAllHref}
			/>
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

			{PROVISIONAL_CATEGORIES.map((category) => (
				<CategorySectionRow key={category.id} category={category} />
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
