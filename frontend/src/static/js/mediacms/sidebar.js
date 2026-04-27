let SIDEBAR = null;

export function init(settings) {
	// TODO: Continue here

	SIDEBAR = {
		hideHomeLink: false,
		hideTagsLink: false,
	};

	if (void 0 !== settings) {
		if ('boolean' === typeof settings.hideHomeLink) {
			SIDEBAR.hideHomeLink = settings.hideHomeLink;
		}

		if ('boolean' === typeof settings.hideTagsLink) {
			SIDEBAR.hideTagsLink = settings.hideTagsLink;
		}
	}
}

export function settings() {
	return SIDEBAR;
}
