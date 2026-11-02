export const UPLOAD_ID_HEADER = 'X-Upload-Id';

// Sends Fine Uploader's per-file uuid (qquuid) as a header on every request of one upload,
// so nginx can log it. Per-file headers replace the uploader-wide ones, hence `headers`.
export function sendUploadIdHeader(uploader, id, headers) {
	uploader.setCustomHeaders({ ...headers, [UPLOAD_ID_HEADER]: uploader.getUuid(id) }, id);
}
