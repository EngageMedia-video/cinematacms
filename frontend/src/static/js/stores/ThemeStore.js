import React from 'react';
import EventEmitter from 'events';
import BrowserCache from '../classes/BrowserCache.js';
import { exportStore } from '../functions';
import { addClassname, removeClassname } from '../functions/dom.js';
import { config as mediaCmsConfig } from '../mediacms/config.js';
import { supportsSvgAsImg } from '../components/-NEW-/functions/dom';

function resolveLogoUrl(variant) {
	if (variant == null) return null;
	if (supportsSvgAsImg() && 'string' === typeof variant.svg && '' !== variant.svg) {
		return variant.svg;
	}
	if ('string' === typeof variant.img && '' !== variant.img) {
		return variant.img;
	}
	return null;
}

function initMode(cachedValue, defaultValue) {
	return 'light' === cachedValue || 'dark' === cachedValue ? cachedValue : defaultValue;
}

function onModeChange(mode) {
	document.documentElement.classList.toggle('dark', 'dark' === mode);

	if ('dark' === mode) {
		addClassname(document.body, 'dark_theme');
	} else {
		removeClassname(document.body, 'dark_theme');
	}
}

class ThemeStore extends EventEmitter {
	constructor() {
		super();

		const config = mediaCmsConfig(window.MediaCMS);

		// Keep cache data "fresh" for one day.
		this.cache = new BrowserCache('MediaCMS[' + config.site.id + '][theme]', 86400);

		this.logoDesktop = resolveLogoUrl(config.theme.logo?.desktop);
		this.logoMobile = resolveLogoUrl(config.theme.logo?.mobile) || this.logoDesktop;

		this.state = {
			mode: initMode(this.cache.get('mode'), config.theme.mode),
		};

		onModeChange(this.state.mode);
	}

	get(type) {
		switch (type) {
			case 'logo':
				return this.logoDesktop;
			case 'logo-mobile':
				return this.logoMobile;
			case 'mode':
				return this.state.mode;
		}
	}

	actions_handler(action) {
		switch (action.type) {
			case 'TOGGLE_MODE':
				this.state.mode = 'light' === this.state.mode ? 'dark' : 'light';
				onModeChange(this.state.mode);
				this.cache.set('mode', this.state.mode);
				this.emit('mode-change');
				break;
		}
	}
}

export default exportStore(new ThemeStore(), 'actions_handler');

if (import.meta.hot) {
	import.meta.hot.decline();
}
