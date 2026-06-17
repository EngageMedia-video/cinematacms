/**
 * Validation for media metadata, shared between the single (#523) and bulk
 * (#524) upload flows. Mirrors the server-side rules enforced by `MediaForm`
 * so the client surfaces required fields before submit instead of relying on a
 * round-trip rejection. The authoritative validation still runs on the server.
 */

export const SYNOPSIS_MAX_WORDS = 80;

export function countSynopsisWords(text) {
	const value = (text ?? '').trim();
	if (!value) {
		return 0;
	}
	return value.split(/\s+/).length;
}

export function synopsisWordsRemaining(text) {
	return SYNOPSIS_MAX_WORDS - countSynopsisWords(text);
}

function isBlank(value) {
	return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Validate a single file's metadata for the "submit" action. Returns a map of
 * `{ fieldName: message }`; an empty object means the item is valid. Required
 * fields mirror what the server (MediaForm) enforces: summary, year_produced,
 * category, media_country and media_language. NOTE: the latter three are
 * `blank=True` on the Media model but MediaForm.__init__ overrides them to
 * `required=True`, so they are genuinely required on submit (single upload and
 * bulk alike). Drafts skip this entirely.
 */
export function validateMetadata(metadata = {}) {
	const errors = {};
	const currentYear = new Date().getFullYear();

	if (isBlank(metadata.summary)) {
		errors.summary = 'Synopsis is required.';
	} else if (countSynopsisWords(metadata.summary) > SYNOPSIS_MAX_WORDS) {
		errors.summary = `Synopsis should have ${SYNOPSIS_MAX_WORDS} words maximum.`;
	}

	if (isBlank(metadata.year_produced)) {
		errors.year_produced = 'Please select a year.';
	} else if (metadata.year_produced === 'other') {
		const custom = Number(metadata.year_produced_custom);
		if (!Number.isInteger(custom) || custom < 1900 || custom > currentYear) {
			errors.year_produced_custom = `Please enter a year between 1900 and ${currentYear}.`;
		}
	}

	if (!Array.isArray(metadata.category) || metadata.category.length === 0) {
		errors.category = 'Please select at least one category.';
	}

	if (isBlank(metadata.media_country)) {
		errors.media_country = 'Please select a country.';
	}

	if (isBlank(metadata.media_language)) {
		errors.media_language = 'Please select a language.';
	}

	if (!isBlank(metadata.website) && !String(metadata.website).startsWith('https://')) {
		errors.website = 'Website should start with https://';
	}

	if (metadata.requirePassword && isBlank(metadata.password)) {
		errors.password = 'Password has to be set when a password is required.';
	}

	return errors;
}

export function hasErrors(errors) {
	return Boolean(errors && Object.keys(errors).length > 0);
}
