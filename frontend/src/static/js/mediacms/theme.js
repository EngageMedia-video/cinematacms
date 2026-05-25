let THEME = null;

function emptyLogoVariant() {
	return { img: '', svg: '' };
}

function readLogoVariant(target, source) {
	if (source == null || 'object' !== typeof source) return;
	if ('string' === typeof source.img) {
		target.img = source.img.trim();
	}
	if ('string' === typeof source.svg) {
		target.svg = source.svg.trim();
	}
}

export function init(theme, logo) {
	THEME = {
		mode: 'light', // Valid options: 'light', 'dark'.
		switch: {
			enabled: true,
			position: 'header', // Valid options: 'header', 'sidebar'.
		},
		// One file per breakpoint. Topbar background is the same in both
		// light and dark modes, so no per-mode variant is needed.
		logo: {
			desktop: emptyLogoVariant(),
			mobile: emptyLogoVariant(),
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

	if (logo != null && 'object' === typeof logo) {
		readLogoVariant(THEME.logo.desktop, logo.desktop);
		// Mobile falls back to the desktop URL when not configured so a single
		// logo file still works for operators that don't supply a mobile asset.
		readLogoVariant(THEME.logo.mobile, logo.mobile || logo.desktop);

		// Backward compatibility with the legacy `{ lightMode, darkMode }`
		// shape: if the new `desktop` key isn't present but the legacy keys
		// are, treat them as the desktop logo (the topbar bg is hardcoded
		// navy in both themes, so the per-mode split is no longer meaningful).
		if (!logo.desktop && (logo.lightMode || logo.darkMode)) {
			const legacy = logo.darkMode || logo.lightMode;
			readLogoVariant(THEME.logo.desktop, legacy);
			if (!logo.mobile) {
				readLogoVariant(THEME.logo.mobile, legacy);
			}
		}
	}
}

export function settings() {
	return THEME;
}
