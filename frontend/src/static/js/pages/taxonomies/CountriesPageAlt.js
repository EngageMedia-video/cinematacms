import React from 'react';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { CountriesPage } from './CountriesPage';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class CountriesPageAlt extends CountriesPage {
	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver hover-overlay-title">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inCountriesList={true}
							requestUrl={apiUrl.archive.countries}
							hideAllMeta={false}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}
