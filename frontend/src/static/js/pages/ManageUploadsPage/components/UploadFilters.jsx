import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import { FilterOptions } from '../../../components/-NEW-/FilterOptions';
import PageStore from '../../_PageStore.js';

import '../../../components/styles/ManageItemList-filters.scss';

const filters = {
	state: [
		{ id: 'all', title: 'All' },
		{ id: 'public', title: 'Public' },
		{ id: 'private', title: 'Private' },
		{ id: 'unlisted', title: 'Unlisted' },
	],
	encoding_status: [
		{ id: 'all', title: 'All' },
		{ id: 'success', title: 'Success' },
		{ id: 'running', title: 'Running' },
		{ id: 'pending', title: 'Pending' },
		{ id: 'fail', title: 'Fail' },
	],
};

export function UploadFilters({ hidden = false, onFiltersUpdate }) {
	const [isHidden, setIsHidden] = useState(hidden);

	const [state, setState] = useState('all');
	const [encodingStatus, setEncodingStatus] = useState('all');
	const [searchValue, setSearchValue] = useState('');

	const containerRef = useRef(null);
	const innerContainerRef = useRef(null);
	const searchTimeoutRef = useRef(null);

	function onWindowResize() {
		if (!isHidden) {
			containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
		}
	}

	function onFilterSelect(ev) {
		const args = {
			state: state,
			encoding_status: encodingStatus,
			search: encodeURIComponent(searchValue),
		};

		switch (ev.currentTarget.getAttribute('filter')) {
			case 'state':
				args.state = ev.currentTarget.getAttribute('value');
				onFiltersUpdate(args);
				setState(args.state);
				break;
			case 'encoding_status':
				args.encoding_status = ev.currentTarget.getAttribute('value');
				onFiltersUpdate(args);
				setEncodingStatus(args.encoding_status);
				break;
		}
	}

	function onSearchChange(ev) {
		const val = ev.target.value;
		setSearchValue(val);

		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		searchTimeoutRef.current = setTimeout(function () {
			searchTimeoutRef.current = null;
			const args = {
				state: state,
				encoding_status: encodingStatus,
				search: encodeURIComponent(val),
			};
			onFiltersUpdate(args);
		}, 300);
	}

	useEffect(() => {
		setIsHidden(hidden);
		onWindowResize();
	}, [hidden]);

	useEffect(() => {
		PageStore.on('window_resize', onWindowResize);
		return () => {
			PageStore.removeListener('window_resize', onWindowResize);
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div ref={containerRef} className={'mi-filters-row' + (isHidden ? ' hidden' : '')}>
			<div ref={innerContainerRef} className="mi-filters-row-inner">
				<div className="mi-filter mi-filter-search">
					<div className="mi-filter-title">SEARCH</div>
					<div className="mi-filter-options">
						<input
							type="text"
							placeholder="Search by title..."
							value={searchValue}
							onChange={onSearchChange}
							className="mi-search-input"
						/>
					</div>
				</div>

				<div className="mi-filter">
					<div className="mi-filter-title">STATE</div>
					<div className="mi-filter-options">
						<FilterOptions
							id={'state'}
							options={filters.state}
							selected={state}
							onSelect={onFilterSelect}
						/>
					</div>
				</div>

				<div className="mi-filter">
					<div className="mi-filter-title">ENCODING STATUS</div>
					<div className="mi-filter-options">
						<FilterOptions
							id={'encoding_status'}
							options={filters.encoding_status}
							selected={encodingStatus}
							onSelect={onFilterSelect}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

UploadFilters.propTypes = {
	hidden: PropTypes.bool,
	onFiltersUpdate: PropTypes.func.isRequired,
};
