import { createContext, useContext } from 'react';

/**
 * Default configuration for the Bulk Upload tab. The host add-media page
 * (AddMediaPage) supplies overrides sourced from window.MediaCMS; these defaults
 * fill in the rest. Shared via context.
 */
export const BULK_UPLOAD_CONFIG_DEFAULTS = {
	uploadEndpoint: '/fu/upload/',
	chunksDoneParam: 'done',
	optionsEndpoint: '/api/v1/my_uploads/upload_options',
	singleUploadUrl: '/upload',
	postSubmitUrl: '/',
	maxFiles: 2,
	maxSizeBytes: 0,
	allowedExtensions: [],
	isTrustedUser: false,
	// Logged-in user's full name, shown as the uploader in each file's Quick Preview.
	userName: '',
	// Admin-only "Admin Settings" section (Featured / Reported Times). Provided by
	// the host add-media page; defaults off otherwise.
	canUseAdminSettings: false,
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
