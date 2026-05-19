import { Text } from '../../shared/components/Text';

export function EmptyState({ query }) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
			<Text variant="body-14" className="m-0 text-cinemata-strait-blue-50">
				No results for &ldquo;{query}&rdquo;
			</Text>
			<Text variant="body-12" className="m-0 text-cinemata-pacific-deep-300">
				Try a different keyword or check the spelling.
			</Text>
		</div>
	);
}
