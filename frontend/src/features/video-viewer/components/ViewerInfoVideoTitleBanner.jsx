import React from 'react';

import PageStore from '../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';
import { Text } from '../../shared/components/Text/Text.jsx';
import publishedOnDate from '../../../static/js/functions/publishedOnDate.js';
import MediaActions from './MediaActions.jsx';

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
			<div className="py-8 px-4 md:px-0 flex flex-col gap-3 border-b border-cinemata-pacific-deep-600p">
				{displayViews &&
					PageStore.get('config-options').pages.media.categoriesWithTitle &&
					this.mediaCategories(true)}

				<div className="flex items-center justify-between gap-3 sm:block">
					{void 0 !== this.props.title && (
						<div className="min-w-0 flex-1">
							<h1 className="heading-h6-20-medium sm:heading-h4-32-medium dark:text-cinemata-strait-blue-50 m-0">
								{this.props.title}
							</h1>
						</div>
					)}

					<div className="shrink-0 sm:hidden">{this.mediaStateBadge(mediaState, stateTooltip)}</div>
				</div>

				<div className="flex flex-col items-start gap-8 min-w-0 sm:flex-row sm:items-center">
					<div className="flex flex-col gap-3 shrink-0">
						{publishedDate && (
							<Text as="span" color="meta" className="m-0">
								Published on {publishedDate}
							</Text>
						)}

						{this.mediaStateBadge(mediaState, stateTooltip)}
					</div>

					<div className={'w-full min-w-0 sm:flex-1' + (this.state.likedMedia ? ' liked-media' : '')}>
						<MediaActions
							allowDownload={this.props.allowDownload}
							displayViews={displayViews}
							downloadLink={this.downloadLink}
							isVideo={true}
							title={this.props.title}
							views={this.props.views}
						/>
					</div>
				</div>
			</div>
		);
	}
}
