import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

export function SearchBar({
	className = '',
	defaultValue,
	value,
	onChange,
	iconName = 'magnifyingGlass',
	placeholder = 'Search',
	disabled = false,
	'aria-label': ariaLabel = 'Search',
	ref,
	...props
}) {
	return (
		<div className={joinClasses('relative w-full max-w-full', className)}>
			<input
				{...props}
				ref={ref}
				defaultValue={defaultValue}
				value={value}
				onChange={onChange}
				type="search"
				disabled={disabled}
				placeholder={placeholder}
				aria-label={ariaLabel}
				className={joinClasses(
					'body-body-14-regular block w-full rounded-[8px] border border-transparent bg-cinemata-pacific-deep-800 px-[22px] py-[15px] pr-[58px] text-cinemata-strait-blue-50 outline-none transition-colors duration-200 placeholder:text-cinemata-pacific-deep-300 focus:border-cinemata-sunset-horizon-400p focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70',
					'[&::-webkit-search-cancel-button]:appearance-none'
				)}
			/>

			<span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-[22px] -translate-y-1/2">
				<Icon name={iconName} size={22} decorative />
			</span>
		</div>
	);
}
