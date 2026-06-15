import {
	validateMetadata,
	countSynopsisWords,
	hasErrors,
	synopsisWordsRemaining,
	SYNOPSIS_MAX_WORDS,
} from './mediaMetadataSchema';

const validMetadata = {
	summary: 'A short synopsis.',
	year_produced: '2021',
	category: [1],
	media_country: 'PH',
	media_language: 'en',
};

describe('countSynopsisWords', () => {
	it('counts words and collapses extra whitespace', () => {
		expect(countSynopsisWords('  hello   world ')).toBe(2);
		expect(countSynopsisWords('')).toBe(0);
		expect(countSynopsisWords(null)).toBe(0);
	});
});

describe('synopsisWordsRemaining', () => {
	it('returns the remaining word budget', () => {
		expect(synopsisWordsRemaining('one two')).toBe(SYNOPSIS_MAX_WORDS - 2);
	});
});

describe('validateMetadata', () => {
	it('passes for complete metadata', () => {
		expect(validateMetadata(validMetadata)).toEqual({});
	});

	it('flags the required fields when empty', () => {
		const errors = validateMetadata({});
		expect(errors.summary).toBeTruthy();
		expect(errors.year_produced).toBeTruthy();
		expect(errors.category).toBeTruthy();
		expect(errors.media_country).toBeTruthy();
		expect(errors.media_language).toBeTruthy();
	});

	it('rejects a synopsis over the word cap', () => {
		const longSummary = Array.from({ length: SYNOPSIS_MAX_WORDS + 1 }, () => 'word').join(' ');
		expect(validateMetadata({ ...validMetadata, summary: longSummary }).summary).toContain(
			String(SYNOPSIS_MAX_WORDS)
		);
	});

	it('validates the custom year range when "other" is chosen', () => {
		expect(
			validateMetadata({ ...validMetadata, year_produced: 'other', year_produced_custom: '1800' })
				.year_produced_custom
		).toBeTruthy();
		expect(
			validateMetadata({ ...validMetadata, year_produced: 'other', year_produced_custom: '2010' })
				.year_produced_custom
		).toBeUndefined();
	});

	it('requires an https website', () => {
		expect(validateMetadata({ ...validMetadata, website: 'http://x.com' }).website).toBeTruthy();
		expect(validateMetadata({ ...validMetadata, website: 'https://x.com' }).website).toBeUndefined();
	});

	it('requires a password when one is requested', () => {
		expect(validateMetadata({ ...validMetadata, requirePassword: true }).password).toBeTruthy();
		expect(
			validateMetadata({ ...validMetadata, requirePassword: true, password: 'secret12' }).password
		).toBeUndefined();
	});
});

describe('hasErrors', () => {
	it('returns false for empty, null, or undefined error objects', () => {
		expect(hasErrors({})).toBe(false);
		expect(hasErrors(null)).toBe(false);
		expect(hasErrors(undefined)).toBe(false);
	});

	it('returns true for non-empty error objects', () => {
		expect(hasErrors({ summary: 'Required' })).toBe(true);
	});
});
