import { render } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimilarProfiles } from '../hooks/useSimilarProfiles';
import { SimilarProfiles } from './SimilarProfiles';

vi.mock('../hooks/useSimilarProfiles', () => ({
	useSimilarProfiles: vi.fn(),
}));

// UserRoleBadge reads window.matchMedia, which jsdom does not implement.
const originalMatchMedia = window.matchMedia;

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

afterAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: originalMatchMedia,
	});
});

describe('SimilarProfiles', () => {
	beforeEach(() => {
		useSimilarProfiles.mockReturnValue({
			data: { results: [] },
			isLoading: false,
			isError: false,
		});
	});

	it('uses the profile owner country code instead of their free-text location', () => {
		render(
			<SimilarProfiles
				author={{
					username: 'jen',
					location: 'Metro Manila, Philippines',
					location_country: 'PH',
					location_info: [{ title: 'Philippines' }],
				}}
			/>
		);

		expect(useSimilarProfiles).toHaveBeenCalledWith('jen', 'PH');
	});

	it('falls back to the structured country label for older profile payloads', () => {
		render(
			<SimilarProfiles
				author={{
					username: 'jen',
					location: 'Metro Manila, Philippines',
					location_info: [{ title: 'Philippines' }],
				}}
			/>
		);

		expect(useSimilarProfiles).toHaveBeenCalledWith('jen', 'Philippines');
	});

	describe('narrow-column reflow guards', () => {
		// jsdom does not lay out, so these assert the classes that carry the
		// reflow behaviour rather than the rendered geometry. The visual proof
		// is the manual screenshot pass recorded on the pull request.
		const profile = {
			username: 'ana',
			name: 'Ana Reyes',
			media_count: 489,
			date_added: '2019-04-01T00:00:00Z',
			is_trusted: false,
			is_manager: false,
		};

		function renderProfiles(profiles) {
			useSimilarProfiles.mockReturnValue({
				data: { results: profiles },
				isLoading: false,
				isError: false,
			});
			return render(<SimilarProfiles author={{ username: 'jen', location_country: 'PH' }} />);
		}

		it('lets the stats row wrap so its two chunks stack instead of wrapping mid-chunk', () => {
			const { container } = renderProfiles([profile]);

			const statsRow = container.querySelector('.flex-wrap');
			expect(statsRow).not.toBeNull();

			const chunks = statsRow.querySelectorAll('.whitespace-nowrap');
			expect(chunks).toHaveLength(2);
		});

		it('lets each card shrink to its grid track', () => {
			const { container } = renderProfiles([profile]);

			const card = container.querySelector('article');
			expect(card.className).toContain('min-w-0');
		});

		it('keeps a long username inside its card', () => {
			const longUsername = 'a'.repeat(40);
			const { getByText } = renderProfiles([{ ...profile, username: longUsername }]);

			// break-words only breaks between words, so it cannot split a single
			// unbroken 40-character token. break-all is what keeps it in the card.
			const username = getByText(`@${longUsername}`);
			expect(username.className).toContain('break-all');
			expect(username.className).toContain('min-w-0');
		});

		it('renders one card per similar profile', () => {
			const { container } = renderProfiles(
				Array.from({ length: 4 }, (_, index) => ({ ...profile, username: `member${index}` }))
			);

			expect(container.querySelectorAll('article')).toHaveLength(4);
		});

		it('renders nothing when there are no similar profiles', () => {
			const { container } = renderProfiles([]);

			expect(container).toBeEmptyDOMElement();
		});

		it('still renders four columns at the xl breakpoint', () => {
			const { container } = renderProfiles([profile]);

			const grid = container.querySelector('.grid');
			expect(grid.className).toContain('xl:grid-cols-4');
		});
	});
});
