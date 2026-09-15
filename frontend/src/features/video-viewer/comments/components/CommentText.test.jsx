import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommentText } from './CommentText';

describe('CommentText mentions', () => {
	it('renders an @handle as a link to that profile', () => {
		render(<CommentText text="great work @alice" />);

		const link = screen.getByRole('link', { name: '@alice' });
		expect(link).toHaveAttribute('href', '/user/alice');
	});

	it('renders every mention in a line', () => {
		render(<CommentText text="@alice and @bob" />);

		expect(screen.getByRole('link', { name: '@alice' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '@bob' })).toBeInTheDocument();
	});

	it('links a non-ASCII handle to the right profile', () => {
		render(<CommentText text="thanks @José" />);

		expect(screen.getByRole('link', { name: '@José' })).toHaveAttribute(
			'href',
			`/user/${encodeURIComponent('José')}`
		);
	});

	it('does not linkify an email address', () => {
		render(<CommentText text="mail alice@example.com" />);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	it('keeps timestamp links working alongside mentions', () => {
		render(<CommentText text="1:30 nice shot @alice" />);

		expect(screen.getByRole('link', { name: '1:30' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '@alice' })).toHaveAttribute('href', '/user/alice');
	});

	it('renders mentions on later lines', () => {
		render(<CommentText text={'first line\nsecond @bob'} />);

		expect(screen.getByRole('link', { name: '@bob' })).toBeInTheDocument();
	});
});

describe('CommentText line breaks', () => {
	it('keeps the line breaks the writer typed', () => {
		const { container } = render(<CommentText text={'first line\nsecond line'} />);

		expect(container.textContent).toBe('first line\nsecond line');
	});

	it('renders those line breaks instead of collapsing them', () => {
		const { container } = render(<CommentText text={'first line\nsecond line'} />);

		// A collapsing container would show one run of text; pre-wrap is what
		// makes the stored newline visible.
		const lines = [...container.querySelectorAll('span')].filter((node) =>
			node.classList.contains('whitespace-pre-wrap')
		);
		expect(lines).toHaveLength(2);
	});

	it('keeps a blank line between paragraphs', () => {
		const { container } = render(<CommentText text={'one\n\nthree'} />);

		expect(container.textContent).toBe('one\n\nthree');
	});
});
