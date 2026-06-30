import { Icon, Text } from '../../shared/components';

export function ProfileSectionHeader({ icon, title, as = 'h3', id, action = null }) {
	return (
		<div className="flex items-center gap-3">
			<span className="inline-flex h-[45px] w-[45px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-emblem-blue text-text-profile-section-icon">
				<Icon name={icon} size={45} decorative />
			</span>
			<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
				<Text as={as} id={id} variant="h6-bold" className="m-0 text-text-primary">
					{title}
				</Text>
				{action}
			</div>
		</div>
	);
}
