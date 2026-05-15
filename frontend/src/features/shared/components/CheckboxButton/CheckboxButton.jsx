import { cn } from '../../utils/classNames';
import PropTypes from 'prop-types';
import { Icon } from '../Icon';

export function CheckboxButton({
	checked,
	children,
	className = '',
	defaultChecked = false,
	disabled = false,
	name,
	onChange,
	readOnly = false,
	value,
	...props
}) {
	const isControlled = checked !== undefined;

	return (
		<label
			className={cn(
				'inline-flex cursor-pointer items-center gap-[8px] select-none',
				disabled && 'cursor-not-allowed opacity-60',
				className
			)}
		>
			<input
				type="checkbox"
				className="peer sr-only"
				checked={isControlled ? checked : undefined}
				defaultChecked={!isControlled ? defaultChecked : undefined}
				disabled={disabled}
				name={name}
				readOnly={readOnly || (isControlled && !onChange)}
				value={value}
				onChange={onChange}
				{...props}
			/>

			<span
				className={cn(
					'inline-flex shrink-0 items-center justify-center bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-900 transition-colors duration-200 peer-checked:bg-cinemata-sunset-horizon-400p peer-focus-visible:ring-2 peer-focus-visible:ring-cinemata-sunset-horizon-400p peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cinemata-white dark:peer-focus-visible:ring-offset-cinemata-pacific-deep-900'
				)}
				style={{ width: 18, height: 18 }}
				aria-hidden="true"
			>
				<Icon
					name="checklist"
					decorative
					size={14}
					className={cn(
						'transition-opacity duration-200',
						checked ? 'text-cinemata-white dark:text-cinemata-pacific-deep-900 opacity-100' : 'opacity-0'
					)}
				/>
			</span>

			{children && (
				<span className="body-body-16-regular text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
					{children}
				</span>
			)}
		</label>
	);
}

CheckboxButton.propTypes = {
	checked: PropTypes.bool,
	children: PropTypes.node,
	className: PropTypes.string,
	defaultChecked: PropTypes.bool,
	disabled: PropTypes.bool,
	name: PropTypes.string,
	onChange: PropTypes.func,
	readOnly: PropTypes.bool,
	value: PropTypes.string,
};
