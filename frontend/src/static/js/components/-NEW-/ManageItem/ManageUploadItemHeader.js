import React from 'react';
import PropTypes from 'prop-types';

import { MaterialIcon } from '../MaterialIcon.js';
import { useManagementTableHeader } from './hooks/useManagementTableHeader';

export function ManageUploadItemHeader(props) {
	const [sort, order, isSelected, sortByColumn, checkAll] = useManagementTableHeader({
		...props,
		type: 'my-uploads',
	});

	return (
		<div className="item manage-item manage-item-header manage-upload-item">
			<div className="mi-checkbox">
				<input type="checkbox" checked={isSelected} onChange={checkAll} />
			</div>
			<div
				id="title"
				onClick={sortByColumn}
				className={'mi-title mi-col-sort' + ('title' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
			>
				Title
				<div className="mi-col-sort-icons">
					<span>
						<MaterialIcon type="arrow_drop_up" />
					</span>
					<span>
						<MaterialIcon type="arrow_drop_down" />
					</span>
				</div>
			</div>
			<div
				id="add_date"
				onClick={sortByColumn}
				className={'mi-added mi-col-sort' + ('add_date' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
			>
				Date added
				<div className="mi-col-sort-icons">
					<span>
						<MaterialIcon type="arrow_drop_up" />
					</span>
					<span>
						<MaterialIcon type="arrow_drop_down" />
					</span>
				</div>
			</div>
			<div className="mi-type">Media type</div>
			<div className="mi-encoding">Encoding</div>
			<div className="mi-state">State</div>
			<div
				id="views"
				onClick={sortByColumn}
				className={'mi-views mi-col-sort' + ('views' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
			>
				Views
				<div className="mi-col-sort-icons">
					<span>
						<MaterialIcon type="arrow_drop_up" />
					</span>
					<span>
						<MaterialIcon type="arrow_drop_down" />
					</span>
				</div>
			</div>
			<div
				id="likes"
				onClick={sortByColumn}
				className={'mi-likes mi-col-sort' + ('likes' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
			>
				Likes
				<div className="mi-col-sort-icons">
					<span>
						<MaterialIcon type="arrow_drop_up" />
					</span>
					<span>
						<MaterialIcon type="arrow_drop_down" />
					</span>
				</div>
			</div>
		</div>
	);
}

ManageUploadItemHeader.propTypes = {
	sort: PropTypes.string.isRequired,
	order: PropTypes.string.isRequired,
	selected: PropTypes.bool.isRequired,
	onClickColumnSort: PropTypes.func,
	onCheckAllRows: PropTypes.func,
};
