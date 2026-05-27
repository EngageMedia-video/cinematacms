import { Text } from '../../shared/components/Text/Text.jsx';
import { Avatar } from '../../shared/components/Avatar/Avatar.jsx';
import { UserRoleBadge } from '../../shared/components/UserRoleBadge';

export function MediaAuthorBanner(props) {
	return (
		<div className="flex flex-row gap-4 items-center">
			<a href={props.link || null} title={props.name}>
				<Avatar src={props.thumb} name={props.name || 'User'} size="large" style={{ width: 40, height: 40 }} />
			</a>
			<div className="inline-flex flex-col justify-center gap-1.5">
				<Text
					as="a"
					variant="body-16-medium"
					href={props.link}
					title={props.name}
					className="no-underline p-0 m-0"
				>
					<span>{props.name}</span>
				</Text>

				<UserRoleBadge isManager={false} isTrusted={true} />
			</div>
		</div>
	);
}
