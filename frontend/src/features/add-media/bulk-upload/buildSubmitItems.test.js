import { buildEditFormData, getMediaEditUrl, selectSubmittableFiles } from './buildSubmitItems';
import { createDefaultMetadata } from './useBulkUploadStore';

describe('buildEditFormData', () => {
	it('sets the action and core text fields', () => {
		const data = buildEditFormData({
			metadata: { ...createDefaultMetadata(), title: 'My Film', year_produced: '2021' },
			action: 'submit',
			csrfToken: 'abc',
		});
		expect(data.get('action')).toBe('submit');
		expect(data.get('csrfmiddlewaretoken')).toBe('abc');
		expect(data.get('title')).toBe('My Film');
		expect(data.get('year_produced')).toBe('2021');
		expect(data.get('year_produced_custom')).toBeNull();
	});

	it('only marks the media reviewed when the trusted flow requests it', () => {
		const regular = buildEditFormData({ metadata: createDefaultMetadata() });
		expect(regular.get('is_reviewed')).toBeNull();

		const trusted = buildEditFormData({ metadata: createDefaultMetadata(), isReviewed: true });
		expect(trusted.get('is_reviewed')).toBe('on');
	});

	it('maps a pre-2000 year to the MediaForm "other" + custom contract', () => {
		const data = buildEditFormData({
			metadata: { ...createDefaultMetadata(), year_produced: '1995' },
		});
		expect(data.get('year_produced')).toBe('other');
		expect(data.get('year_produced_custom')).toBe('1995');
	});

	it('appends each category as a repeated field', () => {
		const data = buildEditFormData({ metadata: { ...createDefaultMetadata(), category: [1, 2] } });
		expect(data.getAll('category')).toEqual(['1', '2']);
	});

	it('keeps the password only when the state is restricted', () => {
		const restricted = buildEditFormData({
			metadata: { ...createDefaultMetadata(), state: 'restricted', password: 'secret' },
		});
		expect(restricted.get('state')).toBe('restricted');
		expect(restricted.get('password')).toBe('secret');

		const unlisted = buildEditFormData({
			metadata: { ...createDefaultMetadata(), state: 'unlisted', password: 'secret' },
		});
		expect(unlisted.get('password')).toBeNull();
	});

	it('emits the All Rights Reserved sentinel and checkbox', () => {
		const data = buildEditFormData({ metadata: { ...createDefaultMetadata(), no_license: true } });
		expect(data.get('custom_license')).toBe('None');
		expect(data.get('no_license')).toBe('on');
	});

	it('sends a chosen license id without the no_license flag', () => {
		const data = buildEditFormData({
			metadata: { ...createDefaultMetadata(), no_license: false, custom_license: '5' },
		});
		expect(data.get('custom_license')).toBe('5');
		expect(data.get('no_license')).toBeNull();
	});

	it('only includes boolean fields when enabled (Django checkbox semantics)', () => {
		const off = buildEditFormData({
			metadata: {
				...createDefaultMetadata(),
				enable_comments: false,
				allow_download: false,
				is_encrypted: false,
			},
		});
		expect(off.get('enable_comments')).toBeNull();
		expect(off.get('allow_download')).toBeNull();
		expect(off.get('is_encrypted')).toBeNull();

		const on = buildEditFormData({ metadata: { ...createDefaultMetadata(), is_encrypted: true } });
		expect(on.get('enable_comments')).toBe('on');
		expect(on.get('is_encrypted')).toBe('on');
	});

	it('always sends reported_times and attaches a chosen poster file', () => {
		const poster = new File(['x'], 'poster.png', { type: 'image/png' });
		const data = buildEditFormData({ metadata: createDefaultMetadata(), posterFile: poster });
		expect(data.get('reported_times')).toBe('0');
		expect(data.get('uploaded_poster')).toBeInstanceOf(File);
		expect(data.get('thumbnail_time')).toBeNull();
	});

	it('sends thumbnail_time when a frame is selected without a poster file', () => {
		const data = buildEditFormData({ metadata: createDefaultMetadata(), thumbnailTime: 20 });
		expect(data.get('thumbnail_time')).toBe('20');
		expect(data.get('uploaded_poster')).toBeNull();
	});

	it('prefers uploaded_poster over thumbnail_time when both are present', () => {
		const poster = new File(['x'], 'poster.png', { type: 'image/png' });
		const data = buildEditFormData({
			metadata: createDefaultMetadata(),
			posterFile: poster,
			thumbnailTime: 20,
		});
		expect(data.get('uploaded_poster')).toBeInstanceOf(File);
		expect(data.get('thumbnail_time')).toBeNull();
	});
});

describe('selectSubmittableFiles', () => {
	it('keeps only files that finished uploading (have a token)', () => {
		const files = [
			{ friendlyToken: 'tok1', metadata: createDefaultMetadata() },
			{ friendlyToken: null, metadata: createDefaultMetadata() },
		];
		const submittable = selectSubmittableFiles(files);
		expect(submittable).toHaveLength(1);
		expect(submittable[0].friendlyToken).toBe('tok1');
	});
});

describe('getMediaEditUrl', () => {
	it('builds the edit_media URL for a token', () => {
		expect(getMediaEditUrl('abc-123')).toBe('/edit?m=abc-123');
	});
});
