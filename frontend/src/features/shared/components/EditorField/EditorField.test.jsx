import { render, screen } from '@testing-library/react';
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
});
