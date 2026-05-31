import React from 'react';
import { render, screen } from '@testing-library/react';

import { StorageUsage } from './StorageUsage';

vi.mock('../../../../static/js/pages/_PageStore.js', () => ({
	default: {
		get: vi.fn(() => ({ scope: 'user', usedBytes: 1024 ** 3 })),
	},
}));

describe('StorageUsage', () => {
	it('renders authenticated user usage', () => {
		render(<StorageUsage scope="user" usedBytes={1024 ** 3 * 1.5} />);

		expect(screen.getByText('Your Usage')).toBeInTheDocument();
		expect(screen.getByText('1.5 GB')).toBeInTheDocument();
	});

	it('renders site-wide hosted storage for logged-out visitors', () => {
		render(<StorageUsage scope="site" usedBytes={1024 ** 4 * 2} />);

		expect(screen.getByText('Storage Hosted')).toBeInTheDocument();
		expect(screen.getByText('2 TB')).toBeInTheDocument();
	});

	it('renders an unavailable state for invalid usage values', () => {
		render(<StorageUsage scope="user" usedBytes={null} />);

		expect(screen.getByText('Your Usage')).toBeInTheDocument();
		expect(screen.getByText('Unavailable')).toBeInTheDocument();
	});

	it('does not expose quota or progressbar semantics before quotas exist', () => {
		render(<StorageUsage scope="user" usedBytes={1024 ** 2 * 250} />);

		expect(screen.queryByText(/quota/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/%/)).not.toBeInTheDocument();
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});

	it('falls back to PageStore storage config when props are omitted', () => {
		render(<StorageUsage />);

		expect(screen.getByText('Your Usage')).toBeInTheDocument();
		expect(screen.getByText('1 GB')).toBeInTheDocument();
	});
});
