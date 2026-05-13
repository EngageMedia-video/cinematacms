export function EmptyState({ query }) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
			<p className="body-body-14-medium text-cinemata-strait-blue-50">No results for &ldquo;{query}&rdquo;</p>
			<p className="body-body-12-regular text-cinemata-pacific-deep-300">
				Try a different keyword or check the spelling.
			</p>
		</div>
	);
}
