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
