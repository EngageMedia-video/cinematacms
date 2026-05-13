export function PlaylistResultRow({ item, onSelect }) {
	const title = item.title || 'Untitled playlist';
	const author = item.user || '';
	const mediaCount = typeof item.media_count === 'number' ? item.media_count : null;
	const thumb = item.thumbnail_url || '';
	const url = item.url || '#';

	const subtitle = [author ? `by ${author}` : null, mediaCount !== null ? `${mediaCount} videos` : null]
		.filter(Boolean)
		.join(' . ');

	return (
		<a
			href={url}
			onClick={onSelect}
			className="group flex items-start gap-3 rounded-[10px] px-2 py-2 text-left no-underline text-inherit transition-colors duration-150 hover:bg-cinemata-pacific-deep-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
		>
			<span className="relative flex h-[44px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-700">
				{thumb ? (
					<img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : (
					<span aria-hidden="true" className="body-body-12-regular text-cinemata-pacific-deep-300">
						List
					</span>
				)}
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-1 right-1 w-[5px] rounded-[2px] bg-cinemata-pacific-deep-900/70"
				/>
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="body-body-14-medium line-clamp-2 text-cinemata-strait-blue-50">{title}</span>
				{subtitle ? (
					<span className="body-body-12-regular text-cinemata-pacific-deep-300">{subtitle}</span>
				) : null}
			</span>
		</a>
	);
}
