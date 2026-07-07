import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMovieItemProps } from '../utils/media';

export function MediaGrid({ items, authorDisplay = 'show', layout = 'standard' }) {
	return (
		<div
			className={
				layout === 'compact'
					? 'grid grid-cols-1 gap-6 sm:grid-cols-2'
					: 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4'
			}
		>
			{items.map((item) => (
				<VerticalMovieItem
					key={item.friendly_token || item.url}
					{...getMovieItemProps(item, { hideAuthor: authorDisplay === 'hide' })}
				/>
			))}
		</div>
	);
}
