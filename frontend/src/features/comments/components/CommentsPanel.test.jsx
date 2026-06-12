import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsPanel } from './CommentsPanel';
import { useComments } from '../hooks/useComments';

vi.mock('../hooks/useComments', () => ({
	useComments: vi.fn(),
}));

vi.mock('../hooks/useHiddenBelowCount', () => ({
	useHiddenBelowCount: () => 0,
}));

vi.mock('./CommentForm', () => ({
	CommentForm: () => <div data-testid="comment-form" />,
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
