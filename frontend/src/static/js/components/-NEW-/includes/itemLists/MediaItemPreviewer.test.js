import { describe, expect, it, vi } from 'vitest';
import MediaItemPreviewer from './MediaItemPreviewer';

vi.mock('../../../../pages/_PageStore', () => ({ default: { get: vi.fn() } }));

describe('media thumbnail previews', () => {
	it('renders a PNG-only preview and preserves its version query', () => {
		const previewer = new MediaItemPreviewer(['png']);
		const item = document.createElement('div');
		item.innerHTML = '<div class="item-img-preview"></div>';

		previewer.newImage('/media/preview?v=3', 120, 90, item);

		expect(item.querySelector('picture img').getAttribute('src')).toBe('/media/preview.png?v=3');
	});

	it('renders a WebP source with a PNG fallback', () => {
		const previewer = new MediaItemPreviewer(['webp', 'png']);
		const item = document.createElement('div');
		item.innerHTML = '<div class="item-img-preview"></div>';

		previewer.newImage('/media/preview?v=3', 120, 90, item);

		expect(item.querySelector('source').getAttribute('srcset')).toBe('/media/preview.webp?v=3');
		expect(item.querySelector('img').getAttribute('src')).toBe('/media/preview.png?v=3');
	});

	it.each(['jpg', 'jpeg', 'gif', 'webp'])('preserves %s previews', (extension) => {
		const previewer = new MediaItemPreviewer([extension]);
		const item = document.createElement('div');
		item.innerHTML = '<div class="item-img-preview"></div>';

		previewer.newImage('/media/preview', 120, 90, item);

		expect(item.querySelector('img').getAttribute('src')).toBe(`/media/preview.${extension}`);
	});

	it.each([[], ['unknown']])('does not render a preview without a supported format: %j', (...extensions) => {
		const previewer = new MediaItemPreviewer(extensions);
		expect(previewer.element).toBeNull();
	});
});
