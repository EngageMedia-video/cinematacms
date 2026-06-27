import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YearChooserField } from './YearChooserField';

function ControlledYearChooser({ initialValue = '', ...props }) {
	const [value, setValue] = useState(initialValue);

	return <YearChooserField name="year_produced" value={value} onChange={setValue} {...props} />;
}

describe('YearChooserField', () => {
	it('opens on the newest valid page and does not show future years', async () => {
		const user = userEvent.setup();

		render(<YearChooserField maxYear={2026} value="" onChange={vi.fn()} />);

		await user.click(screen.getByRole('button', { name: 'Choose' }));

		expect(screen.getByText('2015-2026')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '2026' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '2027' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show newer years' })).toBeDisabled();
	});

	it('pages backward into older years without a 1900/2000 floor', async () => {
		const user = userEvent.setup();

		render(<YearChooserField maxYear={1910} value="" onChange={vi.fn()} />);

		await user.click(screen.getByRole('button', { name: 'Choose' }));
		expect(screen.getByText('1899-1910')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '1899' })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Show older years' }));
		expect(screen.getByText('1887-1898')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '1887' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show older years' })).toBeEnabled();
	});

	it('allows typing a year while keeping the submitted value numeric', async () => {
		const user = userEvent.setup();

		render(<ControlledYearChooser maxYear={2026} />);

		await user.type(screen.getByLabelText('Year Produced'), '20ab24');

		expect(screen.getByLabelText('Year Produced')).toHaveValue('2024');
		expect(document.querySelector('input[name="year_produced"]')).toHaveValue('2024');
		expect(document.querySelector('input[name="year_produced_custom"]')).toHaveValue('');
		expect(screen.queryByRole('dialog', { name: 'Choose year' })).not.toBeInTheDocument();
	});

	it('posts older typed years through MediaForm custom-year fields', async () => {
		const user = userEvent.setup();

		render(<ControlledYearChooser maxYear={2026} />);

		await user.type(screen.getByLabelText('Year Produced'), '1898');

		expect(screen.getByLabelText('Year Produced')).toHaveValue('1898');
		expect(document.querySelector('input[name="year_produced"]')).toHaveValue('other');
		expect(document.querySelector('input[name="year_produced_custom"]')).toHaveValue('1898');
	});

	it('does not jump the chooser range to the typed year', async () => {
		const user = userEvent.setup();

		render(<ControlledYearChooser maxYear={2026} />);

		await user.type(screen.getByLabelText('Year Produced'), '1898');
		await user.click(screen.getByRole('button', { name: 'Choose' }));

		expect(screen.getByText('2015-2026')).toBeInTheDocument();
		expect(screen.queryByText('1887-1898')).not.toBeInTheDocument();
	});
});
