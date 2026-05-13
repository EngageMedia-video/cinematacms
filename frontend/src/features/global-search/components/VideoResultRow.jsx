function formatDuration(seconds) {
	if (!seconds && seconds !== 0) return '';
	const total = Math.max(0, Math.round(Number(seconds) || 0));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoResultRow({ item, onSelect }) {
	const title = item.title || 'Untitled';
	const author = item.author_name || '';
	const thumb = item.thumbnail_url || '';
	const url = item.url || (item.friendly_token ? `/view?m=${item.friendly_token}` : '#');
	const duration = formatDuration(item.duration);

	return (
		<a
			href={url}
			onClick={onSelect}
			className="group flex items-start gap-3 rounded-[10px] px-2 py-2 text-left no-underline text-inherit transition-colors duration-150 hover:bg-cinemata-pacific-deep-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
		>
			<span className="relative block h-[44px] w-[78px] shrink-0 overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-700">
				{thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
				{duration ? (
					<span className="body-body-12-regular absolute right-1 bottom-1 rounded-[4px] bg-cinemata-black/70 px-1.5 py-0.5 text-[10px] leading-none text-cinemata-strait-blue-50">
						{duration}
					</span>
				) : null}
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="body-body-14-medium line-clamp-2 text-cinemata-strait-blue-50">{title}</span>
				{author ? <span className="body-body-12-regular text-cinemata-pacific-deep-300">{author}</span> : null}
			</span>
		</a>
	);
}
