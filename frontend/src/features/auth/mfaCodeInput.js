/**
 * Six-box authenticator code entry, with a backup-code fallback, for the
 * two-factor authentication form (templates/mfa/authenticate.html).
 *
 * The form submits itself once the sixth digit arrives (typed, pasted or
 * autofilled), at most once per page load. The page text announces this
 * (WCAG 3.2.2). Brute-force cost is unchanged: allauth rate-limits the POST,
 * which a script can send without this page.
 *
 * Moved out of an inline <script> into the Vite pipeline so it is linted and
 * tested. It binds only to a form marked with data-mfa-code-form; the
 * reauthenticate and TOTP activation pages keep their own inline scripts.
 */

export function initMfaCodeInput() {
	const form = document.querySelector('form[data-mfa-code-form]');
	if (!form || form.dataset.mfaCodeReady === 'true') return;
	form.dataset.mfaCodeReady = 'true';

	const codeInput = form.querySelector('.otp-hidden-input');
	const otpDigits = Array.from(form.querySelectorAll('.otp-digit'));
	const recoveryCode = document.getElementById('recovery-code');
	const otpContainer = document.getElementById('otp-input-container');
	const recoveryContainer = document.getElementById('recovery-input-container');
	const otpInstruction = document.getElementById('otp-instruction');
	const recoveryInstruction = document.getElementById('recovery-instruction');
	const toggleButton = document.getElementById('toggle-recovery-mode');
	const altQuestion = document.getElementById('mfa-alt-question');

	let isRecoveryMode = false;
	let submitted = false;

	form.addEventListener('submit', function (event) {
		// One request per page load: a second POST races the first and is checked against a spent code.
		if (submitted) {
			event.preventDefault();
			return;
		}
		submitted = true;
	});

	window.addEventListener('pageshow', function (event) {
		if (event.persisted) submitted = false;
	});

	function otpCode() {
		return otpDigits.map((digit) => digit.value).join('');
	}

	function updateCodeInput() {
		if (!codeInput) return;
		codeInput.value = isRecoveryMode ? recoveryCode.value : otpCode();
	}

	function submitWhenComplete() {
		if (submitted || otpCode().length !== otpDigits.length) return;
		form.requestSubmit();
	}

	toggleButton.addEventListener('click', function (event) {
		event.preventDefault();
		isRecoveryMode = !isRecoveryMode;

		if (isRecoveryMode) {
			otpContainer.style.setProperty('display', 'none', 'important');
			recoveryContainer.classList.remove('!hidden');
			otpInstruction.classList.add('hidden');
			recoveryInstruction.classList.remove('hidden');
			recoveryCode.focus();
			altQuestion.textContent = "Don't have your backup code?";
			toggleButton.textContent = 'Use 6-digit code';
		} else {
			otpContainer.style.removeProperty('display');
			recoveryContainer.classList.add('!hidden');
			otpInstruction.classList.remove('hidden');
			recoveryInstruction.classList.add('hidden');
			otpDigits[0].focus();
			altQuestion.textContent = "Don't have your authenticator app?";
			toggleButton.textContent = 'Use a backup code';
		}

		otpDigits.forEach((digit) => {
			digit.value = '';
		});
		recoveryCode.value = '';
		if (codeInput) codeInput.value = '';
	});

	otpDigits[0].focus();

	recoveryCode.addEventListener('input', function () {
		recoveryCode.value = recoveryCode.value.replace(/[^0-9]/g, '').substring(0, 12);
		updateCodeInput();
	});

	recoveryCode.addEventListener('paste', function () {
		// Let the browser paste into the single field, then clean up the result.
		setTimeout(() => {
			recoveryCode.value = recoveryCode.value.replace(/[^0-9]/g, '').substring(0, 12);
			updateCodeInput();
		}, 0);
	});

	otpDigits.forEach((digit, index) => {
		digit.addEventListener('input', function () {
			digit.value = digit.value.replace(/[^0-9]/g, '');
			if (digit.value && index < otpDigits.length - 1) {
				otpDigits[index + 1].focus();
			}
			updateCodeInput();
			submitWhenComplete();
		});

		digit.addEventListener('keydown', function (event) {
			if (event.key === 'Backspace' && !digit.value && index > 0) {
				otpDigits[index - 1].focus();
			} else if (event.key === 'ArrowLeft' && index > 0) {
				otpDigits[index - 1].focus();
			} else if (event.key === 'ArrowRight' && index < otpDigits.length - 1) {
				otpDigits[index + 1].focus();
			}
		});

		digit.addEventListener('focus', function () {
			digit.select();
		});
	});

	otpDigits[0].addEventListener('paste', function (event) {
		event.preventDefault();
		const pastedData = (event.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');

		for (let i = 0; i < Math.min(pastedData.length, otpDigits.length); i++) {
			otpDigits[i].value = pastedData[i];
		}

		otpDigits[Math.min(pastedData.length, otpDigits.length - 1)].focus();
		updateCodeInput();
		submitWhenComplete();
	});
}
