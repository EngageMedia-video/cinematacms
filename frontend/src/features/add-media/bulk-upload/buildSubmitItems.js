/**
 * Build the multipart payload a single completed file submits to the shared
 * `edit_media` view — the exact same endpoint and field names the single-upload
 * flow posts (see single-upload MediaDetailsForm / useSubmitSingle). Bulk and
 * single therefore run identical MediaForm validation and publish/review logic.
 *
 * Django checkbox/boolean fields follow "present = true": a boolean is only
 * appended when enabled, and omitted (→ False) otherwise — matching the native
 * checkboxes the single-upload form renders.
 */
export function buildEditFormData({ metadata = {}, posterFile = null, action = 'submit', csrfToken = '' }) {
	const data = new FormData();
	data.set('csrfmiddlewaretoken', csrfToken || '');
	data.set('action', action);

	data.set('title', metadata.title ?? '');
	data.set('summary', metadata.summary ?? '');
	data.set('description', metadata.description ?? '');
	// Map the picked year to MediaForm's dropdown + custom contract: 2000..current
	// posts as-is, while older years (1900..1999) post the "other" sentinel plus the
	// custom year (mirrors the legacy / single-upload year field).
	const yearProduced = String(metadata.year_produced ?? '').trim();
	if (yearProduced && Number(yearProduced) < 2000) {
		data.set('year_produced', 'other');
		data.set('year_produced_custom', yearProduced);
	} else {
		data.set('year_produced', yearProduced);
	}
	data.set('company', metadata.company ?? '');
	data.set('website', metadata.website ?? '');
	data.set('media_language', metadata.media_language ?? '');
	data.set('media_country', metadata.media_country ?? '');
	data.set('new_tags', metadata.new_tags ?? '');
	data.set('state', metadata.state ?? 'public');

	(metadata.category || []).forEach((id) => data.append('category', id));
	(metadata.topics || []).forEach((id) => data.append('topics', id));
	(metadata.content_sensitivity || []).forEach((id) => data.append('content_sensitivity', id));

	// License mirrors the single-upload hidden input: "None" sentinel + the
	// no_license checkbox for All Rights Reserved, otherwise the chosen PK.
	data.set('custom_license', metadata.no_license ? 'None' : (metadata.custom_license ?? ''));
	if (metadata.no_license) {
		data.set('no_license', 'on');
	}

	if (metadata.enable_comments) {
		data.set('enable_comments', 'on');
	}
	if (metadata.allow_download) {
		data.set('allow_download', 'on');
	}
	if (metadata.is_encrypted) {
		data.set('is_encrypted', 'on');
	}

	if (metadata.state === 'restricted' && metadata.password) {
		data.set('password', metadata.password);
	}

	if (metadata.expireEnabled) {
		if (metadata.startDate) data.set('visibility_start', metadata.startDate);
		if (metadata.endDate) data.set('visibility_end', metadata.endDate);
	}

	// Admin fields: reported_times is always sent (single sends a hidden 0 for
	// non-admins; MediaForm drops it for non-editors), featured only when set.
	data.set('reported_times', metadata.reported_times ?? '0');
	if (metadata.featured) {
		data.set('featured', 'on');
	}

	if (posterFile) {
		data.set('uploaded_poster', posterFile);
	}

	return data;
}

/** Edit endpoint for a media item (the `edit_media` view reads `?m=<token>`). */
export function getMediaEditUrl(friendlyToken) {
	return `/edit?m=${encodeURIComponent(friendlyToken)}`;
}

/** Completed files eligible for submission (those that have a server token). */
export function selectSubmittableFiles(files) {
	return files.filter((file) => file.friendlyToken);
}
