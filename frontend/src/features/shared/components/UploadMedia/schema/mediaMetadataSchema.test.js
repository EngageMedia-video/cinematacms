import {
	validateMetadata,
	countSynopsisWords,
	hasErrors,
	synopsisWordsRemaining,
	SYNOPSIS_MAX_WORDS,
} from './mediaMetadataSchema';

const validMetadata = {
	title: 'My Film',
	summary: 'A short synopsis.',
	year_produced: '2021',
	category: [1],
	topics: [2],
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
		expect(errors.title).toBeTruthy();
		expect(errors.summary).toBeTruthy();
		expect(errors.year_produced).toBeTruthy();
		expect(errors.category).toBeTruthy();
		expect(errors.topics).toBeTruthy();
		expect(errors.media_country).toBeTruthy();
		expect(errors.media_language).toBeTruthy();
	});

	it('rejects a synopsis over the word cap', () => {
		const longSummary = Array.from({ length: SYNOPSIS_MAX_WORDS + 1 }, () => 'word').join(' ');
		expect(validateMetadata({ ...validMetadata, summary: longSummary }).summary).toContain(
			String(SYNOPSIS_MAX_WORDS)
		);
	});

	it('validates the year range (positive year through current, from the year picker)', () => {
		expect(validateMetadata({ ...validMetadata, year_produced: '0' }).year_produced).toBeTruthy();
		expect(validateMetadata({ ...validMetadata, year_produced: 'abc' }).year_produced).toBeTruthy();
		expect(validateMetadata({ ...validMetadata, year_produced: '1800' }).year_produced).toBeUndefined();
		expect(validateMetadata({ ...validMetadata, year_produced: '1995' }).year_produced).toBeUndefined();
		expect(validateMetadata({ ...validMetadata, year_produced: '2010' }).year_produced).toBeUndefined();
	});

	it('requires an https website', () => {
		expect(validateMetadata({ ...validMetadata, website: 'http://x.com' }).website).toBeTruthy();
		expect(validateMetadata({ ...validMetadata, website: 'https://x.com' }).website).toBeUndefined();
	});

	it('requires a password when status is restricted', () => {
		expect(validateMetadata({ ...validMetadata, state: 'restricted' }).password).toBeTruthy();
		expect(
			validateMetadata({ ...validMetadata, state: 'restricted', password: 'secret12' }).password
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
