import React from 'react';

import ApiUrlContext from '../../contexts/ApiUrlContext';

import { Page } from '../_Page';
import * as PageActions from '../_PageActions';

import { MediaListWrapper } from '../components/MediaListWrapper';

import { FiltersToggleButton } from '../../components/-NEW-/FiltersToggleButton';
import { ManageItemList } from '../../components/-NEW-/ManageItemList/ManageItemList';

import { UploadFilters } from './components/UploadFilters';
import { UploadsBulkActions } from './components/BulkActions';

import getCSRFToken from '../../functions/getCSRFToken';
import postRequest from '../../functions/postRequest';

import './ManageUploadsPage.scss';

function genReqUrl(url, filters, sort, page) {
	return url + '?' + filters + ('' === filters ? '' : '&') + sort + ('' === sort ? '' : '&') + 'page=' + page;
}

export class ManageUploadsPage extends Page {
	constructor(props) {
		super(props, 'manage-uploads');

		this.state = {
			resultsCount: null,
			currentPage: 1,
			requestUrl: ApiUrlContext._currentValue.manage.myUploads,
			pageTitle: props.title,
			hiddenFilters: true,
			filterArgs: '',
			sortingArgs: '',
			sortBy: 'add_date',
			ordering: 'desc',
			refresh: 0,
			selectedTokens: [],
		};

		this.getCountFunc = this.getCountFunc.bind(this);
		this.onTablePageChange = this.onTablePageChange.bind(this);
		this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
		this.onFiltersUpdate = this.onFiltersUpdate.bind(this);
		this.onColumnSortClick = this.onColumnSortClick.bind(this);
		this.onItemsRemoval = this.onItemsRemoval.bind(this);
		this.onItemsRemovalFail = this.onItemsRemovalFail.bind(this);
		this.onSelectionChange = this.onSelectionChange.bind(this);
		this.onBulkStateChange = this.onBulkStateChange.bind(this);
	}

	onTablePageChange(newPageUrl, updatedPage) {
		this.setState({
			currentPage: updatedPage,
			requestUrl: genReqUrl(
				ApiUrlContext._currentValue.manage.myUploads,
				this.state.filterArgs,
				this.state.sortingArgs,
				updatedPage
			),
		});
	}

	onToggleFiltersClick() {
		this.setState({
			hiddenFilters: !this.state.hiddenFilters,
		});
	}

	getCountFunc(resultsCount) {
		this.setState({
			resultsCount: resultsCount,
		});
	}

	onFiltersUpdate(updatedArgs) {
		const newArgs = [];

		for (let arg in updatedArgs) {
			if (null !== updatedArgs[arg] && 'all' !== updatedArgs[arg] && '' !== updatedArgs[arg]) {
				newArgs.push(arg + '=' + updatedArgs[arg]);
			}
		}

		this.setState({
			filterArgs: newArgs.join('&'),
			currentPage: 1,
			requestUrl: genReqUrl(
				ApiUrlContext._currentValue.manage.myUploads,
				newArgs.join('&'),
				this.state.sortingArgs,
				1
			),
		});
	}

	onColumnSortClick(sort, order) {
		const newArgs = 'sort_by=' + sort + '&ordering=' + order;
		this.setState({
			sortBy: sort,
			ordering: order,
			sortingArgs: newArgs,
			requestUrl: genReqUrl(
				ApiUrlContext._currentValue.manage.myUploads,
				this.state.filterArgs,
				newArgs,
				this.state.currentPage
			),
		});
	}

	onItemsRemoval() {
		this.setState(
			{
				resultsCount: null,
				selectedTokens: [],
				refresh: this.state.refresh + 1,
				requestUrl: ApiUrlContext._currentValue.manage.myUploads,
			},
			function () {
				PageActions.addNotification('The media deleted successfully.', 'mediaRemovalSucceed');
			}
		);
	}

	onItemsRemovalFail() {
		PageActions.addNotification('The media removal failed. Please try again.', 'mediaRemovalFailed');
	}

	onSelectionChange(selectedItems) {
		this.setState({
			selectedTokens: selectedItems,
		});
	}

	onBulkStateChange(newState) {
		const tokens = this.state.selectedTokens;

		if (!tokens.length) {
			return;
		}

		const self = this;

		postRequest(
			ApiUrlContext._currentValue.manage.myUploads + '/bulk_state',
			{
				tokens: tokens,
				state: newState,
			},
			{
				headers: {
					'X-CSRFToken': getCSRFToken(),
					'Content-Type': 'application/json',
				},
			},
			false,
			function (response) {
				if (response && response.data && response.data.updated) {
					self.setState(
						{
							resultsCount: null,
							selectedTokens: [],
							refresh: self.state.refresh + 1,
							requestUrl: ApiUrlContext._currentValue.manage.myUploads,
						},
						function () {
							PageActions.addNotification(
								response.data.updated +
									' item' +
									(response.data.updated > 1 ? 's' : '') +
									' changed to ' +
									newState +
									'.',
								'bulkStateChangeSucceed'
							);
						}
					);
				}
			},
			function () {
				PageActions.addNotification('State change failed. Please try again.', 'bulkStateChangeFailed');
			}
		);
	}

	pageContent() {
		return (
			<MediaListWrapper
				title={
					this.state.pageTitle +
					(null === this.state.resultsCount ? '' : ' (' + this.state.resultsCount + ')')
				}
				className=""
			>
				<UploadsBulkActions
					selectedItemsSize={this.state.selectedTokens.length}
					onBulkStateChange={this.onBulkStateChange}
				/>
				<FiltersToggleButton onClick={this.onToggleFiltersClick} />
				<UploadFilters hidden={this.state.hiddenFilters} onFiltersUpdate={this.onFiltersUpdate} />
				<ManageItemList
					pageItems={50}
					manageType={'my-uploads'}
					key={this.state.requestUrl + '[' + this.state.refresh + ']'}
					requestUrl={this.state.requestUrl}
					itemsCountCallback={this.getCountFunc}
					onPageChange={this.onTablePageChange}
					sortBy={this.state.sortBy}
					ordering={this.state.ordering}
					onRowsDelete={this.onItemsRemoval}
					onRowsDeleteFail={this.onItemsRemovalFail}
					onClickColumnSort={this.onColumnSortClick}
					onSelectionChange={this.onSelectionChange}
				/>
			</MediaListWrapper>
		);
	}
}

ManageUploadsPage.defaultProps = {
	title: 'Manage uploads',
};
