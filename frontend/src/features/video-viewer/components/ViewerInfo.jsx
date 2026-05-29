import React from 'react';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import ViewerInfoContent from './ViewerInfoContent';
import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';

export default class ViewerInfo extends React.PureComponent {
	constructor(props) {
		super(props);

		this.state = {
			videoLoaded: false,
		};

		this.onVideoLoad = this.onVideoLoad.bind(this);

		MediaPageStore.on('loaded_media_data', this.onVideoLoad);
	}

	onVideoLoad() {
		this.setState({
			videoLoaded: true,
		});
	}

	componentWillUnmount() {
		MediaPageStore.removeListener('loaded_media_data', this.onVideoLoad);
	}

	renderTitleBanner({ allowDownload, categories, title, views }) {
		return (
			<ViewerInfoTitleBanner
				title={title}
				views={views}
				categories={categories}
				allowDownload={allowDownload}
			/>
		);
	}

	render() {
		let views, categories, title, author, published, description, yearProduced;
		let allowDownload = false;

		if (this.state.videoLoaded) {
			allowDownload = MediaPageStore.get('media-data').allow_download;

			if (void 0 === allowDownload) {
				allowDownload = true;
			} else {
				allowDownload = !!allowDownload;
			}

			views = MediaPageStore.get('media-data').views;
			categories = MediaPageStore.get('media-data').categories_info;
			title = MediaPageStore.get('media-data').title;

			author = {
				name: MediaPageStore.get('media-data').author_name,
				url: MediaPageStore.get('media-data').author_profile,
				thumb: MediaPageStore.get('media-author-thumbnail-url'),
				isTrusted: MediaPageStore.get('media-data').author_is_trusted,
				isManager: MediaPageStore.get('media-data').author_is_manager,
			};

			published = MediaPageStore.get('media-data').add_date;
			description = MediaPageStore.get('media-data').description;
			yearProduced = MediaPageStore.get('media-data').year_produced;
		}

		return !this.state.videoLoaded ? null : (
			<div className="viewer-info">
				<div className="viewer-info-inner">
					{this.renderTitleBanner({ allowDownload, categories, published, title, views })}

					<ViewerInfoContent
						author={author}
						published={published}
						description={description}
						yearProduced={yearProduced}
					/>
				</div>
			</div>
		);
	}
}
