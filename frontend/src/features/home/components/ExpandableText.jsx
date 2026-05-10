import { useState } from 'react';

const CLAMP_CLASSES = {
	1: 'line-clamp-1',
	2: 'line-clamp-2',
	3: 'line-clamp-3',
	4: 'line-clamp-4',
	5: 'line-clamp-5',
	6: 'line-clamp-6',
};

export function ExpandableText({ text = '', clampLines = 6, className = '' }) {
	const [expanded, setExpanded] = useState(false);

	if (!text) {
		return null;
	}

	const clampClass = CLAMP_CLASSES[clampLines] ?? 'line-clamp-6';

	return (
		<div className={className}>
			<p className={expanded ? undefined : clampClass}>{text}</p>
			<button
				type="button"
				aria-expanded={expanded}
				onClick={() => setExpanded((prev) => !prev)}
				className="mt-1 text-sm font-medium text-cinemata-strait-blue-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
			>
				{expanded ? 'READ LESS' : 'READ MORE'}
			</button>
		</div>
	);
}
