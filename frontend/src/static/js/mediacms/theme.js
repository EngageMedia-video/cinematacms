let THEME = null;

export function init(theme, logo) {
	THEME = {
		mode: 'light', // Valid options: 'light', 'dark'.
		switch: {
			enabled: true,
			position: 'header', // Valid options: 'header', 'sidebar'.
		},
		logo: {
			lightMode: {
				img: '',
				svg: '',
			},
			darkMode: {
				img: '',
				svg: '',
			},
		},
		// Optional mobile-specific override consumed by the new topbar.
		// When not configured, the topbar falls back to `logo` above.
		logoMobile: {
			lightMode: {
				img: '',
				svg: '',
			},
			darkMode: {
				img: '',
				svg: '',
			},
		},
	};

	if (void 0 !== theme) {
		if ('string' === typeof theme.mode) {
			THEME.mode = theme.mode.trim();
			THEME.mode = 'dark' === THEME.mode ? 'dark' : 'light';
		}

		if (void 0 !== theme.switch) {
			if (false === theme.switch.enabled) {
				THEME.switch.enabled = theme.switch.enabled;
			}

			if ('string' === typeof theme.switch.position) {
				THEME.switch.position = theme.switch.position.trim();
				THEME.switch.position = 'sidebar' === theme.switch.position ? 'sidebar' : 'header';
			}
		}
	}

	if (void 0 !== logo) {
		if (void 0 !== logo.lightMode) {
			if ('string' === typeof logo.lightMode.img) {
				THEME.logo.lightMode.img = logo.lightMode.img.trim();
			}

			if ('string' === typeof logo.lightMode.svg) {
				THEME.logo.lightMode.svg = logo.lightMode.svg.trim();
			}
		}

		if (void 0 !== logo.darkMode) {
			if ('string' === typeof logo.darkMode.img) {
				THEME.logo.darkMode.img = logo.darkMode.img.trim();
			}

			if ('string' === typeof logo.darkMode.svg) {
				THEME.logo.darkMode.svg = logo.darkMode.svg.trim();
			}
		}

		if (void 0 !== logo.mobile) {
			if (void 0 !== logo.mobile.lightMode) {
				if ('string' === typeof logo.mobile.lightMode.img) {
					THEME.logoMobile.lightMode.img = logo.mobile.lightMode.img.trim();
				}
				if ('string' === typeof logo.mobile.lightMode.svg) {
					THEME.logoMobile.lightMode.svg = logo.mobile.lightMode.svg.trim();
				}
			}

			if (void 0 !== logo.mobile.darkMode) {
				if ('string' === typeof logo.mobile.darkMode.img) {
					THEME.logoMobile.darkMode.img = logo.mobile.darkMode.img.trim();
				}
				if ('string' === typeof logo.mobile.darkMode.svg) {
					THEME.logoMobile.darkMode.svg = logo.mobile.darkMode.svg.trim();
				}
			}
		}
	}
}

export function settings() {
	return THEME;
}
