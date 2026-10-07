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

describe('CommentText links', () => {
	it('renders a bare URL as a nofollow link that opens in the same tab', () => {
		render(<CommentText text="trailer at https://cinemata.org/watch?v=abc." />);

		const link = screen.getByRole('link', { name: 'https://cinemata.org/watch?v=abc' });
		expect(link).toHaveAttribute('href', 'https://cinemata.org/watch?v=abc');
		expect(link).toHaveAttribute('rel', 'nofollow noopener');
		expect(link).not.toHaveAttribute('target');
	});

	it('keeps a timestamp inside a URL as part of the link', () => {
		render(<CommentText text="compare https://example.org/clip?t=1:30" />);

		expect(screen.getByRole('link', { name: 'https://example.org/clip?t=1:30' })).toHaveAttribute(
			'href',
			'https://example.org/clip?t=1:30'
		);
		expect(screen.queryByRole('link', { name: '1:30' })).not.toBeInTheDocument();
	});

	it('links URLs, timestamps and mentions in one comment', () => {
		const { container } = render(<CommentText text={'@alice see 2:05\nmore at www.engagemedia.org'} />);

		expect(screen.getByRole('link', { name: '@alice' })).toHaveAttribute('href', '/user/alice');
		expect(screen.getByRole('link', { name: '2:05' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'www.engagemedia.org' })).toHaveAttribute(
			'href',
			'https://www.engagemedia.org/'
		);
		expect(container.textContent).toBe('@alice see 2:05\nmore at www.engagemedia.org');
	});

	it('keeps a handle that contains www. as one mention', () => {
		render(<CommentText text="thanks @www.studio and @ana-www.films" />);

		expect(screen.getByRole('link', { name: '@www.studio' })).toHaveAttribute('href', '/user/www.studio');
		expect(screen.getByRole('link', { name: '@ana-www.films' })).toHaveAttribute('href', '/user/ana-www.films');
		expect(screen.getAllByRole('link')).toHaveLength(2);
	});

	it('escapes markup typed into a comment', () => {
		const { container } = render(<CommentText text={'<b>bold</b> https://cinemata.org'} />);

		expect(container.querySelector('b')).toBeNull();
		expect(container.textContent).toBe('<b>bold</b> https://cinemata.org');
	});
});
