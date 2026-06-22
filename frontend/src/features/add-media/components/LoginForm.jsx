import React from 'react';

export function LoginForm({ config }) {
	const redirectUrl = config.uploadMediaUrl || '/upload';
	const signupUrl = (config.signupUrl || '/accounts/signup/') + '?next=' + encodeURIComponent(redirectUrl);
	const loginUrl = config.loginUrl || '/accounts/login/';
	const resetPasswordUrl = config.resetPasswordUrl || '/accounts/password/reset/';

	return (
		<div className="user-action-form-wrap">
			<div className="user-action-form-inner">
				<h1>Sign In</h1>
				<p>Please log in or register before uploading a video.</p>
				<p>
					If you have not created an account yet, then please <a href={signupUrl}>sign up</a> first.
				</p>

				<form className="login" method="POST" action={loginUrl}>
					<input type="hidden" name="csrfmiddlewaretoken" value={config.csrfToken || ''} />
					<div dangerouslySetInnerHTML={{ __html: config.loginFormHtml || '' }}></div>
					<input type="hidden" name="next" value={redirectUrl} />

					<a className="button secondaryAction" href={resetPasswordUrl}>
						Forgot Password?
					</a>

					<button className="primaryAction" type="submit">
						Sign In
					</button>
				</form>
			</div>
		</div>
	);
}
