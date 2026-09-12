/**
 * @mention helpers shared by the comment box (autocomplete) and the rendered
 * comment body (linking a handle to its profile).
 *
 * The handle pattern mirrors `files.mentions.MENTION_RE` on the server: a
 * mention starts at the beginning of the text or after whitespace, so an email
 * address is never read as a mention, and trailing sentence punctuation is not
 * part of the handle. The two patterns must stay in step, or a handle the
 * server resolves would render here as plain text or, worse, as a truncated
 * link to the wrong profile.
 */

// The handle class matches Python's ``\w`` (letters, digits, marks, connector
// punctuation) rather than JavaScript's ASCII-only ``\w``, so a handle such as
// "@José" parses the same here as it does in files/mentions.py. Django's
// UnicodeUsernameValidator accepts those usernames.
const MENTION_PATTERN = /(^|\s)@([\p{L}\p{N}\p{M}\p{Pc}][\p{L}\p{N}\p{M}\p{Pc}.@-]*)/gu;
const TRAILING_PUNCTUATION = /[.\-_@]+$/;

export const MENTION_SUGGESTIONS_URL = '/api/v1/users/mention-suggestions';

/** Fetch autocomplete candidates for `query` (the text typed after "@"). */
export async function fetchMentionSuggestions(query, { signal } = {}) {
	const url = `${MENTION_SUGGESTIONS_URL}?q=${encodeURIComponent(query ?? '')}`;
	const response = await fetch(url, {
		credentials: 'same-origin',
		headers: { Accept: 'application/json' },
		signal,
	});
	if (!response.ok) {
		throw new Error(`Failed to load mention suggestions: ${response.status}`);
	}
	const data = await response.json();
	return Array.isArray(data) ? data : [];
}

/**
 * Split `text` into plain and mention segments so the comment body can render
 * a handle as a profile link without ever injecting HTML.
 */
export function splitTextByMentions(text) {
	const value = String(text ?? '');
	if (value === '') return [];

	const segments = [];
	let cursor = 0;

	MENTION_PATTERN.lastIndex = 0;
	let match = MENTION_PATTERN.exec(value);
	while (match !== null) {
		const [, leading, rawHandle] = match;
		const handle = rawHandle.replace(TRAILING_PUNCTUATION, '');
		if (handle === '') {
			match = MENTION_PATTERN.exec(value);
			continue;
		}

		const mentionStart = match.index + leading.length;
		if (mentionStart > cursor) {
			segments.push({ type: 'text', value: value.slice(cursor, mentionStart) });
		}
		segments.push({ type: 'mention', value: `@${handle}`, handle });
		cursor = mentionStart + 1 + handle.length;
		MENTION_PATTERN.lastIndex = cursor;
		match = MENTION_PATTERN.exec(value);
	}

	if (cursor < value.length) {
		segments.push({ type: 'text', value: value.slice(cursor) });
	}
	return segments;
}

/** Profile URL for a handle, matching the `get_user` route on the server. */
export function mentionProfileHref(handle) {
	return `/user/${encodeURIComponent(handle)}`;
}

/**
 * Character ranges of every mention in `text`, in order. `start` is the index
 * of the "@" and `end` is one past the last character of the handle.
 */
export function mentionRanges(text) {
	const ranges = [];
	let offset = 0;
	for (const segment of splitTextByMentions(text)) {
		const end = offset + segment.value.length;
		if (segment.type === 'mention') {
			ranges.push({ start: offset, end, handle: segment.handle });
		}
		offset = end;
	}
	return ranges;
}

/**
 * The mention a delete keystroke should remove whole, or null when the caret is
 * not touching one.
 *
 * `direction` is 'backward' for Backspace, which acts on the mention the caret
 * sits inside or immediately after, and 'forward' for Delete, which acts on the
 * mention the caret sits inside or immediately before.
 */
export function mentionRangeAtCaret(text, caret, direction) {
	const ranges = mentionRanges(text);
	const match =
		direction === 'backward'
			? ranges.find((range) => caret > range.start && caret <= range.end)
			: ranges.find((range) => caret >= range.start && caret < range.end);
	return match ?? null;
}
