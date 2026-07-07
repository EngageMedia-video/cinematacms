import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './UserRoleBadge.scss';
import { Badge } from '../Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { cn } from '../../utils/classNames';

// "manager" role is displayed as "Moderator" to end users per issue #546
function getRoleBadge(isManager, isTrusted) {
	if (isManager) {
		return {
			label: 'Moderator',
			className: 'moderator',
			tooltip:
				'Moderators help keep the Cinemata community safe. They review reported content and ensure discussions remain respectful and on-platform guidelines.',
		};
	}
	if (isTrusted) {
		return {
			label: 'Trusted',
			className: 'trusted',
			tooltip:
				'A verified Cinemata community member. Trusted users can upload films, control privacy and access settings, and use advanced platform features.',
		};
	}

	return null;
}

const COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)';

function useIsCompactViewport() {
	const [isCompact, setIsCompact] = useState(() =>
		typeof window === 'undefined' ? false : window.matchMedia(COMPACT_VIEWPORT_QUERY).matches
	);

	useEffect(() => {
		if (typeof window === 'undefined') return undefined;
		const mql = window.matchMedia(COMPACT_VIEWPORT_QUERY);
		const onChange = (event) => setIsCompact(event.matches);
		setIsCompact(mql.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, []);

	return isCompact;
}

export function UserRoleBadge({ isManager, isTrusted }) {
	const badge = getRoleBadge(isManager, isTrusted);
	const isCompact = useIsCompactViewport();

	if (!badge) return null;

	const tooltipPlacement = isCompact ? 'bottom' : 'right';

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

			<Tooltip content={badge.tooltip} placement={tooltipPlacement} trigger="hover">
				<Button
					variant="icon"
					aria-label="Open tooltip"
					icon={<Icon name="infoCircle" size={18} decorative />}
				/>
			</Tooltip>
		</span>
	);
}

UserRoleBadge.propTypes = {
	isManager: PropTypes.bool,
	isTrusted: PropTypes.bool,
};
