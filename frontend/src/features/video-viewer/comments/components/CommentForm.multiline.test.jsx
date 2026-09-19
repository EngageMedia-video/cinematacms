/**
 * Cover for typing a comment across several lines: Shift+Enter adds a line,
 * Enter still posts. Issue #869.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pressEnter = (element, options = {}) =>
	fireEvent.keyDown(element, { key: 'Enter', keyCode: 13, which: 13, ...options });

const submitMutate = vi.fn();

vi.mock('../hooks/useSubmitComment', () => ({
	useSubmitComment: () => ({ mutate: submitMutate, isPending: false }),
}));

vi.mock('../hooks/usePlayerReady', () => ({
	usePlayerReady: () => false,
}));

const { CommentForm } = await import('./CommentForm');

describe('CommentForm multiline', () => {
	beforeEach(() => {
		submitMutate.mockClear();
		window.MediaCMS = { user: { username: 'viewer', name: 'Viewer', is: { anonymous: false } } };
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete window.MediaCMS;
		document.querySelectorAll('.mention-menu').forEach((node) => node.remove());
	});

	it('gives the writer a multi-line field', () => {
		render(<CommentForm friendlyToken="tok" />);

		expect(screen.getByLabelText('Leave a comment').tagName).toBe('TEXTAREA');
	});

	it('Shift+Enter does not post the comment', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('first line');
		pressEnter(input, { shiftKey: true });

		expect(submitMutate).not.toHaveBeenCalled();
	});

	it('Shift+Enter starts a new line in the field', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('first line{Shift>}{Enter}{/Shift}second line');

		expect(input).toHaveValue('first line\nsecond line');
	});

	it('posts the line breaks the writer typed', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('first line{Shift>}{Enter}{/Shift}second line');
		pressEnter(input);

		expect(submitMutate).toHaveBeenCalledWith('first line\nsecond line', expect.anything());
	});

	it('keeps the box from being squeezed as the field grows', () => {
		const { container } = render(<CommentForm friendlyToken="tok" />);

		// jsdom has no layout, so the class is the only observable here: inside
		// the capped comments panel a shrinkable box is pushed back to its old
		// height and the grown field overlaps the avatar and submit row.
		expect(container.firstChild).toHaveClass('shrink-0');
	});

	it('Enter on its own still posts the comment', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('one line');
		pressEnter(input);

		expect(submitMutate).toHaveBeenCalledWith('one line', expect.anything());
	});
});
