import { buildSubmitItems, buildSubmitMetadata } from './buildSubmitItems';
import { createDefaultMetadata } from './useBulkUploadStore';

describe('buildSubmitMetadata', () => {
	it('keeps the password when the selected state is restricted', () => {
		const metadata = { ...createDefaultMetadata(), password: 'secret', state: 'restricted' };
		const result = buildSubmitMetadata(metadata);
		expect(result.state).toBe('restricted');
		expect(result.password).toBe('secret');
	});

	it('clears the license when All Rights Reserved is set', () => {
		const metadata = { ...createDefaultMetadata(), no_license: true, custom_license: '5' };
		expect(buildSubmitMetadata(metadata).custom_license).toBe('');
	});

	it('clears the password when the selected state is not restricted', () => {
		const metadata = { ...createDefaultMetadata(), state: 'unlisted' };
		const result = buildSubmitMetadata(metadata);
		expect(result.state).toBe('unlisted');
		expect(result.password).toBe('');
	});
});

describe('buildSubmitItems', () => {
	it('includes only files that finished uploading (have a token)', () => {
		const files = [
			{ friendlyToken: 'tok1', metadata: createDefaultMetadata() },
			{ friendlyToken: null, metadata: createDefaultMetadata() },
		];
		const items = buildSubmitItems(files);
		expect(items).toHaveLength(1);
		expect(items[0].friendly_token).toBe('tok1');
		expect(items[0].metadata).toBeTruthy();
	});
});
