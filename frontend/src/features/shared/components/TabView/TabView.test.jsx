import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TabContent, TabView } from './TabView';

describe('TabView', () => {
	it('renders the generated tab list with the initial active tab', () => {
		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		const selectedTab = screen.getByRole('tab', { name: 'Single Film Upload' });

		expect(screen.getByRole('tablist', { name: 'Upload mode' })).toBeInTheDocument();
		expect(selectedTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload one title.');
	});

	it('supports wrap-content tab sizing mode', () => {
		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode" tabMode="wrap">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		expect(screen.getByRole('tablist', { name: 'Upload mode' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveAttribute('aria-selected', 'true');
	});

	it('switches panels in the TabContent API when a tab is clicked', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		const bulkTab = screen.getByRole('tab', { name: 'Bulk Upload' });
		await user.click(bulkTab);

		expect(bulkTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('keeps inactive panels mounted when requested', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode" keepMounted>
				<TabContent title="Single Film Upload" content={<div data-testid="single-uploader">Upload one title.</div>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		await user.click(screen.getByRole('tab', { name: 'Bulk Upload' }));

		expect(screen.getByTestId('single-uploader')).toBeInTheDocument();
		expect(screen.getByTestId('single-uploader').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('supports controlled selection changes', async () => {
		const user = userEvent.setup();

		function ControlledExample() {
			const [selectedTab, setSelectedTab] = useState('single');

			return (
				<TabView selectedTab={selectedTab} onSelectedTabChange={setSelectedTab} aria-label="Upload mode">
					<TabContent value="single" title="Single Film Upload" content={<p>Upload one title.</p>} />
					<TabContent value="bulk" title="Bulk Upload" content={<p>Upload many titles.</p>} />
				</TabView>
			);
		}

		render(<ControlledExample />);

		const bulkTab = screen.getByRole('tab', { name: 'Bulk Upload' });
		await user.click(bulkTab);

		expect(bulkTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('supports custom tab identifiers', () => {
		render(
			<TabView defaultSelectedTab="bulk" aria-label="Upload mode">
				<TabContent value="single" title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent value="bulk" title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('supports left and right arrow keyboard navigation with wraparound', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		const selectedTab = screen.getByRole('tab', { name: 'Single Film Upload' });
		selectedTab.focus();

		await user.keyboard('{ArrowRight}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');

		await user.keyboard('{ArrowRight}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload one title.');

		await user.keyboard('{ArrowLeft}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('skips disabled tabs during arrow navigation', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} disabled />
				<TabContent title="Import Existing" content={<p>Import an existing catalog.</p>} />
			</TabView>
		);

		const selectedTab = screen.getByRole('tab', { name: 'Single Film Upload' });
		selectedTab.focus();

		await user.keyboard('{ArrowRight}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Import Existing' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Import Existing' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tabpanel')).toHaveTextContent('Import an existing catalog.');
	});

	it('supports Home and End keyboard navigation across generated tabs', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		const selectedTab = screen.getByRole('tab', { name: 'Single Film Upload' });
		selectedTab.focus();

		await user.keyboard('{End}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Bulk Upload' })).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{Home}');
		await waitFor(() => expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveFocus());
		expect(screen.getByRole('tab', { name: 'Single Film Upload' })).toHaveAttribute('aria-selected', 'true');
	});

	it('supports TabContent children declared inside a fragment', async () => {
		const user = userEvent.setup();

		render(
			<TabView defaultSelectedTab="single-film-upload" aria-label="Upload mode">
				<>
					<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
					<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
				</>
			</TabView>
		);

		await user.click(screen.getByRole('tab', { name: 'Bulk Upload' }));

		expect(screen.getByRole('tabpanel')).toHaveTextContent('Upload many titles.');
	});

	it('supports custom trigger colors for selected and unselected states', async () => {
		const user = userEvent.setup();

		render(
			<TabView
				defaultSelectedTab="single-film-upload"
				aria-label="Upload mode"
				triggerColor="bg/chrome-hover"
				triggerSelectedColor="#0c5273"
			>
				<TabContent title="Single Film Upload" content={<p>Upload one title.</p>} />
				<TabContent title="Bulk Upload" content={<p>Upload many titles.</p>} />
			</TabView>
		);

		const singleTab = screen.getByRole('tab', { name: 'Single Film Upload' });
		const bulkTab = screen.getByRole('tab', { name: 'Bulk Upload' });

		expect(singleTab.style.backgroundColor).toBe('rgb(12, 82, 115)');
		expect(bulkTab.style.backgroundColor).toBe('var(--bg-chrome-hover)');

		await user.click(bulkTab);

		expect(singleTab.style.backgroundColor).toBe('var(--bg-chrome-hover)');
		expect(bulkTab.style.backgroundColor).toBe('rgb(12, 82, 115)');
	});
});
