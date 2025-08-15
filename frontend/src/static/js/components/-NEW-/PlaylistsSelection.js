import React, { useState, useEffect, useRef } from "react";

import PropTypes from "prop-types";

import PageStore from "../../pages/_PageStore.js";
import * as PageActions from "../../pages/_PageActions.js";

import MediaPageStore from "../../pages/MediaPage/store.js";
import * as MediaPageActions from "../../pages/MediaPage/actions.js";

import { MaterialIcon } from "./MaterialIcon";
import { CircleIconButton } from "./CircleIconButton";

import { PlaylistCreationForm } from "./PlaylistCreationForm";

import { addClassname, removeClassname } from "./functions/dom";

import stylesheet from "../styles/PlaylistsSelection.scss";

function PlaylistsSingleSelection(props) {
	function onChange(ev) {
		ev.persist();

		if (props.isChecked) {
			MediaPageActions.removeMediaFromPlaylist(
				props.playlistId,
				MediaPageStore.get("media-id")
			);
		} else {
			MediaPageActions.addMediaToPlaylist(
				props.playlistId,
				MediaPageStore.get("media-id")
			);
		}
	}

	return !!props.renderDate ? (
		<label>
			<input type="checkbox" checked={props.isChecked} onChange={onChange} />
			<span>{props.title}</span>
			{/*<MaterialIcon type={ "private" === this.props.privacy ? "lock" : ( "unlisted" === this.props.privacy ? "link" : "public" ) } />*/}
		</label>
	) : null;
}

PlaylistsSingleSelection.propTypes = {
	playlistId: PropTypes.string,
	isChecked: PropTypes.bool,
	title: PropTypes.string,
};

PlaylistsSingleSelection.defaultProps = {
	isChecked: false,
	title: "",
};

export function PlaylistsSelection(props) {
	const containerRef = useRef(null);
	const saveToSelectRef = useRef(null);

	const [date, setDate] = useState(new Date());
	const [playlists, setPlaylists] = useState(MediaPageStore.get("playlists"));
	const [openCreatePlaylist, setOpenCreatePlaylist] = useState(false);
	const [activeTab, setActiveTab] = useState("tab1");

	function onWindowResize() {
		updateSavetoSelectMaxHeight();
	}

	function onLoadPlaylists() {
		setPlaylists(MediaPageStore.get("playlists"));
		setDate(new Date());
	}

	function onPlaylistMediaAdditionComplete() {
		setPlaylists(MediaPageStore.get("playlists"));
		setDate(new Date());
		setTimeout(function () {
			PageActions.addNotification(
				"Video added to playlist",
				"playlistMediaAdditionComplete"
			);
		}, 100);
	}

	function onPlaylistMediaAdditionFail() {
		setTimeout(function () {
			PageActions.addNotification(
				"Media's addition to playlist failed",
				"playlistMediaAdditionFail"
			);
		}, 100);
	}

	function onPlaylistMediaRemovalComplete() {
		setPlaylists(MediaPageStore.get("playlists"));
		setDate(new Date());
		setTimeout(function () {
			PageActions.addNotification(
				"Video removed from playlist",
				"playlistMediaRemovalComplete"
			);
		}, 100);
	}

	function onPlaylistMediaRemovalFail() {
		setTimeout(function () {
			PageActions.addNotification(
				"Media's removal from playlist failed",
				"playlistMediaaRemovalFail"
			);
		}, 100);
	}

	function updateSavetoSelectMaxHeight() {
		if (null !== saveToSelectRef.current) {
			saveToSelectRef.current.style.maxHeight =
				window.innerHeight -
				(56 + 18) -
				(containerRef.current.offsetHeight - saveToSelectRef.current.offsetHeight) +
				"px";
		}
	}

	function getCreatedPlaylists() {
		const mediaId = MediaPageStore.get("media-id");
		let ret = [];
		let i = 0;
		while (i < playlists.length) {
			ret.push(
				<div key={"playlist_" + playlists[i].playlist_id}>
					<PlaylistsSingleSelection
						renderDate={date}
						title={playlists[i].title}
						privacy={playlists[i].status}
						isChecked={-1 < playlists[i].media_list.indexOf(mediaId)}
						playlistId={playlists[i].playlist_id}
					/>
				</div>
			);
			i += 1;
		}
		return ret;
	}

	function togglePlaylistCreationForm() {
		setOpenCreatePlaylist(!openCreatePlaylist);
		updateSavetoSelectMaxHeight();
	}

	function onClickExit() {
		setOpenCreatePlaylist(false);
		if (void 0 !== props.triggerPopupClose) {
			props.triggerPopupClose();
		}
	}

	function onPlaylistCreation(newPlaylistData) {
		const mediaId = MediaPageStore.get("media-id");
		MediaPageActions.addNewPlaylist(newPlaylistData);
		MediaPageActions.addMediaToPlaylist(newPlaylistData.playlist_id, mediaId);
		onClickExit();
	}

	useEffect(() => {
		updateSavetoSelectMaxHeight();
	});

	useEffect(() => {
		PageStore.on("window_resize", onWindowResize);
		MediaPageStore.on("playlists_load", onLoadPlaylists);
		MediaPageStore.on(
			"media_playlist_addition_completed",
			onPlaylistMediaAdditionComplete
		);
		MediaPageStore.on(
			"media_playlist_addition_failed",
			onPlaylistMediaAdditionFail
		);
		MediaPageStore.on(
			"media_playlist_removal_completed",
			onPlaylistMediaRemovalComplete
		);
		MediaPageStore.on(
			"media_playlist_removal_failed",
			onPlaylistMediaRemovalFail
		);

		return () => {
			PageStore.removeListener("window_resize", onWindowResize);
			MediaPageStore.removeListener("playlists_load", onLoadPlaylists);
			MediaPageStore.removeListener(
				"media_playlist_addition_completed",
				onPlaylistMediaAdditionComplete
			);
			MediaPageStore.removeListener(
				"media_playlist_addition_failed",
				onPlaylistMediaAdditionFail
			);
			MediaPageStore.removeListener(
				"media_playlist_removal_completed",
				onPlaylistMediaRemovalComplete
			);
			MediaPageStore.removeListener(
				"media_playlist_removal_failed",
				onPlaylistMediaRemovalFail
			);
		};
	}, []);

	//  Functions to handle Tab Switching
	const handleTab1 = () => {
		// update the state to tab1
		setActiveTab("tab1");
	};
	const handleTab2 = () => {
		// update the state to tab2
		setActiveTab("tab2");
	};

	return (
		<div ref={containerRef} className="saveto-popup">
			<div className="hw-tabs">
				<CircleIconButton type="button" onClick={onClickExit}>
					<MaterialIcon type="close" />
				</CircleIconButton>
				<ul className="nav">
					<li className={activeTab === "tab1" ? "active" : ""} onClick={handleTab1}>
						<span>Save to</span>
					</li>
					<li className={activeTab === "tab2" ? "active" : ""} onClick={handleTab2}>
						<span>Create new</span>
					</li>
				</ul>
				<div className="outlet">
					{activeTab === "tab1" ? (
						<div className="FirstTab">
							{playlists.length ? (
								<div ref={saveToSelectRef} className="saveto-select">
									{getCreatedPlaylists()}
								</div>
							) : (
								<div className="saveto-select">There are no any playlists yet.</div>
							)}
						</div>
					) : (
						<div className="SecondTab">
							<div className="saveto-new-playlist">
								<PlaylistCreationForm
									onCancel={onClickExit}
									onPlaylistSave={onPlaylistCreation}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

PlaylistsSelection.propTypes = {
	triggerPopupClose: PropTypes.func,
};
