import React from 'react';
import EventEmitter from 'events';
import BrowserCache from '../../classes/BrowserCache.js';
import { exportStore, postRequest, getCSRFToken } from '../../functions';

import PageStore from '../../pages/_PageStore';

import { config as mediacmsConfig } from '../../mediacms/config.js';

class RatingSystemStore extends EventEmitter {
	constructor() {
		super();

		this.mediacms_config = mediacmsConfig(window.MediaCMS);

		this.browserCache = new BrowserCache(this.mediacms_config.site.id, 86400); // Keep cache data "fresh" for one day.

		this.data = {
			media_id: null,
			extendedRateCategories: this.browserCache.get('extended-rate-categories'),
		};

		this.data.extendedRateCategories =
			null === this.data.extendedRateCategories
				? !this.mediacms_config.member.is.anonymous
				: !!this.data.extendedRateCategories;
	}

	requestRate(id, score) {
		postRequest(
			this.mediacms_config.api.media + '/' + this.data.media_id + '/actions',
			{
				type: 'rate',
				extra_info: { score: score, category_id: id },
			},
			{
				headers: { 'X-CSRFToken': getCSRFToken() },
			},
			false,
			this.succeedRateResponse.bind(this, id, score),
			this.failedRateResponse.bind(this, id, score)
		);
	}

	succeedRateResponse(id, score, response) {
		this.emit('succeed_rate_submit[' + id + ']', score);
	}

	failedRateResponse(id, score, response) {
		this.emit('failed_rate_submit[' + id + ']', score);
	}

	get(type) {
		switch (type) {
			case 'extended-rate-categories':
				return this.data.extendedRateCategories;
		}
		return null;
	}

	actions_handler(action) {
		switch (action.type) {
			case 'INIT':
				this.data.media_id = action.media_id;
				break;
			case 'EXTEND_RATE_CATEGORIES':
				this.data.extendedRateCategories = !this.data.extendedRateCategories;
				this.browserCache.set('extended-rate-categories', this.data.extendedRateCategories ? 1 : 0);
				this.emit('changed_rate_categories_visibility');
				break;
			case 'RATE_SUBMIT':
				this.requestRate(action.id, action.score);
				break;
		}
	}
}

export default exportStore(new RatingSystemStore(), 'actions_handler');
