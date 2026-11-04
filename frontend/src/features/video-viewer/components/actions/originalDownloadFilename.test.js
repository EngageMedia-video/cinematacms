import { describe, expect, it } from 'vitest';

import { originalDownloadFilename } from './originalDownloadFilename';

describe('originalDownloadFilename', () => {
	it('appends the extension of the original file to the title', () => {
		expect(
			originalDownloadFilename(
				'3.4 Single upload',
				'/media/original/user/admin/cc7e3816eb2642f78238b5d8bf8ec31f.3877494hd_1920_1080_24fps.mp4?v=1793765569033'
			)
		).toBe('3.4 Single upload.mp4');
	});

	it('reads the extension from an absolute URL with a fragment', () => {
		expect(originalDownloadFilename('Poster', 'https://example.org/media/original/a.b.PNG#x')).toBe('Poster.PNG');
	});

	it('keeps a title that already ends with the extension', () => {
		expect(originalDownloadFilename('clip.MP4', '/media/original/uid.clip.mp4')).toBe('clip.MP4');
	});

	it('keeps the title when the original file has no extension', () => {
		expect(originalDownloadFilename('Untitled', '/media/original/user/admin/noext')).toBe('Untitled');
		expect(originalDownloadFilename('Untitled', '/media/original.dir/noext')).toBe('Untitled');
		expect(originalDownloadFilename('Untitled', '/media/original/.hidden')).toBe('Untitled');
	});

	it('does not mistake the uid storage prefix for an extension', () => {
		expect(
			originalDownloadFilename('Cover', '/media/original/user/admin/cc7e3816eb2642f78238b5d8bf8ec31f.cover?v=1')
		).toBe('Cover');
	});

	it('keeps the title when there is no original URL', () => {
		expect(originalDownloadFilename('Untitled', undefined)).toBe('Untitled');
	});
});
