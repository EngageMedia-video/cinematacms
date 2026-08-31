import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { mentionRangeAtCaret, splitTextByMentions } from '../utils/mentions';
import './MentionHighlightInput.css';

const TYPOGRAPHY = 'h-6 p-0 text-sm leading-6';

/**
 * The comment field, with each @mention coloured in place and treated as one
 * unit by the delete keys.
 *
 * `inputRef` is the caller's ref on the real <input>, so Tribute.js and the
 * timestamp button keep working against the same node.
 *
 * `committedHandles` lists the handles the user actually picked from the
 * suggestion menu. Only those delete as one unit — a handle still being typed
 * has to stay editable one character at a time so a typo can be fixed.
 */
export function MentionHighlightInput({
	inputRef,
	value,
	onChange,
	onKeyDown,
	committedHandles,
	className = '',
	...inputProps
}) {
	const backdropRef = useRef(null);
	const pendingCaret = useRef(null);

	const isCommitted = (handle) =>
		(committedHandles ?? []).some((committed) => committed.toLowerCase() === handle.toLowerCase());

	// A controlled input drops the caret at the end after a programmatic edit,
	// so put it back where the deleted mention started.
	useLayoutEffect(() => {
		const input = inputRef.current;
		if (pendingCaret.current === null || !input) return;
		input.setSelectionRange(pendingCaret.current, pendingCaret.current);
		pendingCaret.current = null;
	});

	const syncScroll = useCallback(() => {
		const input = inputRef.current;
		const backdrop = backdropRef.current;
		if (input && backdrop) backdrop.scrollLeft = input.scrollLeft;
	}, [inputRef]);

	useEffect(syncScroll, [value, syncScroll]);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return undefined;
		input.addEventListener('scroll', syncScroll);
		return () => input.removeEventListener('scroll', syncScroll);
	}, [inputRef, syncScroll]);

	const handleKeyDown = (event) => {
		const isBackspace = event.key === 'Backspace';
		const isDelete = event.key === 'Delete';

		if (isBackspace || isDelete) {
			const input = event.target;
			const caret = input.selectionStart;
			const hasSelection = input.selectionStart !== input.selectionEnd;

			if (!hasSelection && caret !== null) {
				const range = mentionRangeAtCaret(value, caret, isBackspace ? 'backward' : 'forward');
				if (range && isCommitted(range.handle)) {
					event.preventDefault();
					pendingCaret.current = range.start;
					onChange(value.slice(0, range.start) + value.slice(range.end));
					return;
				}
			}
		}

		onKeyDown?.(event);
	};

	return (
		<span className="mention-input-shell">
			<span ref={backdropRef} aria-hidden="true" className={`mention-input-backdrop ${TYPOGRAPHY}`}>
				{splitTextByMentions(value).map((segment, index) =>
					segment.type === 'mention' ? (
						<span key={index} className="mention-input-token">
							{segment.value}
						</span>
					) : (
						<span key={index}>{segment.value}</span>
					)
				)}
			</span>
			<input
				{...inputProps}
				ref={inputRef}
				type="text"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={handleKeyDown}
				onScroll={syncScroll}
				className={`mention-input-field ${TYPOGRAPHY} ${className}`}
			/>
		</span>
	);
}
