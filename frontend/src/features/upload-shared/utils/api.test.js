import { parseFriendlyToken } from './api';

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
