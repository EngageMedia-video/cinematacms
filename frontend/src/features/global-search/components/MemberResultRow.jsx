import { Avatar } from '../../shared/components/Avatar/Avatar';

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
			role="option"
			className="group flex items-center gap-3 rounded-[10px] px-2 py-2 text-left no-underline text-inherit transition-colors duration-150 hover:bg-cinemata-pacific-deep-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p"
		>
			<Avatar name={name} src={item.thumbnail_url || ''} size="large" />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="body-body-14-medium truncate text-cinemata-strait-blue-50">{name}</span>
				{meta ? <span className="body-body-12-regular truncate text-cinemata-pacific-deep-300">{meta}</span> : null}
			</span>
		</a>
	);
}
