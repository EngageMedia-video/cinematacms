import { useEffect, useRef } from 'react';
import Tribute from 'tributejs';
import { fetchMentionSuggestions } from '../utils/mentions';
import '../components/MentionMenu.css';

const HTML_ESCAPES = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/** Tribute renders its templates as HTML, so every value we interpolate is escaped. */
function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** Only same-origin or absolute http(s) avatars are rendered, never `javascript:`. */
function safeAvatarSrc(value) {
	if (typeof value !== 'string' || value === '') return null;
	if (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')) {
		return value;
	}
	return null;
}

function renderMenuItem(item) {
	const user = item.original;
	const avatar = safeAvatarSrc(user.thumbnail_url);
	const name = user.name?.trim() || user.username;
	return [
		'<span class="mention-menu-item">',
		avatar
			? `<img class="mention-menu-avatar" src="${escapeHtml(avatar)}" alt="" aria-hidden="true" />`
			: '<span class="mention-menu-avatar" aria-hidden="true"></span>',
		'<span class="mention-menu-text">',
		`<span class="mention-menu-name">${escapeHtml(name)}</span>`,
		`<span class="mention-menu-handle">@${escapeHtml(user.username)}</span>`,
		'</span>',
		'</span>',
	].join('');
}

/**
 * Attach the Tribute.js @mention autocomplete to a comment input.
 *
 * Tribute writes the completed handle straight into the DOM node, so the
 * `tribute-replaced` event is bridged back to `onReplace(value, picked)` to
 * keep the controlled React value in step with what the user sees. `picked` is
 * the chosen user, which the caller needs to tell a committed mention apart
 * from a handle that is still being typed.
 *
 * Returns `isMenuOpen()`, which the form uses so that Enter picks a suggestion
 * instead of submitting the comment while the menu is showing.
 */
export function useMentionAutocomplete({ inputRef, onReplace, enabled = true }) {
	const tributeRef = useRef(null);
	const onReplaceRef = useRef(onReplace);

	useEffect(() => {
		onReplaceRef.current = onReplace;
	}, [onReplace]);

	useEffect(() => {
		const element = inputRef.current;
		if (!enabled || !element) return undefined;

		let inFlight = null;

		const tribute = new Tribute({
			trigger: '@',
			// The server ranks and limits the list, so Tribute must not re-filter it.
			searchOpts: { skip: true },
			lookup: 'username',
			fillAttr: 'username',
			menuShowMinLength: 0,
			requireLeadingSpace: true,
			allowSpaces: false,
			containerClass: 'mention-menu',
			itemClass: 'mention-menu-list-item',
			selectClass: 'mention-menu-item--active',
			selectTemplate: (item) => (item ? `@${item.original.username}` : ''),
			menuItemTemplate: renderMenuItem,
			noMatchTemplate: () => '<span class="mention-menu-empty">No matching people</span>',
			values: (query, populate) => {
				inFlight?.abort();
				inFlight = new AbortController();
				fetchMentionSuggestions(query, { signal: inFlight.signal })
					.then(populate)
					.catch((error) => {
						if (error?.name !== 'AbortError') populate([]);
					});
			},
		});

		tribute.attach(element);
		tributeRef.current = tribute;

		const handleReplaced = (event) => onReplaceRef.current?.(element.value, event.detail?.item?.original);
		element.addEventListener('tribute-replaced', handleReplaced);

		return () => {
			element.removeEventListener('tribute-replaced', handleReplaced);
			inFlight?.abort();
			tribute.detach(element);
			tributeRef.current = null;
		};
	}, [inputRef, enabled]);

	return {
		isMenuOpen: () => Boolean(tributeRef.current?.isActive),
	};
}
