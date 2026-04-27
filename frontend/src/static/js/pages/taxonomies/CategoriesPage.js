import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { Page } from '../_Page';
import PageStore from '../_PageStore.js';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class CategoriesPage extends Page {
	constructor(props) {
		super(props, 'categories-archive');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inCategoriesList={true}
							requestUrl={apiUrl.archive.categories}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

CategoriesPage.propTypes = {
	title: PropTypes.string.isRequired,
};

CategoriesPage.defaultProps = {
	title: 'Categories',
};
