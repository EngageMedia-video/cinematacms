import React from 'react';

import ApiUrlContext from '../contexts/ApiUrlContext';

import { Page } from './_Page';
import PageStore from './_PageStore';

import SearchFieldStore from '../components/-NEW-/SearchField/store.js';

import { MediaListWrapper } from './components/MediaListWrapper';
import { MediaListHeader } from './components/MediaListHeader';

import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';

import { SearchMediaFiltersRow } from '../components/-NEW-/SearchMediaFiltersRow';

import { SearchResultsFilters } from '../components/-NEW-/SearchResultsFilters.js';
import { FiltersToggleButton } from '../components/-NEW-/FiltersToggleButton.js';

export class SearchPage extends Page {
	constructor(props) {
		super(props, 'search-results');

		this.state = {
			validQuery: false,
			requestUrl: null,
			filterArgs: '',
			resultsTitle: null,
			resultsCount: null,
			searchQuery: SearchFieldStore.get('search-query'),
			searchCategories: SearchFieldStore.get('search-categories'),
			searchTags: SearchFieldStore.get('search-tags'),
			searchCountries: SearchFieldStore.get('search-countries'),
			searchLanguages: SearchFieldStore.get('search-languages'),
			searchTopics: SearchFieldStore.get('search-topics'),
			hiddenFilters: true,
		};

		this.getCountFunc = this.getCountFunc.bind(this);

		this.updateRequestUrl = this.updateRequestUrl.bind(this);
		this.onFilterArgsUpdate = this.onFilterArgsUpdate.bind(this);

		this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
		this.onFiltersUpdate = this.onFiltersUpdate.bind(this);

		this.didMount = false;

		this.updateRequestUrl();
	}

	componentDidMount() {
		this.didMount = true;
	}

	onToggleFiltersClick() {
		this.setState({
			hiddenFilters: !this.state.hiddenFilters,
		});
	}

	onFiltersUpdate(updatedArgs) {
		const args = {
			media_type: null,
			upload_date: null,
			license: null,
			sort_by: null,
			ordering: null,
		};

		switch (updatedArgs.media_type) {
			case 'video':
			case 'audio':
			case 'image':
			case 'pdf':
				args.media_type = updatedArgs.media_type;
				break;
		}

		switch (updatedArgs.upload_date) {
			case 'today':
			case 'this_week':
			case 'this_month':
			case 'this_year':
				args.upload_date = updatedArgs.upload_date;
				break;
		}

		switch (updatedArgs.license) {
			case '5':
			case '6':
			case '7':
			case '8':
			case '9':
			case '10':
			case 'no_license':
				args.license = updatedArgs.license;
				break;
		}

		switch (updatedArgs.sort_by) {
			case 'most_views':
				args.sort_by = 'views';
				break;
			case 'most_likes':
				args.sort_by = 'likes';
				break;
			case 'date_added_asc':
				args.ordering = 'asc';
				break;
		}

		const newArgs = [];

		for (let arg in args) {
			if (null !== args[arg]) {
				newArgs.push(arg + '=' + args[arg]);
			}
		}

		this.setState(
			{
				filterArgs: newArgs.length ? '&' + newArgs.join('&') : '',
			},
			function () {
				this.updateRequestUrl();
			}
		);
	}

	updateRequestUrl() {
		const validQuery =
			this.state.searchQuery ||
			this.state.searchCategories ||
			this.state.searchTags ||
			this.state.searchCountries ||
			this.state.searchLanguages ||
			this.state.searchTopics;

		let title = null;

		if (null !== this.state.resultsCount) {
			if (!validQuery) {
				title = 'No results for "' + this.state.searchQuery + '"';
			} else {
				if (this.state.searchCategories) {
					title =
						null === this.state.resultsCount || 0 === this.state.resultsCount
							? 'No'
							: this.state.resultsCount;
					title += ' media in category "' + this.state.searchCategories + '"';
				} else if (this.state.searchTags) {
					title =
						null === this.state.resultsCount || 0 === this.state.resultsCount
							? 'No'
							: this.state.resultsCount;
					title += ' media in tag "' + this.state.searchTags + '"';
				} else if (this.state.searchTopics) {
					title =
						null === this.state.resultsCount || 0 === this.state.resultsCount
							? 'No'
							: this.state.resultsCount;
					title += ' media in topic "' + this.state.searchTopics + '"';
				} else if (this.state.searchCountries) {
					title =
						null === this.state.resultsCount || 0 === this.state.resultsCount
							? 'No'
							: this.state.resultsCount;
					title += ' media in country "' + this.state.searchCountries + '"';
				} else if (this.state.searchLanguages) {
					title =
						null === this.state.resultsCount || 0 === this.state.resultsCount
							? 'No'
							: this.state.resultsCount;
					title += ' media in language "' + this.state.searchLanguages + '"';
				} else {
					if (null === this.state.resultsCount || 0 === this.state.resultsCount) {
						title = 'No results for "' + this.state.searchQuery + '"';
					} else {
						title =
							this.state.resultsCount +
							' result' +
							(1 < this.state.resultsCount ? 's' : '') +
							' for "' +
							this.state.searchQuery +
							'"';
					}
				}
			}
		}

		const api_url_postfix =
			(this.state.searchQuery || '') +
			(this.state.searchTags ? '&t=' + this.state.searchTags : '') +
			(this.state.searchCategories ? '&c=' + this.state.searchCategories : '') +
			(this.state.searchTopics ? '&topic=' + this.state.searchTopics : '') +
			(this.state.searchLanguages ? '&language=' + this.state.searchLanguages : '') +
			(this.state.searchCountries ? '&country=' + this.state.searchCountries : '');

		const url = ApiUrlContext._currentValue.search.query + api_url_postfix + this.state.filterArgs;

		if (this.didMount) {
			this.setState({
				validQuery: validQuery,
				requestUrl: url,
				resultsTitle: title,
			});
		} else {
			this.state.validQuery = validQuery;
			this.state.requestUrl = url;
			this.state.resultsTitle = title;
		}
	}

	onFilterArgsUpdate(updatedArgs) {
		const newArgs = [];

		for (let arg in updatedArgs) {
			if (null !== updatedArgs[arg]) {
				newArgs.push(arg + '=' + updatedArgs[arg]);
			}
		}

		this.setState(
			{
				filterArgs: newArgs.length ? '&' + newArgs.join('&') : '',
			},
			function () {
				this.updateRequestUrl();
			}
		);
	}

	getCountFunc(resultsCount) {
		this.setState(
			{
				resultsCount: resultsCount,
			},
			function () {
				this.updateRequestUrl();
			}
		);
	}

	pageContent() {
		const advancedFilters = PageStore.get('config-options').pages.search.advancedFilters;

		return (
			<MediaListWrapper
				className="search-results-wrap items-list-hor"
				title={null === this.state.resultsTitle ? null : this.state.resultsTitle}
			>
				{advancedFilters ? <FiltersToggleButton onClick={this.onToggleFiltersClick} /> : null}
				{advancedFilters ? (
					<SearchResultsFilters hidden={this.state.hiddenFilters} onFiltersUpdate={this.onFiltersUpdate} />
				) : null}

				{advancedFilters ? null : <SearchMediaFiltersRow onFiltersUpdate={this.onFilterArgsUpdate} />}

				{!this.state.validQuery ? null : (
					<LazyLoadItemListAsync
						key={this.state.requestUrl}
						singleLinkContent={false}
						horizontalItemsOrientation={true}
						itemsCountCallback={this.getCountFunc}
						requestUrl={this.state.requestUrl}
						hideViews={!PageStore.get('config-media-item').displayViews}
						hideAuthor={!PageStore.get('config-media-item').displayAuthor}
						hideDate={!PageStore.get('config-media-item').displayPublishDate}
					/>
				)}
			</MediaListWrapper>
		);
	}
}
