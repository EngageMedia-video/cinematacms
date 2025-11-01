import React from 'react';
import PropTypes from 'prop-types';

import ApiUrlContext from '../contexts/ApiUrlContext';

import { Page } from './_Page';
import PageStore from './_PageStore';

import { MediaListWrapper } from './components/MediaListWrapper';

import { LazyLoadItemListSplit } from '../components/-NEW-/LazyLoadItemListSplit';

import './MembersPage.css';

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

export class MembersPage extends Page {

	constructor(props){

		super(props, 'members');

		const urlvars = getUrlVars();

		const location = void 0 !== urlvars.location ? urlvars.location.trim() : null;
		const search = void 0 !== urlvars.search ? urlvars.search.trim() : null;
		const sort = void 0 !== urlvars.sort ? urlvars.sort.trim() : 'smart';

		// Set initial state
		this.state = {
			title: props.title,
			api_url: '', // Will be set by updateApiUrl()
			searchQuery: search || '',
			locationFilter: location || '',
			sortOption: sort,
		};

		// Use updateApiUrl() to build the initial API URL
		this.state.api_url = this.updateApiUrl();

		if(  null !== location && '' !== location ){

			if( 'International' === location ){
				this.state.title = location + ' members';
			}
			else{
				this.state.title = 'Members from ' + location;
			}
		}

		// Bind methods
		this.handleSearchChange = this.handleSearchChange.bind(this);
		this.handleLocationChange = this.handleLocationChange.bind(this);
		this.handleSortChange = this.handleSortChange.bind(this);

		// Debounce timer for search
		this.searchDebounceTimer = null;
	}

	componentWillUnmount() {
		// Clean up debounce timer on unmount
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}
	}

	updateApiUrl() {
		let params = [];
		
		if (this.state.searchQuery) {
			params.push('search=' + encodeURIComponent(this.state.searchQuery));
		}
		
		if (this.state.locationFilter) {
			params.push('location=' + encodeURIComponent(this.state.locationFilter));
		}
		
		if (this.state.sortOption && this.state.sortOption !== 'smart') {
			params.push('sort=' + encodeURIComponent(this.state.sortOption));
		}
		
		return ApiUrlContext._currentValue.users + 
			(params.length > 0 ? '?' + params.join('&') : '');
	}
	
	handleSearchChange(event) {
		const searchQuery = event.target.value;

		// Update search query immediately for responsive input
		this.setState({ searchQuery });

		// Clear existing timer
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}

		// Debounce API call by 300ms
		this.searchDebounceTimer = setTimeout(() => {
			this.setState({ api_url: this.updateApiUrl() });
		}, 300);
	}
	
	handleLocationChange(event) {
		const locationFilter = event.target.value;

		this.setState({ locationFilter }, () => {
			this.setState({ api_url: this.updateApiUrl() });
		});
	}
	
	handleSortChange(event) {
		const sortOption = event.target.value;

		this.setState({ sortOption }, () => {
			this.setState({ api_url: this.updateApiUrl() });
		});
	}

	pageContent(){
		return (
			<MediaListWrapper title={ this.state.title } className="items-list-ver">
				<div className="members-page-container">
					<div className="search-filters">
					<div className="search-box">
						<svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.35-4.35"></path>
						</svg>
						<input
							type="text"
							placeholder="Search members by name or location..."
							value={this.state.searchQuery}
							onChange={this.handleSearchChange}
						/>
					</div>
					<div className="filters">
						<select
							className="filter-select"
							value={this.state.locationFilter}
							onChange={this.handleLocationChange}
						>
							<option value="">All Locations</option>
							<option value="Malaysia">Malaysia</option>
							<option value="Philippines">Philippines</option>
							<option value="Indonesia">Indonesia</option>
							<option value="Vietnam">Vietnam</option>
							<option value="Thailand">Thailand</option>
							<option value="International">International</option>
						</select>
						<select
							className="filter-select"
							value={this.state.sortOption}
							onChange={this.handleSortChange}
						>
							<option value="smart">Most Active</option>
							<option value="recent">Recent Members</option>
							<option value="videos">Most Videos</option>
						</select>
					</div>
				</div>
				
				<div className="members-grid-container">
					<div style={{ width: '100%' }}>
						<LazyLoadItemListSplit requestUrl={ this.state.api_url } key={this.state.api_url} />
					</div>
				</div>
				
				<style jsx>{`
					.members-page-container {
						width: 100%;
					}

					.search-filters {
						background: var(--popup-bg-color, white);
						padding: 1.5rem;
						border-radius: 12px;
						margin-bottom: 2rem;
						box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
						border: 1px solid var(--input-border-color, #e2e8f0);
					}

					.search-box {
						display: flex;
						align-items: center;
						gap: 0.75rem;
						padding: 0.75rem 1rem;
						background: var(--input-bg-color, #f8fafc);
						border: 1px solid var(--input-border-color, #e2e8f0);
						border-radius: 8px;
						margin-bottom: 1rem;
					}

					.search-icon {
						flex-shrink: 0;
						color: var(--body-text-color, #94a3b8);
						opacity: 0.6;
					}

					.search-box input {
						flex: 1;
						border: none;
						background: transparent;
						font-size: 1rem;
						outline: none;
						color: var(--body-text-color, #1e293b);
					}

					.search-box input::placeholder {
						color: var(--body-text-color, #94a3b8);
						opacity: 0.5;
					}

					.filters {
						display: flex;
						gap: 1rem;
					}

					.filter-select {
						flex: 1;
						padding: 0.75rem 2.5rem 0.75rem 1rem;
						border: 1px solid var(--input-border-color, #e2e8f0);
						border-radius: 8px;
						background: var(--input-bg-color, white);
						font-size: 0.95rem;
						cursor: pointer;
						color: var(--body-text-color, #1e293b);
						-webkit-appearance: none;
						-moz-appearance: none;
						appearance: none;
						background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
						background-repeat: no-repeat;
						background-position: right 0.75rem center;
						background-size: 1.25rem;
					}

					.filter-select:focus {
						outline: none;
						border-color: var(--default-theme-color, #3b82f6);
					}

					.filter-select option {
						background: var(--input-bg-color, white);
						color: var(--body-text-color, #1e293b);
					}

					.members-grid-container {
						width: 100%;
						box-sizing: border-box;
					}

					@media (max-width: 768px) {
						.search-filters {
							padding: 1rem;
						}

						.filters {
							flex-direction: column;
						}
					}
				`}</style>
			</div>
			</MediaListWrapper>
		);
	}
}

MembersPage.propTypes = {
	title: PropTypes.string.isRequired,
};

MembersPage.defaultProps = {
	title: 'Members',
};