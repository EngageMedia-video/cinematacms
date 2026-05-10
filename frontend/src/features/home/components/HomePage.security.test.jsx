import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import homeQueryClient from '../queryClient';
import { HomePage } from './HomePage';

vi.mock('./HeroVideoPlayer', () => ({
	default: function HeroVideoPlayerMock() {
		return <div data-testid="hero-video-player" />;
	},
}));

const XSS_DESCRIPTION = '<img src=x onerror=alert(1)>';
const FEATURED_WITH_XSS = {
	title: 'Safe Title',
	description: XSS_DESCRIPTION,
	thumbnail_url: 'https://example.com/thumb.jpg',
	author_name: 'Author',
	media_country: 'Philippines',
	views: 100,
	encodings_info: {},
	subtitles_info: [],
	url: '/media/safe/',
};

beforeEach(() => {
	homeQueryClient.clear();
	homeQueryClient.setQueryData(['home', 'featured'], [FEATURED_WITH_XSS]);
});

afterEach(() => {
	vi.restoreAllMocks();
	homeQueryClient.clear();
});

describe('HomePage security — plain-text description rendering', () => {
	it('description containing <img onerror=...> does not create an img element', () => {
		render(<HomePage />);
		// No <img> under the hero card from description
		const images = document.querySelectorAll('[data-modern-track] img');
		const descImages = Array.from(images).filter(
			(img) => img.getAttribute('alt') === null || img.getAttribute('src') === 'x'
		);
		expect(descImages).toHaveLength(0);
	});

	it('XSS string in description is visible as plain text', () => {
		render(<HomePage />);
		expect(screen.getByText(XSS_DESCRIPTION)).toBeInTheDocument();
	});

	it('no element under the page wrapper uses dangerouslySetInnerHTML for description', () => {
		render(<HomePage />);
		// React removes dangerouslySetInnerHTML from the DOM — verify by checking
		// that no element has innerHTML matching the XSS payload (it would be parsed as HTML tags)
		const pageWrapper = document.querySelector('[data-modern-track]');
		const allEls = pageWrapper ? Array.from(pageWrapper.querySelectorAll('*')) : [];
		const hasInjectedImg = allEls.some((el) => el.tagName === 'IMG' && el.getAttribute('src') === 'x');
		expect(hasInjectedImg).toBe(false);
	});
});

describe('HomePage accessibility baseline', () => {
	it('has exactly one h1 element', () => {
		homeQueryClient.setQueryData(['home', 'featured'], [FEATURED_WITH_XSS]);
		render(<HomePage />);
		expect(document.querySelectorAll('h1')).toHaveLength(1);
	});

	it('hero title renders as h2 (under the page h1)', () => {
		homeQueryClient.setQueryData(['home', 'featured'], [FEATURED_WITH_XSS]);
		render(<HomePage />);
		expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
	});

	it('expand toggle button has aria-expanded attribute', () => {
		render(<HomePage />);
		const expandBtn = screen.queryByRole('button', { name: 'READ MORE' });
		if (expandBtn) {
			expect(expandBtn).toHaveAttribute('aria-expanded');
		}
	});
});
