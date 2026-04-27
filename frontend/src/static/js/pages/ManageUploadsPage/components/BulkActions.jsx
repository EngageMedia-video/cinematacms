import React from 'react';
import PropTypes from 'prop-types';

export function UploadsBulkActions({ selectedItemsSize, onBulkStateChange }) {
	if (!selectedItemsSize) {
		return null;
	}

	function onClickMakePrivate() {
		if ('function' === typeof onBulkStateChange) {
			onBulkStateChange('private');
		}
	}

	function onClickMakePublic() {
		if ('function' === typeof onBulkStateChange) {
			onBulkStateChange('public');
		}
	}

	function onClickMakeUnlisted() {
		if ('function' === typeof onBulkStateChange) {
			onBulkStateChange('unlisted');
		}
	}

	return (
		<div className="manage-uploads-bulk-actions">
			<span className="bulk-selected-count">{selectedItemsSize} selected</span>
			<button className="bulk-action-btn bulk-action-private" onClick={onClickMakePrivate}>
				Make Private
			</button>
			<button className="bulk-action-btn bulk-action-public" onClick={onClickMakePublic}>
				Make Public
			</button>
			<button className="bulk-action-btn bulk-action-unlisted" onClick={onClickMakeUnlisted}>
				Make Unlisted
			</button>
		</div>
	);
}

UploadsBulkActions.propTypes = {
	selectedItemsSize: PropTypes.number.isRequired,
	onBulkStateChange: PropTypes.func,
};
