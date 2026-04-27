import React from 'react';

export function ThemeAlerts() {
	return (
		<div>
			<div className="alert">
				This is a{' '}
				<a href="#" title="">
					default
				</a>{' '}
				message.
			</div>

			<div className="alert brand">
				This is a{' '}
				<a href="#" title="">
					brand color
				</a>{' '}
				message.
			</div>

			<div className="alert success">
				This is a{' '}
				<a href="#" title="">
					success
				</a>{' '}
				message.
			</div>

			<div className="alert warning">
				This is a{' '}
				<a href="#" title="">
					warning
				</a>{' '}
				message.
			</div>

			<div className="alert error">
				This is an{' '}
				<a href="#" title="">
					error
				</a>{' '}
				message.
			</div>
		</div>
	);
}
