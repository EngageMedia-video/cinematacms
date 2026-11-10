import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { declarationsFor } from '../../../../test/cssDeclarations';
import textFieldStyles from './TextField.css?raw';
import { TextField } from './TextField';

describe('TextField', () => {
	it('renders label, placeholder, and helper text', () => {
		render(<TextField label="Enter Title" placeholder="The Blue Boat" helperText="Visible helper copy" />);

		const input = screen.getByLabelText('Enter Title');
		const helperText = screen.getByText('Visible helper copy');

		expect(input).toHaveAttribute('placeholder', 'The Blue Boat');
		expect(helperText).toBeVisible();
		expect(input).toHaveAccessibleDescription('Visible helper copy');
	});

	it('renders the field label and helper text in the default state', () => {
		render(<TextField label="Dark title" placeholder="The Blue Boat" helperText="Dark helper" />);

		expect(screen.getByLabelText('Dark title')).toBeInTheDocument();
		expect(screen.getByText('Dark helper')).toBeVisible();
	});

	it('supports className overrides and forwards input props', () => {
		render(<TextField label="Custom field" className="px-4" name="headline" defaultValue="Blue Boat" />);

		const input = screen.getByLabelText('Custom field');

		expect(input).toHaveAttribute('name', 'headline');
		expect(input).not.toHaveAttribute('maxlength');
		expect(input).toHaveValue('Blue Boat');
	});

	it('limits typed input when maxLength is provided', async () => {
		const user = userEvent.setup();
		render(<TextField label="Limited field" maxLength={4} />);

		const input = screen.getByLabelText('Limited field');

		await user.type(input, '12345');

		expect(input).toHaveAttribute('maxlength', '4');
		expect(input).toHaveValue('1234');
	});

	it('counts characters against maxLength as the user types', async () => {
		const user = userEvent.setup();
		render(<TextField label="Counted field" maxLength={90} showCharacterCount defaultValue="Trusted" />);

		expect(screen.getByText('7/90')).toBeInTheDocument();

		await user.type(screen.getByLabelText('Counted field'), ' Playlist');

		expect(screen.getByText('16/90')).toBeInTheDocument();
	});

	it('counts a controlled value', () => {
		render(<TextField label="Controlled count" maxLength={90} showCharacterCount value="" onChange={() => {}} />);

		expect(screen.getByText('0/90')).toBeInTheDocument();
	});

	it('shows the counter beside a validation error', () => {
		render(
			<TextField
				label="Errored count"
				maxLength={90}
				showCharacterCount
				value=""
				invalid
				helperText="Title is required."
			/>
		);

		expect(screen.getByText('Title is required.')).toBeInTheDocument();
		expect(screen.getByText('0/90')).toBeInTheDocument();
	});

	it('shows no counter for a maxLength alone', () => {
		render(<TextField label="Year" maxLength={4} defaultValue="2024" />);

		expect(screen.queryByText('4/4')).not.toBeInTheDocument();
	});

	it('keeps focus while typing and updates the value', async () => {
		const user = userEvent.setup();
		render(<TextField label="Focused field" placeholder="Type title" />);

		const input = screen.getByLabelText('Focused field');

		await user.click(input);
		expect(input).toHaveFocus();

		await user.type(input, 'A');
		expect(input).toHaveValue('A');
	});

	it('focuses the input when the surrounding field area is clicked', async () => {
		const user = userEvent.setup();
		render(<TextField label="Clickable field" />);

		const input = screen.getByLabelText('Clickable field');

		await user.click(input.closest('.field-shell'));

		expect(input).toHaveFocus();
	});

	it('keeps the entered value in real time when user types', async () => {
		const user = userEvent.setup();
		render(<TextField label="Filled field" />);

		const input = screen.getByLabelText('Filled field');

		await user.type(input, 'Hello');

		expect(input).toHaveValue('Hello');
	});

	it('uses a themed input surface instead of the browser default background', () => {
		render(<TextField label="Themed field" />);

		expect(screen.getByLabelText('Themed field')).toHaveClass('field-input', 'bg-transparent');
	});

	it('uses error semantics and accessible helper text when invalid', () => {
		render(<TextField label="Title" helperText="Title is required." invalid />);

		const input = screen.getByLabelText('Title');
		const helperText = screen.getByText('Title is required.');

		expect(helperText).toBeVisible();
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(input).toHaveAccessibleDescription('Title is required.');
	});

	it('rerenders from invalid to disabled state correctly', () => {
		const { rerender } = render(<TextField label="Title" helperText="Title is required." invalid />);

		rerender(<TextField label="Title" helperText="Unavailable" disabled />);

		expect(screen.getByLabelText('Title')).toBeDisabled();
	});

	it('disables input semantics when requested', () => {
		render(<TextField label="Disabled field" helperText="Read only for now." disabled defaultValue="Blue Boat" />);

		const input = screen.getByLabelText('Disabled field');

		expect(input).toBeDisabled();
		expect(input).toHaveValue('Blue Boat');
	});

	it('merges helper text id with existing aria-describedby', () => {
		render(
			<>
				<p id="external-description">External description</p>
				<TextField
					label="Merge descriptions"
					helperText="Local helper text"
					aria-describedby="external-description"
				/>
			</>
		);

		const input = screen.getByLabelText('Merge descriptions');
		const describedBy = input.getAttribute('aria-describedby');

		expect(describedBy).toContain('external-description');
		expect(describedBy).toContain('helper-text');
		expect(input).toHaveAccessibleDescription('External description Local helper text');
	});

	// Checks the declaration only: jsdom cannot paint Chrome's autofill state.
	it('clips the autofill background to the text', () => {
		const declarations = declarationsFor(textFieldStyles, ['.field-input', ':-webkit-autofill']);

		expect(declarations['background-clip']).toBe('text');
	});
});
