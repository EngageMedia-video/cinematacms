import React from 'react';
import PropTypes from 'prop-types';
import './UserRoleBadge.scss';

// "manager" role is displayed as "Moderator" to end users per issue #546
function getRoleBadge(isManager, isTrusted) {
	if (isManager) return { label: 'Moderator', className: 'moderator' };
	if (isTrusted) return { label: 'Trusted', className: 'trusted' };
	return null;
}

export function UserRoleBadge({ isManager, isTrusted }) {
	const badge = getRoleBadge(isManager, isTrusted);
	if (!badge) return null;
	return (
		<span className={`user-role-badge--${badge.className}`} aria-label={`Role: ${badge.label}`}>
			{badge.label}
		</span>
	);
}

UserRoleBadge.propTypes = {
	isManager: PropTypes.bool,
	isTrusted: PropTypes.bool,
};
