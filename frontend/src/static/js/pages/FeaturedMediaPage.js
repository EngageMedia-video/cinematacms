import React from 'react';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../contexts/ApiUrlContext';

import { Page } from './_Page';
import PageStore from './_PageStore';
import { MediaListWrapper } from './components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';

export class FeaturedMediaPage extends Page {
	constructor(props) {
		super(props, 'featured-media');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							requestUrl={apiUrl.featured}
							hideViews={!PageStore.get('config-media-item').displayViews}
							hideAuthor={!PageStore.get('config-media-item').displayAuthor}
							hideDate={!PageStore.get('config-media-item').displayPublishDate}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

FeaturedMediaPage.propTypes = {
	title: PropTypes.string.isRequired,
};

FeaturedMediaPage.defaultProps = {
	title: PageStore.get('config-enabled').pages.featured.title,
};
