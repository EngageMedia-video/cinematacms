export function SearchResultSection({ title, items, hasMore, query, renderItem, onSelect, withDivider = true }) {
	if (!items.length) return null;

	const showMoreHref = `/search?q=${encodeURIComponent(query)}`;

	return (
		<section
			className={
				'px-3 py-3 ' + (withDivider ? 'border-t border-cinemata-pacific-deep-700/60 first:border-t-0' : '')
			}
			aria-label={title}
		>
			<h3 className="body-body-12-medium px-2 pb-2 text-[11px] uppercase tracking-[0.08em] text-cinemata-pacific-deep-300">
				{title}
			</h3>
			<ul className="m-0 flex list-none flex-col gap-1 p-0">
				{items.map((item, idx) => (
					<li key={item.friendly_token || item.url || item.username || idx} className="list-none">
						{renderItem(item, idx, onSelect)}
					</li>
				))}
			</ul>
			{hasMore ? (
				<a
					href={showMoreHref}
					onClick={onSelect}
					className="mt-2 inline-flex items-center gap-1 rounded-[8px] px-2 py-1 body-body-12-medium text-cinemata-sunset-horizon-400p no-underline transition-colors duration-150 hover:text-cinemata-sunset-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
				>
					Show more
					<svg
						aria-hidden="true"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M9 6l6 6-6 6" />
					</svg>
				</a>
			) : null}
		</section>
	);
}
