import { QueryClientProvider } from '@tanstack/react-query';
import homeQueryClient from '../queryClient';
import { HeroSection } from './HeroSection';
import { SectionRow } from './SectionRow';
import { useRecommendedMedia } from '../hooks/useRecommendedMedia';
import { useCategoryMedia } from '../hooks/useCategoryMedia';
import { normalizeMediaList } from '../utils/mediaList';
import { Text } from '../../shared/components/Text';

// Provisional category list — declared at module scope, never inside the render function.
// playlistId is null until an admin assigns a playlist to each category.
// Rows with no playlistId render nothing (useCategoryMedia is disabled when playlistId is falsy).
const PROVISIONAL_CATEGORIES = [
	{
		id: 'gender-sexuality',
		label: 'GENDER & SEXUALITY',
		color: '#A855F7',
		viewAllHref: '/search?c=Gender',
		playlistId: null,
		description:
			'Stories exploring identity, expression, and lived experiences across the gender and sexuality spectrum. Highlighting voices, struggles, and perspectives often marginalized or overlooked.',
	},
	{
		id: 'film',
		label: 'FILM',
		color: '#3B82F6',
		viewAllHref: '/search?c=Film',
		playlistId: null,
		description:
			'Narrative or experimental moving-image works that tell stories through cinematic expression. Spanning fiction, hybrid, and artistic formats across cultures and perspectives.',
	},
	{
		id: 'webinar',
		label: 'WEBINAR',
		color: '#10B981',
		viewAllHref: '/search?c=Webinar',
		playlistId: null,
		description:
			'Recorded or live sessions featuring discussions, talks, or educational content. Designed for learning, dialogue, and knowledge sharing across communities.',
	},
	{
		id: 'documentary',
		label: 'DOCUMENTARY',
		color: '#ED7C30',
		viewAllHref: '/search?c=Documentary',
		playlistId: null,
		description:
			'Non-fiction films grounded in real events, people, and lived experiences. Focused on truth-telling, social issues, and amplifying underrepresented voices.',
	},
	{
		id: 'animal-rights',
		label: 'ANIMAL RIGHTS',
		color: '#F6A474',
		viewAllHref: '/search?c=Animal+Rights',
		playlistId: null,
		description:
			'Content addressing the ethical treatment, protection, and rights of animals. Exploring activism, environmental impact, and human-animal relationships.',
	},
	{
		id: 'indigenous',
		label: 'INDIGENOUS',
		color: '#00876A',
		viewAllHref: '/search?c=Indigenous',
		playlistId: null,
		heading: 'Featured by Curators',
		description:
			'Voices, stories, and cultural expressions from indigenous communities around the world. Centering land rights, tradition, resistance, and sovereignty.',
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
			<SectionRow.Title viewAllHref="/recommended">Featured by Curators</SectionRow.Title>
			<SectionRow.Description text="Hand-picked stories from our editorial team." />
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function CategorySectionRow({ category, variant }) {
	const { data, isLoading, isError } = useCategoryMedia(category.playlistId);
	const items = normalizeMediaList(data);

	return (
		<SectionRow items={items} isLoading={isLoading} isError={isError} variant={variant}>
			<SectionRow.Header
				badgeLabel={category.label}
				badgeColor={category.color}
				viewAllHref={category.viewAllHref}
			/>
			{category.heading ? <SectionRow.Title>{category.heading}</SectionRow.Title> : null}
			{category.description ? <SectionRow.Description text={category.description} /> : null}
			<SectionRow.Carousel />
		</SectionRow>
	);
}

function HomePageContent() {
	return (
		<div data-modern-track className="min-h-screen w-full space-y-10">
			<div className="space-y-8">
				<Text as="h1" variant="h4">
					Most Popular
				</Text>

				<HeroSection>
					<HeroSection.Player />
					<HeroSection.Card />
				</HeroSection>
			</div>

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
