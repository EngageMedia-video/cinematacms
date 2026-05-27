import React from 'react';
import PropTypes from 'prop-types';
import './UserRoleBadge.scss';
import { Badge } from '../Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { cn } from '../../utils/classNames';

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
		<span className="flex flex-row items-center gap-2">
			<Badge
				aria-label={`Role: ${badge.label}`}
				className={cn(
					'uppercase body-12-bold',
					isManager ? 'bg-bg-secondary' : isTrusted ? 'bg-bg-primary' : ''
				)}
			>
				{badge.label}
			</Badge>

			<Tooltip
				content="Helpful supporting text shown near the trigger."
				onOpenChange={() => {}}
				placement="right"
				trigger="hover"
			>
				<Button
					variant="icon"
					aria-label="Open tooltip"
					icon={<Icon name="infoYellow" size={18} decorative />}
				/>
			</Tooltip>
		</span>
	);
}

UserRoleBadge.propTypes = {
	isManager: PropTypes.bool,
	isTrusted: PropTypes.bool,
};
