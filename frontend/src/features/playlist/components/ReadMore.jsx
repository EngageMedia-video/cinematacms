import { useId } from 'react';
import { cn } from '../../shared/utils/classNames';
import usePlaylistUiStore from '../store/usePlaylistUiStore';

const TRUNCATION_SLACK = 60;

function truncateAtWord(text, budget) {
	const slice = text.slice(0, budget);
	const lastSpace = slice.lastIndexOf(' ');
	return lastSpace > budget * 0.6 ? slice.slice(0, lastSpace) : slice;
}

export function ReadMore({ id, text, charBudget = 300, colorClassName = 'text-text-primary', className = '' }) {
	const generatedId = useId();
	const textId = id || generatedId;
	const expanded = usePlaylistUiStore((state) => Boolean(state.expandedTextIds[textId]));
	const toggleExpandedText = usePlaylistUiStore((state) => state.toggleExpandedText);

	if (!text) {
		return null;
	}

	const shouldOfferToggle = text.length > charBudget + TRUNCATION_SLACK;
	const visibleText = !shouldOfferToggle || expanded ? text : `${truncateAtWord(text, charBudget)}...`;

	return (
		<p id={textId} className={cn('m-0 break-words body-body-14-regular', colorClassName, className)}>
			{visibleText}{' '}
			{shouldOfferToggle ? (
				<button
					type="button"
					aria-controls={textId}
					aria-expanded={expanded}
					onClick={() => toggleExpandedText(textId)}
					className="inline rounded-ds-4 border-0 bg-transparent p-0 align-baseline text-text-accent hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-bold"
				>
					{expanded ? 'READ LESS' : 'READ MORE'}
				</button>
			) : null}
		</p>
	);
}
