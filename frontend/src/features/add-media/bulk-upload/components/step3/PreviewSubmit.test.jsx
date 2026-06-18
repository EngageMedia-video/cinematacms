import { render, screen } from '@testing-library/react';
import { PreviewSubmit } from './PreviewSubmit';
import { createDefaultMetadata } from '../../useBulkUploadStore';

const options = {
	languages: [{ code: 'en', title: 'English' }],
	countries: [{ code: 'ID', title: 'Indonesia' }],
	categories: [{ id: 1, title: 'Arts & Culture' }],
	topics: [{ id: 2, title: 'Documentary' }],
	content_sensitivities: [{ id: 3, title: 'Violence' }],
	licenses: [{ id: 4, title: 'Attribution 4.0 International' }],
};

function validMetadata(overrides = {}) {
	return {
		...createDefaultMetadata(),
		title: 'The Blue Boat',
		summary: 'A short synopsis for the film.',
		year_produced: '2021',
		media_country: 'ID',
		media_language: 'en',
		category: [1],
		topics: [2],
		content_sensitivity: [3],
		custom_license: 4,
		...overrides,
	};
}

describe('PreviewSubmit', () => {
	it('summarizes valid uploaded files for final review', () => {
		render(
			<PreviewSubmit
				files={[
					{
						id: 'file-1',
						name: 'blue-boat.mp4',
						sizeBytes: 1234,
						metadata: validMetadata(),
					},
				]}
				options={options}
			/>
		);

		expect(screen.getByRole('heading', { name: /preview & submit/i })).toBeInTheDocument();
		expect(screen.getByText('1 of 1')).toBeInTheDocument();
		expect(screen.getByText('Ready to submit')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /quick preview/i })).toBeInTheDocument();
		expect(screen.getAllByText('Indonesia')).toHaveLength(2);
		expect(screen.getAllByText('Arts & Culture')).toHaveLength(2);
	});

	it('surfaces missing required details before sharing', () => {
		render(
			<PreviewSubmit
				files={[
					{
						id: 'file-1',
						name: 'draft.mp4',
						sizeBytes: 0,
						metadata: createDefaultMetadata(),
					},
				]}
				options={options}
			/>
		);

		expect(screen.getByText('0 of 1')).toBeInTheDocument();
		expect(screen.getByText('Needs attention')).toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent('Synopsis');
		expect(screen.getByRole('alert')).toHaveTextContent('Category');
	});

	it('uses human-readable labels for server validation fields', () => {
		render(
			<PreviewSubmit
				files={[
					{
						id: 'file-1',
						name: 'draft.mp4',
						sizeBytes: 0,
						metadata: validMetadata(),
					},
				]}
				options={options}
				validationErrors={{
					'file-1': {
						custom_license: 'Select a valid license.',
						content_sensitivity: 'Select a value.',
					},
				}}
			/>
		);

		expect(screen.getByRole('alert')).toHaveTextContent('License');
		expect(screen.getByRole('alert')).toHaveTextContent('Content Sensitivity');
		expect(screen.getByRole('alert')).not.toHaveTextContent('custom_license');
	});
});
