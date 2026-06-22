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
		errors.summary = 'This field is required';
	} else if (countSynopsisWords(metadata.summary) > SYNOPSIS_MAX_WORDS) {
		errors.summary = `Synopsis should have ${SYNOPSIS_MAX_WORDS} words maximum.`;
	}

	// Year is a free-text field (2000..current), mirroring single-upload.
	const year = String(metadata.year_produced ?? '').trim();
	if (!year) {
		errors.year_produced = 'This field is required';
	} else if (!/^\d+$/.test(year) || Number(year) < 2000 || Number(year) > currentYear) {
		errors.year_produced = `Enter a year between 2000 and ${currentYear}`;
	}

	if (!Array.isArray(metadata.category) || metadata.category.length === 0) {
		errors.category = 'Select at least one category';
	}

	if (isBlank(metadata.media_country)) {
		errors.media_country = 'Select a media country';
	}

	if (isBlank(metadata.media_language)) {
		errors.media_language = 'Select a media language';
	}

	if (!isBlank(metadata.website) && !String(metadata.website).startsWith('https://')) {
		errors.website = 'Website should start with https://';
	}

	if (metadata.state === 'restricted' && isBlank(metadata.password)) {
		errors.password = 'Password has to be set when state is Restricted.';
	}

	return errors;
}

export function hasErrors(errors) {
	return Boolean(errors && Object.keys(errors).length > 0);
}
