import { HorizontalMovieItem, VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';

export function HomePage() {
	return (
		<div data-modern-track className="min-h-screen">
			<main className="w-full px-28 py-4 space-y-4">
				<h1 className="heading-h4-32-medium m-0 mb-4">Most Popular</h1>
				<div className="flex flex-row gap-4 overflow-scroll">
					<VerticalMovieItem
						title="Movie ini"
						duration="10:00"
						imageSrc="./static/images/apc_logo.png"
						badge="test"
						subtitle="CCP Film, Broadcast and New Media"
						link="https://google.com"
					/>
					<VerticalMovieItem link="https://google.com" />
					<VerticalMovieItem />
					<VerticalMovieItem />
				</div>
				<h1 className="heading-h4-32-medium m-0 mb-4">Most Recent</h1>
				<div className="flex flex-col gap-4 max-w-xl">
					<HorizontalMovieItem
						link="https://google.com"
						title="lorem lorem  lorem lorem lorem loremlorem lorem lorem loremloremlorem lorem lo  lorem loremlorem lorem lorem loremloremlorem lore  lorem loremlorem lorem lorem loremloremlorem loreremloremlorem loremlorem lorem lorem"
						subtitle="Hello World"
						metadata={['2000', '2000']}
					/>
					<HorizontalMovieItem />
					<HorizontalMovieItem />
					<HorizontalMovieItem />
					<HorizontalMovieItem />
					<HorizontalMovieItem />
				</div>
			</main>
		</div>
	);
}
