import { fireEvent, render, screen } from '@testing-library/react';
import { SingleUploadPage } from './SingleUploadPage';

describe('SingleUploadPage', () => {
	it('shows the last selected thumbnail file after choosing an image', () => {
		render(<SingleUploadPage />);

		const thumbnailInput = screen.getByLabelText('Choose thumbnail image');
		const file = new File(['poster'], 'poster.png', { type: 'image/png' });

		expect(thumbnailInput).toHaveAttribute('accept', 'image/*');
		expect(thumbnailInput).not.toHaveAttribute('multiple');

		fireEvent.change(thumbnailInput, { target: { files: [file] } });

		expect(screen.getByText('Last selected: poster.png')).toBeInTheDocument();
	});

	it('updates the hidden license field from the dialog choices', () => {
		render(<SingleUploadPage />);

		const licenseField = document.querySelector('input[name="custom_license"]');
		const noLicenseField = screen.getByRole('checkbox', { name: /All Rights Reserved/ });

		expect(licenseField).toHaveValue('None');
		expect(noLicenseField).toBeChecked();

		fireEvent.click(screen.getByRole('button', { name: 'Choose License' }));

		expect(screen.getByRole('dialog', { name: 'Choose Creative Commons license' })).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('Allow commercial uses of your work? No'));
		fireEvent.click(screen.getByLabelText('Allow modifications of your work? Yes, as long as others share alike'));
		fireEvent.click(screen.getByRole('button', { name: 'Update License' }));

		expect(licenseField).toHaveValue('4');
		expect(noLicenseField).not.toBeChecked();
		expect(screen.getByText('CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike')).toBeInTheDocument();
	});
});
