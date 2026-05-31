import { cn } from '../../utils/classNames';
import { Icon } from '../Icon';

export function SearchBar({
	className = '',
	defaultValue,
	value,
	onChange,
	iconName = 'magnifyingGlass',
	name = 'search',
	placeholder = 'Search',
	disabled = false,
	'aria-label': ariaLabel = 'Search',
	ref,
	...props
}) {
	return (
		<div className={cn('relative w-full max-w-full', className)}>
			<input
				{...props}
				ref={ref}
				defaultValue={defaultValue}
				value={value}
				onChange={onChange}
				type="search"
				name={name}
				disabled={disabled}
				placeholder={placeholder}
				aria-label={ariaLabel}
				className={cn(
					'global-search-input body-body-14-regular block w-full rounded-[8px] bg-bg-chrome px-[22px] py-[15px] pr-[58px] text-text-on-chrome outline-none transition-[background-color,color,box-shadow] duration-200 placeholder:text-text-on-chrome-muted focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page disabled:cursor-not-allowed disabled:opacity-70',
					'[&::-webkit-search-cancel-button]:appearance-none'
				)}
			/>

			<span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-[22px] -translate-y-1/2">
				<Icon name={iconName} size={22} decorative />
			</span>
		</div>
	);
}
