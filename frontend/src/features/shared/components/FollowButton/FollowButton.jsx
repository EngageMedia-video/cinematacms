import { cn } from '../../utils/classNames';
import { Icon } from '../Icon';
import { Button } from '../Button';

function getLabel(personName, followed) {
	if (followed) {
		return 'Following';
	}

	return personName ? `Follow ${personName}` : 'Follow';
}

export function FollowButton({
	personName = '',
	followed = false,
	className = '',
	onMouseEnter,
	onMouseLeave,
	...props
}) {
	const label = getLabel(personName, followed);

	return (
		<Button
			variant={followed ? 'secondary-outline' : 'secondary'}
			icon={<Icon name="followUser" decorative data-testid="follow-icon" size="sm" />}
			className={cn('border', className)}
			aria-label={props['aria-label'] ?? label}
			aria-pressed={followed}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			{...props}
		>
			{label}
		</Button>
	);
}
