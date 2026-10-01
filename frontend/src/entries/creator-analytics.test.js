import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../static/js/_helpers';

vi.mock('../static/js/_helpers', () => ({ renderPage: vi.fn() }));
vi.mock('../features/creator-analytics/CreatorAnalyticsPage', () => ({ CreatorAnalyticsPage: () => null }));

describe('creator analytics timezone redirect', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Asia/Calcutta' });
		document.body.innerHTML =
			'<script id="creator-analytics-data" type="application/json">{"timezone":"Asia/Kolkata"}</script>';
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('renders when the URL already carries the browser timezone despite server normalization', async () => {
		const location = { href: 'http://localhost/analytics?tz=Asia%2FCalcutta', replace: vi.fn() };
		vi.stubGlobal('window', { location });
		await import('./creator-analytics');
		expect(location.replace).not.toHaveBeenCalled();
		expect(renderPage).toHaveBeenCalledWith('page-creator-analytics', expect.any(Function));
	});

	it('redirects to the browser timezone while preserving filters and the selected tab', async () => {
		const location = { href: 'http://localhost/analytics?days=7&tz=UTC#media', replace: vi.fn() };
		vi.stubGlobal('window', { location });
		await import('./creator-analytics');
		expect(location.replace).toHaveBeenCalledOnce();
		expect(location.replace).toHaveBeenCalledWith('http://localhost/analytics?days=7&tz=Asia%2FCalcutta#media');
		expect(renderPage).not.toHaveBeenCalled();
	});

	it('renders when the report timezone matches the browser', async () => {
		document.getElementById('creator-analytics-data').textContent = '{"timezone":"Asia/Calcutta"}';
		const location = { href: 'http://localhost/analytics', replace: vi.fn() };
		vi.stubGlobal('window', { location });
		await import('./creator-analytics');
		expect(location.replace).not.toHaveBeenCalled();
		expect(renderPage).toHaveBeenCalledWith('page-creator-analytics', expect.any(Function));
	});
});
