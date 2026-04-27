import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { Page } from '../_Page';
import PageStore from '../_PageStore.js';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class TagsPage extends Page {
	constructor(props) {
		super(props, 'tags-archive');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inTagsList={true}
							requestUrl={apiUrl.archive.tags}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

TagsPage.propTypes = {
	title: PropTypes.string.isRequired,
};

TagsPage.defaultProps = {
	title: 'Tags',
};
