import { Icon } from '../Icon';
import { Text } from '../Text';
import { cn } from '../../utils/classNames';

export function Disclosure({ title, children, className = '', ...props }) {
	return (
		<details className={cn('group/disclosure', className)} {...props}>
			<Text
				as="summary"
				variant="body-14-medium"
				className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-ds-4 py-2 text-text-secondary hover:text-text-link focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus [&::-webkit-details-marker]:hidden"
			>
				<Icon name="chevronDown" size={16} decorative className="shrink-0 group-open/disclosure:rotate-180" />
				{title}
			</Text>
			<div className="pt-2 pb-4">{children}</div>
		</details>
	);
}
