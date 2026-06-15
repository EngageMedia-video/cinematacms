import { createContext, useContext } from 'react';

/**
 * Server-provided configuration for the bulk-upload page, injected by the Django
 * template as a JSON `<script id="bulk-upload-config">` block. Read once on the
 * page root and shared via context.
 */
export const BULK_UPLOAD_CONFIG_DEFAULTS = {
	uploadEndpoint: '/fu/upload/',
	chunksDoneParam: 'done',
	optionsEndpoint: '/api/v1/my_uploads/bulk_options',
	submitEndpoint: '/api/v1/my_uploads/bulk_submit',
	singleUploadUrl: '/upload',
	postSubmitUrl: '/',
	maxFiles: 2,
	maxSizeBytes: 0,
	allowedExtensions: [],
	isTrustedUser: false,
};

export function readBulkUploadConfig() {
	if (typeof document === 'undefined') {
		return { ...BULK_UPLOAD_CONFIG_DEFAULTS };
	}
	const element = document.getElementById('bulk-upload-config');
	if (!element) {
		return { ...BULK_UPLOAD_CONFIG_DEFAULTS };
	}
	try {
		return { ...BULK_UPLOAD_CONFIG_DEFAULTS, ...JSON.parse(element.textContent || '{}') };
	} catch {
		return { ...BULK_UPLOAD_CONFIG_DEFAULTS };
	}
}

const BulkUploadConfigContext = createContext(BULK_UPLOAD_CONFIG_DEFAULTS);

export const BulkUploadConfigProvider = BulkUploadConfigContext.Provider;

export function useBulkUploadConfig() {
	return useContext(BulkUploadConfigContext);
}
