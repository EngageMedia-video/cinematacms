import { formatInnerLink, formatMediaLink } from './formatInnerLink';

describe('formatInnerLink', () => {
	it('joins a trailing-slash base URL and a root-relative path with a single slash', () => {
		expect(formatInnerLink('/media/hls/uid/media-1/stream.m3u8', 'https://host/')).toBe(
			'https://host/media/hls/uid/media-1/stream.m3u8'
		);
	});

	it('joins a base URL without a trailing slash unchanged', () => {
		expect(formatInnerLink('/media/original/video.mp4', 'https://host')).toBe(
			'https://host/media/original/video.mp4'
		);
	});

	// Deliberate: a "//host/path" input is treated as a path to join, not as a
	// protocol-relative URL. The API only ever emits root-relative paths, so a
	// leading "//" here is a sloppy join artifact, not a scheme-less URL.
	it('treats a double-slash-prefixed path as a path, collapsing boundary slashes', () => {
		expect(formatInnerLink('//media/file.mp4', 'https://host//')).toBe('https://host/media/file.mp4');
	});

	it('keeps absolute URLs untouched', () => {
		expect(formatInnerLink('https://cdn.example.com/media/file.mp4', 'https://host/')).toBe(
			'https://cdn.example.com/media/file.mp4'
		);
	});

	it('handles a null or empty path without throwing', () => {
		expect(formatInnerLink(null, 'https://host/')).toBe('https://host/');
		expect(formatInnerLink('', 'https://host/')).toBe('https://host/');
	});
});

describe('formatMediaLink', () => {
	it('joins with a single slash when the base URL has a trailing slash', () => {
		expect(formatMediaLink('/media/hls/uid/master.m3u8', 'https://host/')).toBe(
			'https://host/media/hls/uid/master.m3u8'
		);
	});

	it('appends the restricted-media token after a normalized join', () => {
		expect(formatMediaLink('/media/hls/uid/master.m3u8', 'https://host/', 'tok123')).toBe(
			'https://host/media/hls/uid/master.m3u8?token=tok123'
		);
	});

	it('does not add a token parameter for blank tokens', () => {
		expect(formatMediaLink('/media/file.mp4', 'https://host/', '  ')).toBe('https://host/media/file.mp4');
	});
});
