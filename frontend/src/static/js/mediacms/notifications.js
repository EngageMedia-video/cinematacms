let NOTIFICATIONS = null;

export function init(settings) {

	NOTIFICATIONS = {
		messages: {
			addToLiked: 'Added to your liked videos',
			removeFromLiked: 'Removed from your liked videos',
			addToDisliked: 'Added to your disliked videos',
			removeFromDisliked: 'Removed from your disliked videos',
		},
	};

	let k, g;

	if (void 0 !== settings) {

		for (k in NOTIFICATIONS) {

			if (void 0 !== settings[k]) {

				if ('messages' === k) {

					for (g in NOTIFICATIONS[k]) {

						if ('string' === typeof settings[k][g]) {
							NOTIFICATIONS[k][g] = settings[k][g];
						}
					}
				}
			}
		}
	}

	// console.log( settings.messages );
	// console.log( NOTIFICATIONS.messages );
}

export function settings() {
	return NOTIFICATIONS;
}
