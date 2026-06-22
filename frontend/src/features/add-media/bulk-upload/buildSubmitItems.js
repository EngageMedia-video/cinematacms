/**
 * Maps a file's UI metadata to the payload `MediaForm` expects on the server.
 * Restricted media carries a password; other states intentionally clear it.
 */
export function buildSubmitMetadata(metadata) {
	return {
		title: metadata.title,
		summary: metadata.summary,
		description: metadata.description,
		year_produced: metadata.year_produced,
		year_produced_custom: metadata.year_produced_custom,
		company: metadata.company,
		website: metadata.website,
		media_language: metadata.media_language,
		media_country: metadata.media_country,
		category: metadata.category,
		topics: metadata.topics,
		content_sensitivity: metadata.content_sensitivity,
		new_tags: metadata.new_tags,
		custom_license: metadata.no_license ? '' : metadata.custom_license,
		no_license: metadata.no_license,
		enable_comments: metadata.enable_comments,
		allow_download: metadata.allow_download,
		state: metadata.state,
		password: metadata.state === 'restricted' ? metadata.password : '',
	};
}

/** Build the submit payload from completed files (those that have a token). */
export function buildSubmitItems(files) {
	return files
		.filter((file) => file.friendlyToken)
		.map((file) => ({
			friendly_token: file.friendlyToken,
			metadata: buildSubmitMetadata(file.metadata),
		}));
}
