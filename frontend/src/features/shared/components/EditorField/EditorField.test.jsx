import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorField } from './EditorField';

describe('EditorField', () => {
	it('renders label, textarea, helper text, and default rows', () => {
		render(
			<EditorField label="Synopsis" placeholder="The Blue Boat sails again" helperText="Visible helper copy" />
		);

		const textarea = screen.getByLabelText('Synopsis');
		const helperText = screen.getByText('Visible helper copy');

		expect(textarea.tagName).toBe('TEXTAREA');
		expect(textarea).toHaveAttribute('rows', '5');
		expect(helperText).toBeVisible();
		expect(textarea).toHaveAccessibleDescription('Visible helper copy');
	});

	it('clamps rows to a minimum of five and allows larger values', () => {
		const { rerender } = render(<EditorField label="Synopsis" rows={2} />);

		expect(screen.getByLabelText('Synopsis')).toHaveAttribute('rows', '5');

		rerender(<EditorField label="Synopsis" rows={8} />);

		expect(screen.getByLabelText('Synopsis')).toHaveAttribute('rows', '8');
	});

	it('supports className overrides and forwards textarea props', () => {
		render(<EditorField label="Notes" className="px-4" name="notes" defaultValue="Blue Boat notes" />);

		const textarea = screen.getByLabelText('Notes');
		expect(textarea).toHaveAttribute('name', 'notes');
		expect(textarea).toHaveValue('Blue Boat notes');
	});

	it('keeps textarea focused while typing', async () => {
		const user = userEvent.setup();
		render(<EditorField label="Focused editor" placeholder="Type synopsis" />);

		const textarea = screen.getByLabelText('Focused editor');
		await user.click(textarea);
		expect(textarea).toHaveFocus();

		await user.type(textarea, 'A');
		expect(textarea).toHaveValue('A');
	});

	it('focuses the textarea when the surrounding editor area is clicked', async () => {
		const user = userEvent.setup();
		render(<EditorField label="Clickable editor" />);

		const textarea = screen.getByLabelText('Clickable editor');

		await user.click(textarea.closest('.field-shell'));

		expect(textarea).toHaveFocus();
	});

	it('uses error tokens and aria-invalid when invalid', () => {
		render(<EditorField label="Synopsis" helperText="Synopsis is required." invalid />);

		const textarea = screen.getByLabelText('Synopsis');
		const helperText = screen.getByText('Synopsis is required.');

		expect(helperText).toBeVisible();
		expect(textarea).toHaveAttribute('aria-invalid', 'true');
		expect(textarea).toHaveAccessibleDescription('Synopsis is required.');
	});

	it('uses disabled classes and disabled textarea semantics', () => {
		render(
			<EditorField label="Synopsis" helperText="Read only for now." disabled defaultValue="Blue Boat summary" />
		);

		const textarea = screen.getByLabelText('Synopsis');
		expect(textarea).toBeDisabled();
		expect(textarea).toHaveValue('Blue Boat summary');
	});

	it('uses the shared themed input surface instead of the browser default background', () => {
		render(<EditorField label="Themed editor" />);

		expect(screen.getByLabelText('Themed editor')).toHaveClass('field-input', 'bg-transparent');
	});

	it('shows a muted word counter on the helper text row when enabled', () => {
		render(
			<EditorField
				label="Synopsis"
				helperText="Maximum 5 words"
				defaultValue="The Blue Boat"
				enableCounter
				maxWordsLength={5}
			/>
		);

		const textarea = screen.getByLabelText('Synopsis');
		const counter = screen.getByText('3/5 words');

		expect(counter).toBeVisible();
		expect(counter).toHaveClass('text-text-muted');
		expect(textarea).toHaveAccessibleDescription('Maximum 5 words 3/5 words');
	});

	it('counts words without a maximum when only the counter is enabled', () => {
		render(<EditorField label="Synopsis" defaultValue="The Blue Boat" enableCounter />);

		expect(screen.getByText('3 words')).toBeVisible();
	});

	it('limits pasted text to maxWordsLength before notifying onChange', () => {
		const handleChange = vi.fn();
		render(<EditorField label="Synopsis" enableCounter maxWordsLength={3} onChange={handleChange} />);

		const textarea = screen.getByLabelText('Synopsis');
		fireEvent.change(textarea, { target: { value: 'one two three four five' } });

		expect(textarea).toHaveValue('one two three');
		expect(screen.getByText('3/3 words')).toBeVisible();
		expect(handleChange).toHaveBeenCalledTimes(1);
		expect(handleChange.mock.calls[0][0].target.value).toBe('one two three');
	});

	it('blocks typed words beyond maxWordsLength without changing the last allowed word', async () => {
		const user = userEvent.setup();
		render(<EditorField label="Synopsis" enableCounter maxWordsLength={2} />);

		const textarea = screen.getByLabelText('Synopsis');
		await user.type(textarea, 'one two three');

		expect(textarea).toHaveValue('one two ');
		expect(screen.getByText('2/2 words')).toBeVisible();
	});
});
