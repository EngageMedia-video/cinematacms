import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export function UploadsBulkActions(props) {
	const [selectedItemsSize, setSelectedItemsSize] = useState(props.selectedItemsSize);

	function onClickMakePrivate() {
		if ('function' === typeof props.onBulkStateChange) {
			props.onBulkStateChange('private');
		}
	}

	function onClickMakePublic() {
		if ('function' === typeof props.onBulkStateChange) {
			props.onBulkStateChange('public');
		}
	}

	function onClickMakeUnlisted() {
		if ('function' === typeof props.onBulkStateChange) {
			props.onBulkStateChange('unlisted');
		}
	}

	useEffect(() => {
		setSelectedItemsSize(props.selectedItemsSize);
	}, [props.selectedItemsSize]);

	if (!selectedItemsSize) {
		return null;
	}

	return (
		<div className="manage-uploads-bulk-actions">
			<span className="bulk-selected-count">{selectedItemsSize} selected</span>
			<button className="bulk-action-btn bulk-action-private" onClick={onClickMakePrivate}>Make Private</button>
			<button className="bulk-action-btn bulk-action-public" onClick={onClickMakePublic}>Make Public</button>
			<button className="bulk-action-btn bulk-action-unlisted" onClick={onClickMakeUnlisted}>Make Unlisted</button>
		</div>
	);
}

UploadsBulkActions.propTypes = {
	selectedItemsSize: PropTypes.number.isRequired,
	onBulkStateChange: PropTypes.func,
};
