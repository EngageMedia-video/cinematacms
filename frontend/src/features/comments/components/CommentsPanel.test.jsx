import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommentsPanel } from './CommentsPanel';

vi.mock('../hooks/useComments', () => ({
	useComments: () => ({
		data: { count: 0, results: [] },
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	}),
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

describe('CommentsPanel', () => {
	it('uses the shared primary action token for the expand comments button', () => {
		render(<CommentsPanel friendlyToken="media-token" variant="sidebar" onExpandToggle={() => {}} />);

		const button = screen.getByRole('button', { name: 'Expand comments' });

		expect(button).toHaveClass('bg-bg-primary');
		expect(button).toHaveClass('hover:bg-bg-primary-hover');
	});
});
