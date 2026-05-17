import { Avatar } from '../../shared/components/Avatar/Avatar';
import { Text } from '../../shared/components/Text';

export function MemberResultRow({ item, onSelect }) {
	const name = item.name || item.username || 'Member';
	const username = item.username ? `@${item.username}` : '';
	const location = item.location || '';
	const url = item.url || (item.username ? `/user/${item.username}` : '#');
	const meta = [username, location].filter(Boolean).join(' . ');

	return (
		<a
			href={url}
			onClick={onSelect}
			className="group flex items-center gap-3 rounded-[10px] px-2 py-2 text-left no-underline text-inherit transition-colors duration-150 hover:bg-cinemata-pacific-deep-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
		>
			<Avatar name={name} src={item.thumbnail_url || ''} size="large" />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<Text variant="body-14" as="span" className="m-0 truncate text-cinemata-strait-blue-50">
					{name}
				</Text>
				{meta ? (
					<Text variant="body-12" as="span" className="m-0 truncate text-cinemata-pacific-deep-300">
						{meta}
					</Text>
				) : null}
			</span>
		</a>
	);
}
