import React from 'react';
import { render, screen } from '@testing-library/react';

import { AppLayout } from './AppLayout';

vi.mock('../../../static/js/components/-NEW-/PageHeader', () => ({
	PageHeader: () => <div data-testid="page-header" />,
}));

vi.mock('../../../static/js/components/-NEW-/PageSidebar', () => ({
	PageSidebar: () => <div data-testid="page-sidebar" />,
}));

describe('AppLayout', () => {
	it('renders modern shell chrome and page content inside the requested slot', () => {
		function HomeContent() {
			return <div>Revamp home content</div>;
		}

		render(<AppLayout ContentComponent={HomeContent} pageSlotId="page-home" />);

		expect(screen.getByTestId('page-header')).toBeInTheDocument();
		expect(screen.getByTestId('page-sidebar')).toBeInTheDocument();
		expect(screen.getByText('Revamp home content')).toBeInTheDocument();
		expect(document.getElementById('page-home')).toContainElement(screen.getByText('Revamp home content'));
		expect(document.querySelector('[data-modern-track]')).toBeInTheDocument();
	});
});
