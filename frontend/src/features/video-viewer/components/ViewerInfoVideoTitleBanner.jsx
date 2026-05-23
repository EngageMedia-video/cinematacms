import React from 'react';

import PageStore from '../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';
import { Text } from '../../shared/components/Text/Text.jsx';
import publishedOnDate from '../../../static/js/functions/publishedOnDate.js';
import MediaActions from './MediaActions.jsx';

function CountriesField({ countries }) {
	let i;
	let sep;
	let ret = [];

	if (countries.length) {
		i = 0;
		sep = 1 < countries.length ? ', ' : '';
		while (i < countries.length) {
			ret[i] = (
				<span key={i}>
					<a href={countries[i].url} className="media-country" title={countries[i].title}>
						{countries[i].title}
					</a>
					{i < countries.length - 1 ? sep : ''}
				</span>
			);
			i += 1;
		}
	}

	return ret;
}

export default class ViewerInfoVideoTitleBanner extends ViewerInfoTitleBanner {
	render() {
		const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;
		const mediaState = MediaPageStore.get('media-data').state;
		const publishedDate = this.props.published ? publishedOnDate(new Date(this.props.published)) : null;

		let stateTooltip = '';

		switch (mediaState) {
			case 'private':
				stateTooltip = 'The site admins have to make its access public';
				break;
			case 'unlisted':
				stateTooltip = 'The site admins have to make it appear on listings';
				break;
			case 'restricted':
				stateTooltip = 'The site admins have to make its access public';
				break;
		}

		return (
			<div className="py-8 flex flex-col gap-3">
				{displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
					? this.mediaCategories(true)
					: null}

				{void 0 !== this.props.title ? (
					<Text variant="h4-medium" className="dark:text-cinemata-strait-blue-50 m-0">
						{this.props.title}
					</Text>
				) : null}

				<div className="flex flex-row">
					<div className="flex flex-col gap-3 items-center justify-center">
						{publishedDate ? (
							<Text as="span" color="meta">
								Published on {publishedDate}
							</Text>
						) : null}

						{this.mediaStateBadge(mediaState, stateTooltip)}
					</div>
					<div className={'flex-1' + (this.state.likedMedia ? ' liked-media' : '')}>
						<MediaActions
							allowDownload={this.props.allowDownload}
							displayViews={displayViews}
							downloadLink={this.downloadLink}
							isVideo={false}
							title={this.props.title}
							views={this.props.views}
						/>
					</div>
				</div>
			</div>
		);
	}
}
