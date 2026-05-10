import { render, screen, within } from '@testing-library/react';
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

describe('Carousel — default shape', () => {
	it('shows items 0-3 initially with 8 items and visibleCount=4', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);
		expect(screen.getByText('Item 0')).toBeInTheDocument();
		expect(screen.getByText('Item 3')).toBeInTheDocument();
		expect(screen.queryByText('Item 4')).toBeNull();
	});

	it('advances to items 4-7 after clicking right arrow', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		await user.click(screen.getByRole('button', { name: 'Next page' }));

		expect(screen.getByText('Item 4')).toBeInTheDocument();
		expect(screen.getByText('Item 7')).toBeInTheDocument();
		expect(screen.queryByText('Item 0')).toBeNull();
	});

	it('right arrow is disabled on the last page', async () => {
		const user = userEvent.setup();
		render(<Carousel items={makeItems(8)} visibleCount={4} />);

		await user.click(screen.getByRole('button', { name: 'Next page' }));
		expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
	});

	it('left arrow is disabled on the first page', () => {
		render(<Carousel items={makeItems(8)} visibleCount={4} />);
		expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
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

	it('switching currentPage from 2 to 0 moves visible slice without remounting items', () => {
		const items = makeItems(12);
		const { rerender } = render(<Carousel items={items} visibleCount={4} currentPage={2} />);
		expect(screen.getByText('Item 8')).toBeInTheDocument();

		rerender(<Carousel items={items} visibleCount={4} currentPage={0} />);
		expect(screen.getByText('Item 0')).toBeInTheDocument();
		expect(screen.queryByText('Item 8')).toBeNull();
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
