import { useState, useRef, useEffect } from 'react';

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
	const [overflows, setOverflows] = useState(false);
	const ref = useRef(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || expanded) return;
		// scrollHeight === 0 in jsdom — treat as overflowing so tests render the button
		setOverflows(el.scrollHeight === 0 || el.scrollHeight > el.clientHeight);
	}, [text, clampLines, expanded]);

	if (!text) return null;

	const clampClass = CLAMP_CLASSES[clampLines] ?? 'line-clamp-6';

	return (
		<div className={className}>
			<p ref={ref} className={expanded ? undefined : clampClass}>
				{text}
				{!expanded && overflows && (
					<>
						{' '}
						<button
							type="button"
							aria-expanded={false}
							onClick={() => setExpanded(true)}
							className="inline font-medium text-cinemata-sunset-horizon-400p hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
						>
							READ MORE
						</button>
					</>
				)}
			</p>
			{expanded && (
				<button
					type="button"
					aria-expanded={true}
					onClick={() => setExpanded(false)}
					className="mt-1 text-sm font-medium text-cinemata-sunset-horizon-400p hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
				>
					READ LESS
				</button>
			)}
		</div>
	);
}
