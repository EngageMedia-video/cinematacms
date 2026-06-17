import { cn } from '../../../shared/utils/classNames';
import { CheckboxButton } from '../CheckboxButton';
import { useId } from 'react';

/**
 * Accessible multi-select checkbox group (fieldset + legend). Values are kept as
 * an array of option values (ids). Used for Category, Topic and Content
 * Sensitivity in the metadata form.
 */
export function CheckboxGroup({
	legend,
	options = [],
	value = [],
	onChange,
	name,
	required = false,
	error = '',
	helperText = '',
	columns = 2,
	className = '',
}) {
	const generatedMessageId = useId();
	function toggle(optionValue) {
		if (value.includes(optionValue)) {
			onChange?.(value.filter((item) => item !== optionValue));
		} else {
			onChange?.([...value, optionValue]);
		}
	}

	const message = error || helperText;
	const messageId = message ? `${generatedMessageId}-message` : undefined;

	return (
		<fieldset
			className={cn('m-0 min-w-0 border-0 p-0', className)}
			aria-describedby={messageId}
			aria-invalid={error ? 'true' : undefined}
		>
			<legend className="body-body-16-regular mb-3 p-0 text-text-strong">
				{legend}
				{required ? (
					<>
						<span className="text-text-accent" aria-hidden="true">
							{' '}
							*
						</span>
						<span className="sr-only"> required</span>
					</>
				) : null}
			</legend>
			<div className={cn('grid gap-3', columns === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
				{options.map((option) => (
					<CheckboxButton
						key={option.value}
						name={name}
						value={String(option.value)}
						checked={value.includes(option.value)}
						onChange={() => toggle(option.value)}
					>
						{option.label}
					</CheckboxButton>
				))}
			</div>
			{message ? (
				<p
					id={messageId}
					className={cn('body-body-12-regular mt-2', error ? 'text-text-danger' : 'text-text-accent')}
				>
					{message}
				</p>
			) : null}
		</fieldset>
	);
}
