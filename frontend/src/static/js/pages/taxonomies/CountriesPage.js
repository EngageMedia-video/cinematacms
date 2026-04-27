import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { Page } from '../_Page';
import PageStore from '../_PageStore.js';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class CountriesPage extends Page {
	constructor(props) {
		super(props, 'countries-archive');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inCountriesList={true}
							requestUrl={apiUrl.archive.countries}
							hideAllMeta={true}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

CountriesPage.propTypes = {
	title: PropTypes.string.isRequired,
};

CountriesPage.defaultProps = {
	title: 'Countries',
};
