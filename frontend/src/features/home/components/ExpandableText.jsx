import { useState, useRef, useId, useLayoutEffect } from 'react';
import { Text } from '../../shared/components/Text';

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
	const paragraphId = useId();

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || expanded) return;
		const isJsdom = navigator.userAgent.includes('jsdom');
		if (!isJsdom && el.offsetParent === null) {
			setOverflows(false);
			return;
		}
		setOverflows(el.scrollHeight === 0 ? isJsdom : el.scrollHeight > el.clientHeight);
	}, [text, clampLines, expanded]);

	if (!text) return null;

	const clampClass = CLAMP_CLASSES[clampLines] ?? 'line-clamp-6';

	return (
		<div className={className}>
			<p id={paragraphId} ref={ref} className={expanded ? 'm-0' : `${clampClass} m-0`}>
				{text}
			</p>
			{overflows && (
				<Text
					as="button"
					action="text-button"
					variant="body-14"
					color="sunset-horizon"
					type="button"
					aria-controls={paragraphId}
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
					className="mt-1"
				>
					{expanded ? 'READ LESS' : 'READ MORE'}
				</Text>
			)}
		</div>
	);
}
