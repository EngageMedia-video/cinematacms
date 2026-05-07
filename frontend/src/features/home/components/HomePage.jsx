import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { HorizontalMovieItem, VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { SegmentButton } from '../../shared/components/SegmentButton/SegmentButton';
import { TabContent, TabView } from '../../shared/components/TabView/TabView';

export function HomePage() {
	return (
		<div data-modern-track className="min-h-screen text-content-body">
			<main className="w-full px-28">
				<h1 className="heading-h4-32-medium">Most Popular</h1>
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
				<h1 className="heading-h4-32-medium">Most Recent</h1>
				<div className="mt-4 flex flex-col gap-4 max-w-xl">
					<HorizontalMovieItem title="lorem lorem  lorem lorem lorem lorem loremloremlorem lorem loremloremlorem loremlorem lorem lorem" />
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
