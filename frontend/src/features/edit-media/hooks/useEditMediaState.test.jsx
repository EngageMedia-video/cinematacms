import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BasicDetailsForm } from '../../add-media/single-upload/components/BasicDetailsForm';
import { useEditMediaState } from './useEditMediaState';

const CONFIG = {
	media: {
		friendlyToken: 'existing-film',
		title: 'Blue Boat',
		summary: 'Blue Boat sails',
		description: 'Blue Boat credits',
	},
	options: {
		licenses: [],
	},
};

function EditMediaBasicDetails() {
	const editState = useEditMediaState(CONFIG);

	return <BasicDetailsForm singleUpload={editState} />;
}

function renderEditMediaBasicDetails() {
	// EditMediaPage renders the form inside a QueryClientProvider.
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<EditMediaBasicDetails />
		</QueryClientProvider>
	);
}

describe('useEditMediaState', () => {
	it.each([
		['Title', 'Blue Boat', 'BlueX Boat'],
		['Synopsis', 'Blue Boat sails', 'BlueX Boat sails'],
		['More Information and Credits', 'Blue Boat credits', 'BlueX Boat credits'],
	])('keeps the caret position when editing the existing %s', async (label, initialValue, expectedValue) => {
		const user = userEvent.setup();
		renderEditMediaBasicDetails();

		const field = screen.getByLabelText(label);
		expect(field).toHaveValue(initialValue);
		field.focus();
		field.setSelectionRange(4, 4);

		await user.type(field, 'X', { skipClick: true });

		expect(field).toHaveValue(expectedValue);
		expect(field).toHaveFocus();
		expect(field.selectionStart).toBe(5);
		expect(field.selectionEnd).toBe(5);
	});
});
