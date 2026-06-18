import { apiFetch, parseFriendlyToken } from './api';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('apiFetch', () => {
	it('normalizes safe lowercase methods without adding a CSRF header', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

		await apiFetch('/endpoint', { method: 'get' });

		expect(fetchMock).toHaveBeenCalledWith(
			'/endpoint',
			expect.objectContaining({
				method: 'GET',
				headers: {},
			})
		);
	});

	it('normalizes unsafe lowercase methods before adding JSON and CSRF headers', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

		await apiFetch('/endpoint', { method: 'post', body: { title: 'Video' } });

		expect(fetchMock).toHaveBeenCalledWith(
			'/endpoint',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					'X-CSRFToken': expect.any(String),
				}),
				body: JSON.stringify({ title: 'Video' }),
			})
		);
	});
});

describe('parseFriendlyToken', () => {
	it('extracts the token from an upload media_url', () => {
		expect(parseFriendlyToken('/view?m=abc123XYZ')).toBe('abc123XYZ');
		expect(parseFriendlyToken('/view?foo=1&m=tok-en')).toBe('tok-en');
	});

	it('returns null when no token is present', () => {
		expect(parseFriendlyToken('/view')).toBeNull();
		expect(parseFriendlyToken('')).toBeNull();
		expect(parseFriendlyToken(null)).toBeNull();
	});
});
