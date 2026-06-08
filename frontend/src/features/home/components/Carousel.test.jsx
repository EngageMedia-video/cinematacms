import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Carousel } from './Carousel';

function makeItems(count) {
	return Array.from({ length: count }, (_, i) => ({
		friendly_token: `token-${i}`,
		title: `Item ${i}`,
		thumbnail_url: '',
		url: `/media/item-${i}/`,
		duration_in_seconds: 120,
		author_name: `Author ${i}`,
	}));
}

const originalMatchMedia = window.matchMedia;
const originalResizeObserver = window.ResizeObserver;

function mockViewportWidth(width) {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: query.includes('max-width: 639px')
				? width <= 639
				: query.includes('max-width: 1023px')
					? width <= 1023
					: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

function mockCarouselContainerWidth(width) {
	class ResizeObserverMock {
		constructor(callback) {
			this.callback = callback;
		}

		observe(target) {
			this.callback([{ target, contentRect: { width } }]);
		}

		disconnect() {}
	}

	Object.defineProperty(window, 'ResizeObserver', {
		configurable: true,
		writable: true,
		value: ResizeObserverMock,
	});
}

afterEach(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: originalMatchMedia,
	});
	Object.defineProperty(window, 'ResizeObserver', {
		configurable: true,
		writable: true,
		value: originalResizeObserver,
	});
	vi.restoreAllMocks();
});

describe('Carousel — default shape', () => {
	it('shows items 0-3 initially with 8 items and visibleCount=4', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);
		expect(screen.getByText('Item 0')).toBeInTheDocument();
		expect(screen.getByText('Item 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'true');
	});

	it('sizes items so there is no cropped fifth-card peek', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		const firstItemShell = screen.getByRole('link', { name: 'Open Item 0' }).closest('article').parentElement;

		expect(firstItemShell).toHaveStyle({ width: 'calc(25% - 0.75rem)' });
	});

	it('advances to page 1 after clicking right arrow', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		await user.click(screen.getByRole('button', { name: 'Next page' }));

		expect(screen.getByText('Item 4')).toBeInTheDocument();
		expect(screen.getByText('Item 7')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');
	});

	it('uses the Figma caret circle asset for overlay arrows', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		const nextButton = screen.getByRole('button', { name: 'Next page' });
		const icon = nextButton.querySelector('svg[data-icon="caretCircleRight"]');

		expect(nextButton).toHaveClass('hidden');
		expect(nextButton).toHaveClass('md:flex');
		expect(nextButton).toHaveClass('size-[70px]');
		expect(nextButton).toHaveClass('-right-6');
		expect(nextButton).toHaveClass('lg:-right-8');
		expect(nextButton).toHaveClass('text-text-secondary');
		expect(icon).toBeInTheDocument();
	});

	it('right arrow is not shown on the last page', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		await user.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
	});

	it('left arrow is not shown on the first page', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);
		expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull();
	});

	it('clicking dot N jumps to page N', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
		expect(screen.getByText('Item 4')).toBeInTheDocument();
	});

	it('active dot has aria-current="true"', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		const dot1 = screen.getByRole('button', { name: 'Go to page 1' });
		const dot2 = screen.getByRole('button', { name: 'Go to page 2' });

		expect(dot1).toHaveAttribute('aria-current', 'true');
		expect(dot2).not.toHaveAttribute('aria-current');

		await user.click(dot2);
		expect(dot2).toHaveAttribute('aria-current', 'true');
		expect(dot1).not.toHaveAttribute('aria-current');
	});

	it('keeps carousel dot buttons at a 24px accessible target size', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		const dot = screen.getByRole('button', { name: 'Go to page 2' });

		expect(dot).toHaveClass('size-6');
		expect(dot.firstElementChild).toHaveClass('size-2');
	});

	it('caps page dots at seven so many pages cannot overflow the row', () => {
		render(<Carousel items={makeItems(20)} visibleCount={1} />);

		const dots = screen.getAllByRole('button', { name: /^Go to page \d+$/ });
		expect(dots).toHaveLength(7);
		expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Go to page 8' })).toBeNull();
	});

	it('shrinks the boundary dot when more pages exist beyond the window', () => {
		render(<Carousel items={makeItems(20)} visibleCount={1} />);

		const trailingEdge = screen.getByRole('button', { name: 'Go to page 7' });
		expect(trailingEdge.firstElementChild).toHaveClass('size-1.5');
	});

	it('slides the dot window to keep the active page in view', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(20)} visibleCount={1} />);

		await user.click(screen.getByRole('button', { name: 'Go to page 7' }));

		expect(screen.getByRole('button', { name: 'Go to page 7' })).toHaveAttribute('aria-current', 'true');
		expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Go to page 1' })).toBeNull();
	});

	it('defaults to one visible item on phone viewports', () => {
		mockViewportWidth(390);
		render(<Carousel items={makeItems(4)} />);

		const firstItemShell = screen.getByRole('link', { name: 'Open Item 0' }).closest('article').parentElement;

		expect(firstItemShell).toHaveStyle({ width: 'calc(100% - 0rem)' });
		expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeInTheDocument();
	});

	it('defaults to two visible items on tablet viewports', () => {
		mockViewportWidth(820);
		render(<Carousel items={makeItems(4)} />);

		const firstItemShell = screen.getByRole('link', { name: 'Open Item 0' }).closest('article').parentElement;

		expect(firstItemShell).toHaveStyle({ width: 'calc(50% - 0.5rem)' });
		expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
	});

	it('uses the carousel container width over the viewport when deciding visible items', async () => {
		mockViewportWidth(1280);
		mockCarouselContainerWidth(820);
		render(<Carousel items={makeItems(8)} />);

		const firstItemShell = screen.getByRole('link', { name: 'Open Item 0' }).closest('article').parentElement;

		await waitFor(() => expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument());
		expect(screen.queryByRole('button', { name: 'Go to page 4' })).toBeNull();
		expect(firstItemShell).toHaveStyle({ width: 'calc(33.333333333333336% - 0.6666666666666666rem)' });
	});

	it('swipes left to the next page on touch devices', () => {
		const { container } = render(<Carousel items={makeItems(4)} visibleCount={1} />);
		const track = container.querySelector('[data-carousel-track]');

		fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'touch', clientX: 320, clientY: 120 });
		fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 128 });

		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');
	});

	it('swipes right to the previous page on touch devices', () => {
		const { container } = render(<Carousel items={makeItems(4)} visibleCount={1} defaultPage={1} />);
		const track = container.querySelector('[data-carousel-track]');

		fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 120 });
		fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'touch', clientX: 320, clientY: 128 });

		expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'true');
	});

	it('swipes back from a partial last page when only two items remain', () => {
		const { container } = render(<Carousel items={makeItems(6)} visibleCount={4} defaultPage={1} />);
		const track = container.querySelector('[data-carousel-track]');

		expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');

		fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 120 });
		fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'touch', clientX: 320, clientY: 128 });

		expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'true');
	});

	it('syncs dots from native horizontal scrolling', () => {
		const { container } = render(<Carousel items={makeItems(8)} visibleCount={4} />);
		const track = container.querySelector('[data-carousel-track]');
		track.scrollTo = vi.fn();

		Object.defineProperty(track, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1616 });
		Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 500 });
		fireEvent.scroll(track);

		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');
		expect(track.scrollTo).not.toHaveBeenCalled();
	});

	it('keeps programmatic paging stable during smooth scroll events', async () => {
		const user = userEvent.setup();
		const { container } = render(<Carousel items={makeItems(12)} visibleCount={4} />);
		const track = container.querySelector('[data-carousel-track]');
		track.scrollTo = vi.fn();

		Object.defineProperty(track, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 2448 });
		Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 0, writable: true });

		await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');

		track.scrollLeft = 240;
		fireEvent.scroll(track);

		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');
	});

	it('keeps vertical drags from changing carousel pages', () => {
		const { container } = render(<Carousel items={makeItems(4)} visibleCount={1} />);
		const track = container.querySelector('[data-carousel-track]');

		fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'touch', clientX: 320, clientY: 120 });
		fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 260 });

		expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'true');
	});

	it('does not pointer-capture item links on press', () => {
		const { container } = render(<Carousel items={makeItems(4)} visibleCount={1} />);
		const track = container.querySelector('[data-carousel-track]');
		track.setPointerCapture = vi.fn();

		fireEvent.pointerDown(screen.getByRole('link', { name: 'Open Item 0' }), {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 120,
			clientY: 120,
		});

		expect(track.setPointerCapture).not.toHaveBeenCalled();
	});

	it('hides overlay arrow controls on mobile while keeping them available on desktop', () => {
		render(<Carousel items={makeItems(4)} visibleCount={1} />);

		const nextButton = screen.getByRole('button', { name: 'Next page' });
		expect(nextButton).toHaveClass('hidden');
		expect(nextButton).toHaveClass('md:flex');
	});
});

describe('Carousel — compound shape', () => {
	it('dots above track: both render and dots stay in sync with paging', async () => {
		const user = userEvent.setup();
		render(
			<Carousel items={makeItems(8)} visibleCount={4}>
				<Carousel.Dots />
				<Carousel.Track />
			</Carousel>
		);

		expect(screen.getByText('Item 0')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
		expect(screen.getByText('Item 4')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'true');
	});

	it('omitting Arrows renders track + dots only; dots still page', async () => {
		const user = userEvent.setup();
		render(
			<Carousel items={makeItems(8)} visibleCount={4}>
				<Carousel.Track />
				<Carousel.Dots />
			</Carousel>
		);

		expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
		expect(screen.getByText('Item 4')).toBeInTheDocument();
	});
});

describe('Carousel — controlled mode', () => {
	it('pinned to page 1 without onPageChange even when arrow clicked', async () => {
		// 12 items / 4 visible = 3 pages (0,1,2); page 1 is middle — arrow enabled
		const user = userEvent.setup();
		render(<Carousel items={makeItems(12)} visibleCount={4} currentPage={1} />);

		expect(screen.getByText('Item 4')).toBeInTheDocument();
		// Arrow click with no onPageChange — no state update, stays on page 1
		await user.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByText('Item 4')).toBeInTheDocument();
	});

	it('calls onPageChange(2) when right arrow clicked on page 1', async () => {
		const onPageChange = vi.fn();
		const user = userEvent.setup();
		// 12 items / 4 visible = 3 pages; page 1 → next is page 2
		render(<Carousel items={makeItems(12)} visibleCount={4} currentPage={1} onPageChange={onPageChange} />);

		await user.click(screen.getByRole('button', { name: 'Next page' }));
		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it('switching currentPage from 2 to 0 updates the active dot', () => {
		const items = makeItems(12);
		const { rerender } = render(<Carousel items={items} visibleCount={4} currentPage={2} />);
		expect(screen.getByRole('button', { name: 'Go to page 3' })).toHaveAttribute('aria-current', 'true');

		rerender(<Carousel items={items} visibleCount={4} currentPage={0} />);
		expect(screen.getByText('Item 0')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'true');
	});

	it('uses the clamped safe page when controlledPage is out of range', async () => {
		const onPageChange = vi.fn();
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} currentPage={99} onPageChange={onPageChange} />);

		await user.click(screen.getByRole('button', { name: 'Previous page' }));

		expect(onPageChange).toHaveBeenCalledWith(0);
	});
});

describe('Carousel — re-render discipline', () => {
	it('does not install setInterval or setTimeout for auto-rotation', () => {
		const intervalSpy = vi.spyOn(window, 'setInterval');
		const timeoutSpy = vi.spyOn(window, 'setTimeout');

		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		expect(intervalSpy).not.toHaveBeenCalled();
		expect(timeoutSpy).not.toHaveBeenCalled();

		vi.restoreAllMocks();
	});

	it('does not read from or write to window.history or window.location', () => {
		const pushStateSpy = vi.spyOn(window.history, 'pushState');
		const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

		const { unmount } = render(<Carousel items={makeItems(8)} visibleCount={4} />);
		unmount();

		expect(pushStateSpy).not.toHaveBeenCalled();
		expect(replaceStateSpy).not.toHaveBeenCalled();

		vi.restoreAllMocks();
	});
});
