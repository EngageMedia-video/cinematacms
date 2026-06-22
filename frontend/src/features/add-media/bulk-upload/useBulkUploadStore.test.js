import useBulkUploadStore, { createDefaultMetadata, UPLOAD_STATUS } from './useBulkUploadStore';

beforeEach(() => {
	useBulkUploadStore.getState().reset();
});

describe('useBulkUploadStore', () => {
	it('adds files and dedupes by id', () => {
		const { addFile } = useBulkUploadStore.getState();
		addFile({ id: 1, name: 'a.mp4', sizeBytes: 100 });
		addFile({ id: 1, name: 'a.mp4', sizeBytes: 100 });
		expect(useBulkUploadStore.getState().files).toHaveLength(1);
		expect(useBulkUploadStore.getState().files[0].uploadStatus).toBe(UPLOAD_STATUS.UPLOADING);
	});

	it('updates upload state and metadata per file', () => {
		const { addFile, updateFile, setMetadata } = useBulkUploadStore.getState();
		addFile({ id: 2, name: 'b.mp4', sizeBytes: 1 });
		updateFile(2, { uploadStatus: UPLOAD_STATUS.COMPLETE, friendlyToken: 'tok' });
		setMetadata(2, { title: 'Hi' });
		const file = useBulkUploadStore.getState().files[0];
		expect(file.uploadStatus).toBe(UPLOAD_STATUS.COMPLETE);
		expect(file.friendlyToken).toBe('tok');
		expect(file.metadata.title).toBe('Hi');
	});

	it('keeps per-file poster upload and frame selection mutually exclusive', () => {
		const { addFile, setPosterFile, setThumbnailTime } = useBulkUploadStore.getState();
		const poster = new File(['poster'], 'poster.png', { type: 'image/png' });
		const frame = { index: 2, seconds: 20, spritesUrl: '/sprites.jpg', rowsInSheet: 3 };

		addFile({ id: 4, name: 'd.mp4', sizeBytes: 1 });
		addFile({ id: 5, name: 'e.mp4', sizeBytes: 1 });

		setPosterFile(4, poster);
		expect(useBulkUploadStore.getState().files.find((file) => file.id === 4)).toMatchObject({
			posterFile: poster,
			thumbnailTime: null,
			thumbnailFrame: null,
		});

		setThumbnailTime(4, 20, frame);
		expect(useBulkUploadStore.getState().files.find((file) => file.id === 4)).toMatchObject({
			posterFile: null,
			thumbnailTime: 20,
			thumbnailFrame: frame,
		});
		expect(useBulkUploadStore.getState().files.find((file) => file.id === 5)).toMatchObject({
			posterFile: null,
			thumbnailTime: null,
			thumbnailFrame: null,
		});

		setPosterFile(4, poster);
		expect(useBulkUploadStore.getState().files.find((file) => file.id === 4)).toMatchObject({
			posterFile: poster,
			thumbnailTime: null,
			thumbnailFrame: null,
		});
	});

	it('removes files', () => {
		const { addFile, removeFile } = useBulkUploadStore.getState();
		addFile({ id: 3, name: 'c.mp4', sizeBytes: 1 });
		removeFile(3);
		expect(useBulkUploadStore.getState().files).toHaveLength(0);
	});

	it('provides sensible default metadata', () => {
		const meta = createDefaultMetadata();
		expect(meta.enable_comments).toBe(true);
		expect(meta.allow_download).toBe(true);
		expect(meta.state).toBe('public');
		expect(meta.category).toEqual([]);
	});
});
