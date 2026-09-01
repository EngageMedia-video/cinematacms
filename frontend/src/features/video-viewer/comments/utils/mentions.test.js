import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchMentionSuggestions,
	mentionProfileHref,
	mentionRangeAtCaret,
	mentionRanges,
	splitTextByMentions,
} from './mentions';

describe('splitTextByMentions', () => {
	it('returns nothing for empty text', () => {
		expect(splitTextByMentions('')).toEqual([]);
		expect(splitTextByMentions(null)).toEqual([]);
	});

	it('returns a single plain segment when there is no mention', () => {
		expect(splitTextByMentions('hello there')).toEqual([{ type: 'text', value: 'hello there' }]);
	});

	it('splits a mention at the start of the text', () => {
		expect(splitTextByMentions('@alice hi')).toEqual([
			{ type: 'mention', value: '@alice', handle: 'alice' },
			{ type: 'text', value: ' hi' },
		]);
	});

	it('splits a mention after whitespace', () => {
		expect(splitTextByMentions('hi @alice')).toEqual([
			{ type: 'text', value: 'hi ' },
			{ type: 'mention', value: '@alice', handle: 'alice' },
		]);
	});

	it('splits several mentions in one line', () => {
		expect(splitTextByMentions('@alice and @bob')).toEqual([
			{ type: 'mention', value: '@alice', handle: 'alice' },
			{ type: 'text', value: ' and ' },
			{ type: 'mention', value: '@bob', handle: 'bob' },
		]);
	});

	it('parses a handle with non-ASCII letters, matching the server', () => {
		// Django's UnicodeUsernameValidator allows these usernames, and
		// files/mentions.py resolves them, so the field must not truncate them.
		expect(splitTextByMentions('hey @José welcome')).toEqual([
			{ type: 'text', value: 'hey ' },
			{ type: 'mention', value: '@José', handle: 'José' },
			{ type: 'text', value: ' welcome' },
		]);
	});

	it('parses a handle written in a non-Latin script', () => {
		expect(splitTextByMentions('hi @наталья')).toEqual([
			{ type: 'text', value: 'hi ' },
			{ type: 'mention', value: '@наталья', handle: 'наталья' },
		]);
	});

	it('leaves an email address alone', () => {
		expect(splitTextByMentions('write to alice@example.com')).toEqual([
			{ type: 'text', value: 'write to alice@example.com' },
		]);
	});

	it('keeps trailing sentence punctuation out of the handle', () => {
		expect(splitTextByMentions('thanks @alice.')).toEqual([
			{ type: 'text', value: 'thanks ' },
			{ type: 'mention', value: '@alice', handle: 'alice' },
			{ type: 'text', value: '.' },
		]);
	});
});

describe('mentionProfileHref', () => {
	it('points at the profile route and escapes the handle', () => {
		expect(mentionProfileHref('alice')).toBe('/user/alice');
		expect(mentionProfileHref('a b')).toBe('/user/a%20b');
	});
});

describe('fetchMentionSuggestions', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('requests the endpoint with the encoded query and returns the list', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => [{ username: 'alice', name: 'Alice', thumbnail_url: null }],
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await fetchMentionSuggestions('al ice');

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/v1/users/mention-suggestions?q=al%20ice',
			expect.objectContaining({ credentials: 'same-origin' })
		);
		expect(result).toEqual([{ username: 'alice', name: 'Alice', thumbnail_url: null }]);
	});

	it('throws when the endpoint fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

		await expect(fetchMentionSuggestions('a')).rejects.toThrow('403');
	});

	it('returns an empty list when the payload is not an array', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		await expect(fetchMentionSuggestions('a')).resolves.toEqual([]);
	});
});

describe('mentionRanges', () => {
	it('reports the span of each mention', () => {
		expect(mentionRanges('hi @alice and @bob')).toEqual([
			{ start: 3, end: 9, handle: 'alice' },
			{ start: 14, end: 18, handle: 'bob' },
		]);
	});

	it('reports nothing when there is no mention', () => {
		expect(mentionRanges('hi there')).toEqual([]);
	});
});

describe('mentionRangeAtCaret', () => {
	const text = 'hi @alice there';

	it('claims the mention the caret sits just after, on Backspace', () => {
		expect(mentionRangeAtCaret(text, 9, 'backward')).toMatchObject({ start: 3, end: 9 });
	});

	it('claims the mention the caret sits inside, on Backspace', () => {
		expect(mentionRangeAtCaret(text, 6, 'backward')).toMatchObject({ start: 3, end: 9 });
	});

	it('ignores a caret at the very start of the mention, on Backspace', () => {
		expect(mentionRangeAtCaret(text, 3, 'backward')).toBeNull();
	});

	it('claims the mention the caret sits just before, on Delete', () => {
		expect(mentionRangeAtCaret(text, 3, 'forward')).toMatchObject({ start: 3, end: 9 });
	});

	it('ignores a caret at the very end of the mention, on Delete', () => {
		expect(mentionRangeAtCaret(text, 9, 'forward')).toBeNull();
	});

	it('ignores a caret in ordinary text', () => {
		expect(mentionRangeAtCaret(text, 12, 'backward')).toBeNull();
	});
});
