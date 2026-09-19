/**
 * Cover for who sees the delete control. The server decides through
 * `can_delete` on each comment; the component must not widen that. Issue #869.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommentItem } from './CommentItem';

const baseComment = {
	uid: 'c1',
	text: 'hello',
	add_date: '2026-09-01T10:00:00Z',
	author_name: 'Alice',
};

function renderItem(comment) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<CommentItem comment={{ ...baseComment, ...comment }} friendlyToken="tok" />
		</QueryClientProvider>
	);
}

function setUser(can) {
	window.MediaCMS = { user: { username: 'viewer', is: { anonymous: false }, can } };
}

describe('CommentItem delete control', () => {
	beforeEach(() => {
		setUser({ deleteComment: false });
	});

	afterEach(() => {
		delete window.MediaCMS;
	});

	it('offers delete on a comment the server says this viewer may delete', () => {
		renderItem({ can_delete: true });

		expect(screen.getByLabelText('Comment options')).toBeInTheDocument();
	});

	it('hides delete on a comment the server says this viewer may not delete', () => {
		setUser({ deleteComment: true });
		renderItem({ can_delete: false });

		expect(screen.queryByLabelText('Comment options')).not.toBeInTheDocument();
	});

	it('falls back to the page-wide permission when the comment carries no flag', () => {
		setUser({ deleteComment: true });
		renderItem({});

		expect(screen.getByLabelText('Comment options')).toBeInTheDocument();
	});

	it('offers nothing to a signed-out visitor', () => {
		window.MediaCMS = { user: { is: { anonymous: true }, can: { deleteComment: true } } };
		renderItem({ can_delete: true });

		expect(screen.queryByLabelText('Comment options')).not.toBeInTheDocument();
	});
});
