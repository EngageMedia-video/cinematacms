// Splits plain text into text and link segments so a caller can render URLs as
// anchors without letting author-supplied markup reach the DOM. The detector
// lives here so every caller shares one definition of "this looks like a link".

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;
const CLOSING_BRACKETS = { ')': '(', ']': '[', '}': '{' };

function countOccurrences(value, character) {
	return value.split(character).length - 1;
}

// A URL that ends a sentence or sits inside a parenthetical picks up characters
// that are not part of the address. Drop them unless the URL opened the bracket.
function trimBoundaryCharacters(match) {
	let value = match.replace(TRAILING_PUNCTUATION, '');

	while (value.length > 0) {
		const lastCharacter = value.slice(-1);
		const openingBracket = CLOSING_BRACKETS[lastCharacter];

		if (!openingBracket) {
			break;
		}

		if (countOccurrences(value, lastCharacter) <= countOccurrences(value, openingBracket)) {
			break;
		}

		value = value.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
	}

	return value;
}

// Returns an absolute http(s) URL, or an empty string when the value cannot be
// followed safely.
export function toSafeHref(value) {
	const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

	let url;

	try {
		url = new URL(candidate);
	} catch {
		return '';
	}

	return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
}

// Returns `[{ type: 'text', text }, { type: 'link', text, href }]` segments in
// source order. Set `allowTrailingLink` to false when the input was clipped, so
// a half-copied address renders as text instead of a link to the wrong page.
export function splitTextByLinks(text, { allowTrailingLink = true } = {}) {
	if (!text) {
		return [];
	}

	const segments = [];
	let cursor = 0;

	function pushText(value) {
		if (!value) {
			return;
		}

		const previous = segments[segments.length - 1];

		if (previous && previous.type === 'text') {
			previous.text += value;
			return;
		}

		segments.push({ type: 'text', text: value });
	}

	for (const match of text.matchAll(URL_PATTERN)) {
		const candidate = trimBoundaryCharacters(match[0]);
		const href = toSafeHref(candidate);
		const end = match.index + candidate.length;
		const isClippedTail = !allowTrailingLink && end === text.length;

		pushText(text.slice(cursor, match.index));

		if (href && !isClippedTail) {
			segments.push({ type: 'link', text: candidate, href });
		} else {
			pushText(candidate);
		}

		cursor = end;
	}

	pushText(text.slice(cursor));

	return segments;
}
