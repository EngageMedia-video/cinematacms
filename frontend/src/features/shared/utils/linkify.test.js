import { describe, expect, it } from 'vitest';
import { splitTextByLinks, toSafeHref } from './linkify';

describe('toSafeHref', () => {
	it('keeps an http or https URL', () => {
		expect(toSafeHref('https://cinemata.org/watch')).toBe('https://cinemata.org/watch');
		expect(toSafeHref('http://cinemata.org/watch')).toBe('http://cinemata.org/watch');
	});

	it('adds https to a bare www host', () => {
		expect(toSafeHref('www.cinemata.org')).toBe('https://www.cinemata.org/');
	});

	it('rejects a scheme that is not http or https', () => {
		expect(toSafeHref('javascript:alert(1)')).toBe('');
		expect(toSafeHref('data:text/html,<script>')).toBe('');
		expect(toSafeHref('not a url')).toBe('');
	});
});

describe('splitTextByLinks', () => {
	it('returns a single text segment when there is no URL', () => {
		expect(splitTextByLinks('A programme about rivers.')).toEqual([
			{ type: 'text', text: 'A programme about rivers.' },
		]);
	});

	it('splits a URL out of the surrounding text', () => {
		expect(splitTextByLinks('See https://cinemata.org/watch for details.')).toEqual([
			{ type: 'text', text: 'See ' },
			{ type: 'link', text: 'https://cinemata.org/watch', href: 'https://cinemata.org/watch' },
			{ type: 'text', text: ' for details.' },
		]);
	});

	it('detects several URLs, including a bare www host', () => {
		const segments = splitTextByLinks('http://a.example and www.b.example');

		expect(segments.filter((segment) => segment.type === 'link')).toEqual([
			{ type: 'link', text: 'http://a.example', href: 'http://a.example/' },
			{ type: 'link', text: 'www.b.example', href: 'https://www.b.example/' },
		]);
	});

	it('leaves sentence punctuation outside the link', () => {
		expect(splitTextByLinks('Screening at https://cinemata.org/watch.')).toEqual([
			{ type: 'text', text: 'Screening at ' },
			{ type: 'link', text: 'https://cinemata.org/watch', href: 'https://cinemata.org/watch' },
			{ type: 'text', text: '.' },
		]);
	});

	it('keeps a closing bracket that the URL opened', () => {
		const segments = splitTextByLinks('(see https://example.org/a_(b) now)');

		expect(segments[1]).toEqual({
			type: 'link',
			text: 'https://example.org/a_(b)',
			href: 'https://example.org/a_(b)',
		});
	});

	it('keeps markup in the text as text', () => {
		expect(splitTextByLinks('<script>alert(1)</script>')).toEqual([
			{ type: 'text', text: '<script>alert(1)</script>' },
		]);
	});

	it('does not link a URL-like string with an unsupported scheme', () => {
		expect(splitTextByLinks('ftp://files.example/movie.mkv')).toEqual([
			{ type: 'text', text: 'ftp://files.example/movie.mkv' },
		]);
	});

	it('renders a trailing link as text when the caller clipped the input', () => {
		expect(splitTextByLinks('See https://cinemata.org/wa', { allowTrailingLink: false })).toEqual([
			{ type: 'text', text: 'See https://cinemata.org/wa' },
		]);
	});

	it('returns no segments for empty input', () => {
		expect(splitTextByLinks('')).toEqual([]);
		expect(splitTextByLinks(null)).toEqual([]);
	});
});
