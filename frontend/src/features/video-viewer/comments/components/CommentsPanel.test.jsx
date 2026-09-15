import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsPanel } from './CommentsPanel';
import { useComments } from '../hooks/useComments';

vi.mock('../hooks/useComments', () => ({
	useComments: vi.fn(),
}));

vi.mock('../hooks/useHiddenBelowCount', () => ({
	useHiddenBelowCount: () => 0,
}));

vi.mock('./CommentForm', () => ({
	CommentForm: ({ onSubmitted }) => (
		<button type="button" data-testid="comment-form" onClick={() => onSubmitted?.()}>
			post
		</button>
	),
}));

vi.mock('./CommentItem', () => ({
	CommentItem: () => <li data-testid="comment-item" />,
}));

const loaded = (overrides = {}) => ({
	data: { count: 0, results: [], commentsDisabled: false },
	isLoading: false,
	isError: false,
	refetch: vi.fn(),
	...overrides,
});

describe('CommentsPanel', () => {
	beforeEach(() => {
		useComments.mockReturnValue(loaded());
	});

	it('uses the shared primary action token for the expand comments button', () => {
		render(<CommentsPanel friendlyToken="media-token" variant="sidebar" onExpandToggle={() => {}} />);

		const button = screen.getByRole('button', { name: 'Expand comments' });

		expect(button).toHaveClass('bg-bg-primary');
		expect(button).toHaveClass('hover:bg-bg-primary-hover');
	});

	it('shows a disabled notice and hides the form when comments are turned off', () => {
		render(<CommentsPanel friendlyToken="media-token" variant="sidebar" commentsDisabled />);

		expect(screen.getByText('Comments are disabled for this video.')).toBeInTheDocument();
		expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
		expect(useComments).toHaveBeenCalledWith('media-token', { enabled: false });
	});

	it('shows a disabled notice when the response marks the media as private', () => {
		useComments.mockReturnValue(loaded({ data: { count: 0, results: [], commentsDisabled: true } }));

		render(<CommentsPanel friendlyToken="media-token" variant="sidebar" />);

		expect(screen.getByText('Comments are disabled for this video.')).toBeInTheDocument();
		expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
	});
});

describe('CommentsPanel scroll to the posted comment', () => {
	let scrollTo;

	const withComments = (texts) => ({
		count: texts.length,
		results: texts.map((text, index) => ({ uid: `c${index}`, text })),
		commentsDisabled: false,
	});

	beforeEach(() => {
		scrollTo = vi.fn();
		// jsdom has no scrollTo on an element, and no layout to scroll.
		Element.prototype.scrollTo = scrollTo;
		window.matchMedia = vi.fn().mockReturnValue({ matches: false });
		useComments.mockReturnValue(loaded({ data: withComments(['first']) }));
	});

	afterEach(() => {
		delete Element.prototype.scrollTo;
		delete window.matchMedia;
	});

	it('does not scroll while the viewer is only reading', () => {
		const { rerender } = render(<CommentsPanel friendlyToken="media-token" />);

		useComments.mockReturnValue(loaded({ data: withComments(['first', 'second']) }));
		rerender(<CommentsPanel friendlyToken="media-token" />);

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('scrolls to the end once the list has reloaded with the posted comment', () => {
		const { rerender } = render(<CommentsPanel friendlyToken="media-token" />);

		fireEvent.click(screen.getByTestId('comment-form'));
		// The post itself must not scroll: the new comment is not rendered yet.
		expect(scrollTo).not.toHaveBeenCalled();

		useComments.mockReturnValue(loaded({ data: withComments(['first', 'mine']) }));
		rerender(<CommentsPanel friendlyToken="media-token" />);

		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
	});

	it('scrolls only once per posted comment', () => {
		const { rerender } = render(<CommentsPanel friendlyToken="media-token" />);

		fireEvent.click(screen.getByTestId('comment-form'));
		useComments.mockReturnValue(loaded({ data: withComments(['first', 'mine']) }));
		rerender(<CommentsPanel friendlyToken="media-token" />);

		useComments.mockReturnValue(loaded({ data: withComments(['first', 'mine', 'theirs']) }));
		rerender(<CommentsPanel friendlyToken="media-token" />);

		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	it('jumps without animation when the viewer asks for reduced motion', () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: true });
		const { rerender } = render(<CommentsPanel friendlyToken="media-token" />);

		fireEvent.click(screen.getByTestId('comment-form'));
		useComments.mockReturnValue(loaded({ data: withComments(['first', 'mine']) }));
		rerender(<CommentsPanel friendlyToken="media-token" />);

		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
	});
});
