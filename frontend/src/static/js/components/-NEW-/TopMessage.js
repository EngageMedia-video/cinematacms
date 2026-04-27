import React from 'react';

function TopMessage({ onClick, message }) {
	return (
		<div className="top-message" role="alert" style={{ zIndex: 1000 }}>
			<button
				type="button"
				className="top-message--close"
				data-dismiss="alert"
				aria-label="Close"
				onClick={onClick}
			>
				<svg
					className="top-message--close-icon"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
			</button>

			<div className="top-message--text" dangerouslySetInnerHTML={{ __html: message }} />
		</div>
	);
}

export default TopMessage;
