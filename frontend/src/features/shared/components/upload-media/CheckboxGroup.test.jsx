import { render, screen } from '@testing-library/react';
import { CheckboxGroup } from './CheckboxGroup';

const options = [
	{ value: 1, label: 'Documentary' },
	{ value: 2, label: 'Animation' },
];

describe('CheckboxGroup', () => {
	it('links helper text to the fieldset for assistive technology', () => {
		render(<CheckboxGroup legend="Category" name="category" options={options} helperText="Select all." />);

		const group = screen.getByRole('group', { name: 'Category' });
		const helper = screen.getByText('Select all.');

		expect(group).toHaveAttribute('aria-describedby', helper.id);
		expect(group).not.toHaveAttribute('aria-invalid');
	});

	it('marks invalid groups and announces required fields', () => {
		render(<CheckboxGroup legend="Category" required name="category" options={options} error="Choose one." />);

		const group = screen.getByRole('group', { name: /category\s*required/i });
		const error = screen.getByText('Choose one.');

		expect(group).toHaveAttribute('aria-invalid', 'true');
		expect(group).toHaveAttribute('aria-describedby', error.id);
	});
});
