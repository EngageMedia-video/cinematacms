let MEDIA = null;

export function init(item, shareOptions) {
	MEDIA = {
		item: {
			size: 'small', // Valid options: 'small', 'medium', 'large'.
			displayAuthor: true,
			displayViews: true,
			displayPublishDate: true,
			displayCategories: false,
		},
		share: {
			options: [],
		},
	};

	if (void 0 !== item) {
		if ('string' === typeof item.size) {
			MEDIA.item.size = item.size.trim();

			if ('medium' !== MEDIA.item.size && 'large' !== MEDIA.item.size) {
				MEDIA.item.size = 'small';
			}
		}

		if (true === item.hideAuthor) {
			MEDIA.item.displayAuthor = false;
		}

		if (true === item.hideViews) {
			MEDIA.item.displayViews = false;
		}

		if (true === item.hideDate) {
			MEDIA.item.displayPublishDate = false;
		}

		if (false === item.hideCategories) {
			MEDIA.item.displayCategories = true;
		}
	}

	if (void 0 !== shareOptions) {
		const validShareOptions = [
			'embed',
			'fb',
			'tw',
			'whatsapp',
			'telegram',
			'reddit',
			'tumblr',
			'vk',
			'pinterest',
			'mix',
			'linkedin',
			'email',
		];

		let i = 0;
		while (i < shareOptions.length) {
			if (-1 < validShareOptions.indexOf(shareOptions[i])) {
				MEDIA.share.options.push(shareOptions[i]);
			}

			i += 1;
		}
	}
}

export function settings() {
	return MEDIA;
}
