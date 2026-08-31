import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MentionHighlightInput } from './MentionHighlightInput';

function Harness({ initialValue = '', committedHandles = ['alice'], onKeyDown }) {
	const inputRef = useRef(null);
	const [value, setValue] = useState(initialValue);
	return (
		<MentionHighlightInput
			inputRef={inputRef}
			aria-label="comment"
			value={value}
			onChange={setValue}
			onKeyDown={onKeyDown}
			committedHandles={committedHandles}
		/>
	);
}

const caretAt = (input, position) => input.setSelectionRange(position, position);
const backspace = (input) => fireEvent.keyDown(input, { key: 'Backspace' });

describe('MentionHighlightInput', () => {
	it('colours the mention and leaves the rest of the text plain', () => {
		const { container } = render(<Harness initialValue="hi @alice there" />);
		const backdrop = container.querySelector('.mention-input-backdrop');

		const tokens = [...backdrop.querySelectorAll('.mention-input-token')].map((node) => node.textContent);
		expect(tokens).toEqual(['@alice']);
		// The backdrop reproduces the field text exactly, spacing included.
		expect(backdrop.textContent).toBe('hi @alice there');
	});

	it('keeps the input value readable to assistive tech and to the form', () => {
		render(<Harness initialValue="hi @alice" />);

		expect(screen.getByLabelText('comment')).toHaveValue('hi @alice');
	});

	it('Backspace just after a mention removes the whole mention', () => {
		render(<Harness initialValue="hi @alice" />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 9);
		backspace(input);

		expect(input).toHaveValue('hi ');
	});

	it('Backspace inside a mention removes the whole mention', () => {
		render(<Harness initialValue="hi @alice there" />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 6);
		backspace(input);

		expect(input).toHaveValue('hi  there');
	});

	it('Delete just before a mention removes the whole mention', () => {
		render(<Harness initialValue="hi @alice there" />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 3);
		fireEvent.keyDown(input, { key: 'Delete' });

		expect(input).toHaveValue('hi  there');
	});

	it('leaves the caret where the mention was', () => {
		render(<Harness initialValue="hi @alice there" />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 9);
		backspace(input);

		expect(input.selectionStart).toBe(3);
	});

	it('does not touch ordinary characters', () => {
		const onKeyDown = vi.fn();
		render(<Harness initialValue="hi there" onKeyDown={onKeyDown} />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 8);
		backspace(input);

		expect(onKeyDown).toHaveBeenCalled();
		expect(input).toHaveValue('hi there');
	});

	it('deletes one character at a time from a handle that was never picked', () => {
		render(<Harness initialValue="hi @alice" committedHandles={[]} />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 9);
		backspace(input);

		// preventDefault is not called, so the browser removes the single character.
		expect(input).toHaveValue('hi @alice');
	});

	it('matches a picked handle regardless of case', () => {
		render(<Harness initialValue="hi @Alice" committedHandles={['alice']} />);
		const input = screen.getByLabelText('comment');

		caretAt(input, 9);
		backspace(input);

		expect(input).toHaveValue('hi ');
	});

	it('leaves a selected range to the browser', () => {
		render(<Harness initialValue="hi @alice" />);
		const input = screen.getByLabelText('comment');

		input.setSelectionRange(0, 9);
		backspace(input);

		expect(input).toHaveValue('hi @alice');
	});
});
