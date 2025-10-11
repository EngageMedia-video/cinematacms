import React from "react";

function HomepagePopup({ onClick, message }) {
	let message_obj = {};
	if (message) {
		if (typeof message !== "object") {
			message_obj = JSON.parse(message);
		} else {
			message_obj = message;
		}
	}

	if (!message_obj.popup_image_url) {
		return <></>;
	}

	return (
		<div
			className="homepage-popup"
			style={{
				zIndex: 1000,
			}}
		>
			<div className="homepage-popup-fullscreen">
				<div className="homepage-popup--container">
					<div className="homepage-popup--img-container">
						<a href={message_obj.url}>
							<img
								src={message_obj.popup_image_url}
								alt="Cinemata homepage-popup image"
								className="homepage-popup--image"
							/>
						</a>
						<button onClick={onClick} className="homepage-popup--close-btn">
							<span>close</span>
							<svg
								className="homepage-popup--close-btn--icon"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									strokeLinecap={"round"}
									strokeLinejoin={"round"}
									strokeWidth={2}
									d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default HomepagePopup;
