/**
 * Integration cover for the @mention box using the real Tribute.js, so the
 * bridge between Tribute's direct DOM writes and the controlled React input is
 * exercised rather than mocked.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Tribute.js keys off the legacy `keyCode`, which jsdom/user-event leave at 0
// but every real browser still populates. Fire Enter explicitly so the test
// exercises the same path a browser takes.
const pressEnter = (element) => fireEvent.keyDown(element, { key: 'Enter', keyCode: 13, which: 13 });

const submitMutate = vi.fn();

vi.mock('../hooks/useSubmitComment', () => ({
	useSubmitComment: () => ({ mutate: submitMutate, isPending: false }),
}));

vi.mock('../hooks/usePlayerReady', () => ({
	usePlayerReady: () => false,
}));

const { CommentForm } = await import('./CommentForm');

describe('CommentForm @mentions', () => {
	beforeEach(() => {
		submitMutate.mockClear();
		window.MediaCMS = { user: { username: 'viewer', name: 'Viewer', is: { anonymous: false } } };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => [{ username: 'alice', name: 'Alice Anderson', thumbnail_url: null }],
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete window.MediaCMS;
		document.querySelectorAll('.mention-menu').forEach((node) => node.remove());
	});

	it('opens the people menu when @ is typed and filters as the user types', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);

		await user.click(screen.getByLabelText('Leave a comment'));
		await user.keyboard('@al');

		await waitFor(() => expect(screen.getByText('Alice Anderson')).toBeInTheDocument());
		expect(screen.getByText('@alice')).toBeInTheDocument();
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('/api/v1/users/mention-suggestions?q=al'),
			expect.anything()
		);
	});

	it('Enter picks the highlighted person instead of submitting the comment', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('@al');
		await waitFor(() => expect(screen.getByText('Alice Anderson')).toBeInTheDocument());

		pressEnter(input);

		expect(submitMutate).not.toHaveBeenCalled();
		await waitFor(() => expect(input).toHaveValue('@alice '));
	});

	it('submits the comment with the resolved handle once the menu is closed', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('@al');
		await waitFor(() => expect(screen.getByText('Alice Anderson')).toBeInTheDocument());
		pressEnter(input);
		await waitFor(() => expect(input).toHaveValue('@alice '));

		await user.keyboard('nice work');
		pressEnter(input);

		expect(submitMutate).toHaveBeenCalledWith('@alice nice work', expect.anything());
	});

	it('highlights the chosen person inside the field', async () => {
		const user = userEvent.setup();
		const { container } = render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('@al');
		await waitFor(() => expect(screen.getByText('Alice Anderson')).toBeInTheDocument());
		pressEnter(input);
		await waitFor(() => expect(input).toHaveValue('@alice '));

		const tokens = [...container.querySelectorAll('.mention-input-token')].map((node) => node.textContent);
		expect(tokens).toEqual(['@alice']);
	});

	it('Backspace removes the whole chosen mention rather than one letter', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);
		const input = screen.getByLabelText('Leave a comment');

		await user.click(input);
		await user.keyboard('@al');
		await waitFor(() => expect(screen.getByText('Alice Anderson')).toBeInTheDocument());
		pressEnter(input);
		await waitFor(() => expect(input).toHaveValue('@alice '));

		// The first Backspace clears the space Tribute appends.
		await user.keyboard('{Backspace}');
		await waitFor(() => expect(input).toHaveValue('@alice'));

		await user.keyboard('{Backspace}');
		await waitFor(() => expect(input).toHaveValue(''));
	});

	it('Enter still submits when no mention menu is open', async () => {
		const user = userEvent.setup();
		render(<CommentForm friendlyToken="tok" />);

		const input = screen.getByLabelText('Leave a comment');
		await user.click(input);
		await user.keyboard('plain comment');
		pressEnter(input);

		expect(submitMutate).toHaveBeenCalledWith('plain comment', expect.anything());
	});
});
