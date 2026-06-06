import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileFilterSheet } from './MobileFilterSheet';
import { DEFAULT_SORT } from '../constants';
import { createEmptyFilters } from '../searchState';

const emptyFilterOptionSections = {
	category: [],
	topic: [],
	country: [],
	subtitle_language: [],
	length: [],
	upload_date: [],
	sort: [],
	license: [],
	community_impact: [],
};

describe('MobileFilterSheet', () => {
	it('opens the sheet and closes through save', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();

		render(
			<MobileFilterSheet
				filters={createEmptyFilters()}
				sort={DEFAULT_SORT}
				filterOptionSections={emptyFilterOptionSections}
				onSave={onSave}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Filters' }));

		expect(screen.getByRole('dialog', { name: 'Search filters' })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('dialog', { name: 'Search filters' })).not.toBeInTheDocument();
	});
});
