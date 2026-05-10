import React from 'react';

const display = vi.fn();
const AppLayout = vi.fn(() => null);
const PageHeader = vi.fn(() => null);
const PageSidebar = vi.fn(() => null);

vi.mock('./classes_instances/components-renderer', () => ({
	default: {
		display,
	},
}));

vi.mock('../../features/layout', () => ({
	AppLayout,
}));

vi.mock('./components/-NEW-/PageHeader', () => ({
	PageHeader,
}));

vi.mock('./components/-NEW-/PageSidebar', () => ({
	PageSidebar,
}));

describe('renderPage', () => {
	beforeEach(() => {
		display.mockReset();
		document.body.innerHTML = '';
	});

	it('routes revamp pages through the modern shell root', async () => {
		document.body.dataset.uiVariant = 'revamp';
		document.body.innerHTML = '<div id="app-root"></div>';

		function HomePage() {
			return <div>Home</div>;
		}

		const { renderPage } = await import('./_helpers.js');

		renderPage('page-home', HomePage);

		expect(display).toHaveBeenCalledTimes(1);
		expect(display).toHaveBeenCalledWith(
			document.getElementById('app-root'),
			AppLayout,
			{ pageSlotId: 'page-home', ContentComponent: HomePage },
			'app-root'
		);
	});

	it('keeps legacy split mounts for non-revamp pages', async () => {
		document.body.dataset.uiVariant = 'legacy';
		document.body.innerHTML = '<div id="app-header"></div><div id="app-sidebar"></div><div id="page-home"></div>';

		function HomePage() {
			return <div>Home</div>;
		}

		const { renderPage } = await import('./_helpers.js');

		renderPage('page-home', HomePage);

		expect(display).toHaveBeenCalledTimes(3);
		expect(display).toHaveBeenNthCalledWith(1, document.getElementById('app-header'), PageHeader, {}, 'app-header');
		expect(display).toHaveBeenNthCalledWith(
			2,
			document.getElementById('app-sidebar'),
			PageSidebar,
			{},
			'app-sidebar'
		);
		expect(display).toHaveBeenNthCalledWith(3, document.getElementById('page-home'), HomePage, {}, 'page-home');
	});
});
