import React from 'react';
import EventEmitter from 'events';
import { exportStore, getRequest, postRequest, putRequest, deleteRequest, getCSRFToken } from '../../functions';
import { default as axios, get as axiosGet } from 'axios';

import { config as mediacmsConfig } from '../../mediacms/config.js';

/*import * as MediaCMSLib from '../../../../../lib/dist/mediacms-frontend-lib.js';

const MediaCMSModels = MediaCMSLib.core.entities;*/

import UrlParse from 'url-parse';

import PageStore from '../_PageStore.js';

function extractPlaylistId(){

    let playlistId = null;

    const getParamsString = window.location.search;

    if( '' !== getParamsString ){

        let tmp = getParamsString.split('?');

        if( 2 === tmp.length ){

            tmp = tmp[1].split('&');

            let x;

            let i = 0;
            while(i < tmp.length){

                x = tmp[i].split('=');

                if( 'pl' === x[0] ){

                    if( 2 === x.length ){
                        playlistId = x[1];
                    }

                    break;
                }

                i += 1;
            }
        }
    }

    return playlistId;
}

const MediaPageStoreData = {};

class MediaPageStore extends EventEmitter{

    constructor() {

        super();

        this.mediacms_config = mediacmsConfig( window.MediaCMS );

        this._MEDIA = null;

        this.pagePlaylistId = null;
        this.pagePlaylistData = null;

        MediaPageStoreData[ Object.defineProperty( this, 'id', { value: 'MediaPageStoreData_' + Object.keys(MediaPageStoreData).length }).id ] = {
            likedMedia: false,
            dislikedMedia: false,
            reported_times: 0,
            while:{
                deleteMedia: false,
                submitComment: false,
                deleteCommentId: null,
            }
        };

        this.removeMediaResponse = this.removeMediaResponse.bind(this);
        this.removeMediaFail = this.removeMediaFail.bind(this);

        this.submitCommentFail = this.submitCommentFail.bind(this);
        this.submitCommentResponse = this.submitCommentResponse.bind(this);

        this.removeCommentFail = this.removeCommentFail.bind(this);
        this.removeCommentResponse = this.removeCommentResponse.bind(this);
    }

    loadData(){

        if( ! MediaPageStoreData[this.id].mediaId ){

            let urlParams = (function(){
                let ret = new UrlParse( window.location.href ).query;
                if(! ret ){
                    ret = [];
                }
                else{
                    ret = ret.substring(1);
                    ret.split("&");
                    ret = ret.length ? ret.split("=") : [];
                }
                return ret;
            })();

            if( urlParams.length ){
                let i = 0;
                while( i < urlParams.length ){
                    if( "m" === urlParams[i] ){ // @note: "m" is paramater name for media's id/token.
                        MediaPageStoreData[this.id].mediaId = urlParams[ i + 1 ];
                    }
                    i += 2;
                }
            }
        }

        if( ! MediaPageStoreData[this.id].mediaId ){
            console.warn( "Invalid media id:", MediaPageStoreData[this.id].mediaId );
            return false;
        }

        // let p = new URLSearchParams(window.location.search).get('password');
        let p = null;
        // provided_password is set on media.html Django template.
        // the password is sent as POST parameter so cannot use URLSearchParams here
        if (MediaCMS.provided_password) {
            p = MediaCMS.provided_password;
        }

        this.mediaAPIUrl = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId;
        if (p) {
            this.mediaAPIUrl += '?password=' + encodeURIComponent(p);
        }

        this.dataResponse = this.dataResponse.bind(this);
        this.dataErrorResponse = this.dataErrorResponse.bind(this);
        getRequest( this.mediaAPIUrl, !1, this.dataResponse, this.dataErrorResponse );
    }

    loadPlaylistData(){

        const playlistApiUrl = this.mediacms_config.api.playlists + '/' + this.pagePlaylistId;

        // console.log( 'PLAYLIST ID:', this.pagePlaylistId );
        // console.log( 'PLAYLIST API REQUEST:', playlistApiUrl );

        this.playlistDataResponse = this.playlistDataResponse.bind(this);
        this.playlistDataErrorResponse = this.playlistDataErrorResponse.bind(this);

        getRequest( playlistApiUrl, !1, this.playlistDataResponse, this.playlistDataErrorResponse );
    }

    playlistDataResponse(response){

        if( response && response.data ){

            // console.log( 'PLAYLIST DATA:', response.data.playlist_media );
            // console.log( 'MEDIA DATA:', MediaPageStoreData[this.id].mediaId );

            let validPlaylistMedia = false;

            let i = 0;
            while( i < response.data.playlist_media.length ){

                // console.log( MediaPageStoreData[this.id].mediaId, response.data.playlist_media[i].friendly_token );

                if( MediaPageStoreData[this.id].mediaId === response.data.playlist_media[i].friendly_token ){
                    validPlaylistMedia = true;
                    break;
                }

                i += 1;
            }

            if( validPlaylistMedia ){
                this.pagePlaylistData = response.data;
            }
            else{
                this.pagePlaylistId = null;
            }

            this.emit('loaded_viewer_playlist_data');
        }
        else{
            // @todo: ......
            this.pagePlaylistId = null;
        }

        this.emit('loaded_page_playlist_data');
        // this.loadData();
    }

    playlistDataErrorResponse(response){
        this.emit('loaded_viewer_playlist_error');
        this.emit('loaded_page_playlist_data');
        // this.loadData();
    }

    loadComments(){
        this.commentsAPIUrl = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/comments';
        this.commentsResponse = this.commentsResponse.bind(this);
        getRequest( this.commentsAPIUrl, !1, this.commentsResponse );
    }

    loadPlaylists(){

        if( ! this.mediacms_config.member.can.saveMedia ){
            return;
        }

        this.playlistsAPIUrl = this.mediacms_config.api.user.playlists + this.mediacms_config.member.username;

        this.playlistsResponse = this.playlistsResponse.bind(this);

        getRequest( this.playlistsAPIUrl, !1, this.playlistsResponse );
    }

    dataResponse(response){

        if( response && response.data ){

            //@ todo: Filter data values.
            MediaPageStoreData[this.id].data = response.data;

            /* ################################################## */
            /* ################################################## */

            /*const dataKeys = Object.keys( response.data );
            const exlcudeKeys = ['duration', 'media_type', 'original_media_url', 'url', 'title', 'description', 'size', 'user', 'user_featured', 'author_name', 'author_profile', 'author_thumbnail', 'thumbnail_url', 'poster_url', 'preview_url', 'add_date', 'edit_date', 'related_media', 'enable_comments', 'allow_download', 'state', 'reported_times', 'is_reviewed', 'views', 'likes', 'dislikes', 'edit_url', 'add_subtitle_url', 'subtitles_info', 'video_height', 'sprites_url', 'thumbnail_time', 'encoding_status', 'encodings_info', 'hls_info', 'ratings_info', 'summary', 'website', 'company', 'license', 'license_info', 'tags_info', 'categories_info', 'topics_info', 'media_country_info', 'media_language_info' ];
            const pendingKeys = [];

            const taxonomyKeys = [];

            let i = 0;
            while( i < dataKeys.length ){

                if( -1 < taxonomyKeys.indexOf( dataKeys[i] ) ){
                    exlcudeKeys.push( dataKeys[i] );
                }

                if( -1 === exlcudeKeys.indexOf( dataKeys[i] ) ){
                    pendingKeys.push( dataKeys[i] );
                }

                i += 1;
            }

            i = 0;
            while( i < pendingKeys.length ){
                console.log( i + 1, pendingKeys[i], response.data[pendingKeys[i]] );
                i += 1;
            }

            const mediaArgs = [ MediaPageStoreData[this.id].mediaId, response.data.original_media_url, response.data.title, response.data.description, response.data.size ];

            switch( response.data.media_type ){
                case 'video':
                    this._MEDIA = new MediaCMSModels.VideoMedia( ...mediaArgs, response.data.duration, response.data.video_height );
                    this._MEDIA.setLinks({ page: response.data.url, editPage: response.data.edit_url, editSubtitlePage: response.data.add_subtitle_url });
                    this._MEDIA.setImages( new MediaCMSModels.VideoMediaImages( response.data.thumbnail_url, response.data.poster_url, response.data.preview_url ) );
                    this._MEDIA.setState({ visibility: response.data.state, reports: response.data.reported_times, reviewed: response.data.is_reviewed, encoding: response.data.encoding_status });
                    this._MEDIA.setSubtitles( response.data.subtitles_info.map( subtitle => new MediaCMSModels.Subtitle( subtitle.src, subtitle.srclang, subtitle.label ) ) );
                    this._MEDIA.setSprites( new MediaCMSModels.VideoMediaSprites( response.data.sprites_url, response.data.thumbnail_time ) );
                    this._MEDIA.setEncodings(
                        (() => {

                            let encondings = [];

                            for (const resolution in response.data.encodings_info) {

                                for (const compression in response.data.encodings_info[resolution] ) {

                                    encondings.push( new MediaCMSModels.Encoding(
                                        response.data.encodings_info[resolution][ compression ].encoding_id,
                                        response.data.encodings_info[resolution][ compression ].progress,
                                        response.data.encodings_info[resolution][ compression ].status,
                                        response.data.encodings_info[resolution][ compression ].url,
                                        response.data.encodings_info[resolution][ compression ].size,
                                        parseInt( resolution, 10 ),
                                        compression
                                    ));
                                }
                            }

                            return encondings;
                        })()
                    );
                    this._MEDIA.setHls( ...(() => {

                        let master;
                        let hlsSources = [];

                        let tmp = {};
                        let key;

                        for (key in response.data.hls_info) {

                            if( 'master_file' === key ){
                                master = response.data.hls_info[key];
                            }
                            else{
                                const t = key.split('_');
                                tmp[t[0]] = tmp[t[0]] || {};
                                tmp[t[0]][t[1]] = response.data.hls_info[key];
                            }
                        }

                        for (key in tmp) {
                            hlsSources.push( new MediaCMSModels.HlsSource( parseInt( key, 10 ), tmp[key].iframe, tmp[key].playlist ) );
                        }

                        return [ master, hlsSources ];
                    })() );
                    this._MEDIA.setRatings( response.data.ratings_info.map( rating => new MediaCMSModels.Rating( rating.category_id, rating.category_title, rating.score ) ) );
                    break;
                case 'audio':
                    this._MEDIA = new MediaCMSModels.AudioMedia( ...mediaArgs, response.data.duration );
                    this._MEDIA.setLinks({ page: response.data.url, editPage: response.data.edit_url });
                    this._MEDIA.setImages( new MediaCMSModels.MediaImages( response.data.thumbnail_url, response.data.poster_url ) );
                    this._MEDIA.setState({ visibility: response.data.state, reports: response.data.reported_times, reviewed: response.data.is_reviewed });
                    break;
                case 'image':
                    this._MEDIA = new MediaCMSModels.ImageMedia( ...mediaArgs );
                    this._MEDIA.setLinks({ page: response.data.url, editPage: response.data.edit_url });
                    this._MEDIA.setImages( new MediaCMSModels.MediaImages( response.data.thumbnail_url, response.data.poster_url ) );
                    this._MEDIA.setState({ visibility: response.data.state, reports: response.data.reported_times, reviewed: response.data.is_reviewed });
                    break;
                case 'pdf':
                    this._MEDIA = new MediaCMSModels.PdfMedia( ...mediaArgs );
                    this._MEDIA.setLinks({ page: response.data.url, editPage: response.data.edit_url });
                    this._MEDIA.setImages( new MediaCMSModels.MediaImages( response.data.thumbnail_url, response.data.poster_url ) );
                    this._MEDIA.setState({ visibility: response.data.state, reports: response.data.reported_times, reviewed: response.data.is_reviewed });
                    break;
            }

            const mediaMeta = {};

            if( void 0 !== response.data.summary && response.data.summary ){
                mediaMeta.summary = response.data.summary;
            }

            if( void 0 !== response.data.company && response.data.company ){
                mediaMeta.company = response.data.company;
            }

            if( void 0 !== response.data.website && response.data.website ){
                mediaMeta.website = response.data.website;
            }

            if( void 0 !== response.data.license_info && response.data.license_info && Object.keys( response.data.license_info ).length ){
                mediaMeta.license = new MediaCMSModels.License(
                    void 0 !== response.data.license_info.title ? response.data.license_info.title : void 0,
                    void 0 !== response.data.license_info.url ? response.data.license_info.url : void 0,
                    void 0 !== response.data.license_info.thumbnail ? response.data.license_info.thumbnail : void 0
                );
            }
            else if( void 0 !== response.data.license && response.data.license){
                mediaMeta.license = new MediaCMSModels.License( response.data.license );
            }

            if( Object.keys( mediaMeta ).length ){
                this._MEDIA.setMeta( mediaMeta );
            }

            const taxonomies = [];

            if( void 0 !== response.data.tags_info && response.data.tags_info && response.data.tags_info.length ){
                taxonomies.push( new MediaCMSModels.MediaTaxonomy( new MediaCMSModels.Taxonomy( 'tag' ), response.data.tags_info.map( item => new MediaCMSModels.TaxonomyItem( item.title, item.url ) ) ) );
            }

            if( void 0 !== response.data.categories_info && response.data.categories_info && response.data.categories_info.length ){
                taxonomies.push( new MediaCMSModels.MediaTaxonomy( new MediaCMSModels.Taxonomy( 'category' ), response.data.categories_info.map( item => new MediaCMSModels.TaxonomyItem( item.title, item.url ) ) ) );
            }

            if( void 0 !== response.data.topics_info && response.data.topics_info && response.data.topics_info.length ){
                taxonomies.push( new MediaCMSModels.MediaTaxonomy( new MediaCMSModels.Taxonomy( 'topic' ), response.data.topics_info.map( item => new MediaCMSModels.TaxonomyItem( item.title, item.url ) ) ) );
            }

            if( void 0 !== response.data.media_language_info && response.data.media_language_info && response.data.media_language_info.length ){
                taxonomies.push( new MediaCMSModels.MediaTaxonomy( new MediaCMSModels.Taxonomy( 'language' ), response.data.media_language_info.map( item => new MediaCMSModels.TaxonomyItem( item.title, item.url ) ) ) );
            }

            if( void 0 !== response.data.media_country_info && response.data.media_country_info && response.data.media_country_info.length ){
                taxonomies.push( new MediaCMSModels.MediaTaxonomy( new MediaCMSModels.Taxonomy( 'country' ), response.data.media_country_info.map( item => new MediaCMSModels.TaxonomyItem( item.title, item.url ) ) ) );
            }

            if( Object.keys( taxonomies ).length ){
                this._MEDIA.setTaxonomies( taxonomies );
            }

            this._MEDIA.setAuthor( new MediaCMSModels.MediaAuthor( response.data.user, response.data.user_featured, response.data.author_name, response.data.author_profile, response.data.author_thumbnail ) );
            this._MEDIA.setDates( new MediaCMSModels.MediaDates( response.data.add_date, response.data.edit_date ) );

            this._MEDIA.setRelated(
                response.data.related_media.map(
                    related => {

                        let ins;

                        switch( related.media_type ){
                            case 'video':
                                ins = new MediaCMSModels.RelatedVideo( related.friendly_token, related.url, related.title );
                                break;
                            case 'audio':
                                ins = new MediaCMSModels.RelatedAudio( related.friendly_token, related.url, related.title );
                                break;
                            case 'image':
                                ins = new MediaCMSModels.RelatedImage( related.friendly_token, related.url, related.title );
                                break;
                            case 'pdf':
                                ins = new MediaCMSModels.RelatedPdf( related.friendly_token, related.url, related.title );
                                break;
                        }

                        ins.setAuthor( new MediaCMSModels.RelatedAuthor( related.author_name, related.author_profile, related.author_thumbnail ) );

                        return ins;
                    }
                )
            );

            this._MEDIA.setAllowedActions( { download: response.data.allow_download, comment: response.data.enable_comments } );

            this._MEDIA.setStatistics({ views: response.data.views, likes: response.data.likes, dislikes: response.data.dislikes });

            // console.log( response.data );
            console.log( this._MEDIA );*/

            /* ################################################## */
            /* ################################################## */

            MediaPageStoreData[this.id].reported_times = !! MediaPageStoreData[this.id].data.reported_times;

            switch( this.get('media-type') ){
                case 'video':
                case 'audio':
                case 'image':
                    this.emit('loaded_' + this.get('media-type') + '_data');
                    break;
            }

            this.emit('loaded_media_data');
        }
        else{
            // @todo: ......
        }

        // this.loadPlaylistData();

        this.loadPlaylists();

        if( this.mediacms_config.member.can.readComment ){
            this.loadComments();
        }
    }

    dataErrorResponse(response){
        if( void 0 !== response.type ){
            switch( response.type ){
                case "network":
                case "private":
                case "unavailable":
                    MediaPageStoreData[this.id].loadErrorType = response.type;
                    MediaPageStoreData[this.id].loadErrorMessage = void 0 !== response.message ? response.message : "Αn error occurred while loading the media's data";
                    this.emit('loaded_media_error');
                    break;
            }
        }
    }

    commentsResponse(response){
        if( response && response.data ){
            MediaPageStoreData[this.id].comments = response.data.count ? response.data.results : [];
            this.emit('comments_load');
        }
        else{
            // @todo: ......
        }
    }

    playlistsResponse(response){

        if( response && response.data ){

            let tmp_playlists = response.data.count ? response.data.results : [];

            MediaPageStoreData[this.id].playlists = [];

            let i = 0;
            let cntr = 0;

            while( i < tmp_playlists.length ){

                ((function(pos){

                    let _this = this;

                    if( tmp_playlists[pos].user === this.mediacms_config.member.username ){

                        let playlistsIndex = MediaPageStoreData[ _this.id ].playlists.length;

                        MediaPageStoreData[ _this.id ].playlists[ playlistsIndex ] = {
                            playlist_id: (function(_url_){
                                let ret = _url_.split("/");
                                return 1 <  ret.length ? ret[ ret.length - 1 ] : null;
                            })( tmp_playlists[pos].url ),
                            title: tmp_playlists[pos].title,
                            description: tmp_playlists[pos].description,
                            // url: tmp_playlists[pos].url,
                            // api_url: tmp_playlists[pos].api_url,
                            add_date: tmp_playlists[pos].add_date,
                            // media_count: tmp_playlists[pos].media_count,
                        };

                        getRequest( this.mediacms_config.site.url + '/' + tmp_playlists[pos].api_url.replace(/^\//g, ''), !1, function(resp){

                            if( !! resp && !! resp.data ){

                                MediaPageStoreData[_this.id].playlists[playlistsIndex].media_list = [];

                                let f = 0;
                                let arr;

                                while( f < resp.data.playlist_media.length ){
                                    arr = resp.data.playlist_media[f].url.split("m=");
                                    if( 2 === arr.length ){
                                        MediaPageStoreData[_this.id].playlists[playlistsIndex].media_list.push( arr[1] );
                                    }
                                    f += 1;
                                }

                            }
                            else{
                                // @todo: ......
                            }

                            cntr += 1;

                            if( cntr === tmp_playlists.length ){
                                this.emit('playlists_load');
                            }
                        });

                    }

                }).bind(this))(i);

                i += 1;
            }

            // console.log( MediaPageStoreData[this.id].playlists );
        }
        else{
            // @todo: ......
        }
    }

    requestMediaLike(){

        if( ! MediaPageStoreData[this.id].mediaId ){
            console.warn( "Invalid media id:", MediaPageStoreData[this.id].mediaId );
            return false;
        }

        const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';

        this.likeActionResponse = this.likeActionResponse.bind(this);

        postRequest( url, {
            type: 'like',
            // `headers` are custom headers to be sent
        }, {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }, false, this.likeActionResponse, ( function(){

            this.emit("liked_media_failed_request");

        }).bind(this) );
    }

    likeActionResponse(response){

        if( response ){

            if( response instanceof Error ){
                // console.error( response );
            }
            else if( response.data ){

                MediaPageStoreData[this.id].likedMedia = true;
                this.emit("liked_media");

                /*MediaPageStoreData[this.id].likedMedia = true;
                MediaPageStoreData[this.id].dislikedMedia = false;
                this.emit("liked_media");*/

            }
            else{
                // @todo: ......
            }
        }
        else{
            // @todo: ......
        }
    }

    requestMediaDislike(){

        if( ! MediaPageStoreData[this.id].mediaId ){
            console.warn( "Invalid media id:", MediaPageStoreData[this.id].mediaId );
            return false;
        }

        const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';
        this.dislikeActionResponse = this.dislikeActionResponse.bind(this);
        postRequest( url, {
            type: 'dislike'
        }, {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }, false, this.dislikeActionResponse, ( function(){

            this.emit("disliked_media_failed_request");

        }).bind(this) );
    }

    dislikeActionResponse(response){

        // console.warn( response );

        if( response ){

            if( response instanceof Error ){
                // console.error( response );
            }
            else if( response.data ){

                MediaPageStoreData[this.id].dislikedMedia = true;
                this.emit("disliked_media");

                /*MediaPageStoreData[this.id].dislikedMedia = true;
                MediaPageStoreData[this.id].likedMedia = false;
                this.emit("disliked_media");*/

            }
            else{
                // @todo: ......
            }
        }

        else{
            // @todo: ......
        }
    }

    requestMediaReport( descr ){

        if( ! MediaPageStoreData[this.id].mediaId ){
            console.warn( "Invalid media id:", MediaPageStoreData[this.id].mediaId );
            return false;
        }

        const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';
        this.reportActionResponse = this.reportActionResponse.bind(this);
        postRequest( url, {
            type: 'report',
            extra_info: descr
        }, {
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }, false, this.reportActionResponse, this.reportActionResponse );
    }

    reportActionResponse(response){

        if( response ){

            if( response instanceof Error ){
                // console.error( response );
            }
            else if( response.data ){

                MediaPageStoreData[this.id].reported_times += 1;
                this.emit("reported_media");

            }
            else{
                // @todo: ......
            }
        }

        else{
            // @todo: ......
        }
    }

    set(type, value){
        switch( type ){
            case 'media-load-error-type':
                MediaPageStoreData[this.id].loadErrorType = value;
                break;
            case 'media-load-error-message':
                MediaPageStoreData[this.id].loadErrorMessage = value;
                break;
        }
    }

    get(type){
        let tmp, activeItem, browserCache, i, r = null;
        switch(type){
            case 'playlists':
                r = MediaPageStoreData[this.id].playlists || [];
                break;
            case 'media-load-error-type':
                r = void 0 !== MediaPageStoreData[this.id].loadErrorType ? MediaPageStoreData[this.id].loadErrorType : null;
                break;
            case 'media-load-error-message':
                r = void 0 !== MediaPageStoreData[this.id].loadErrorMessage ? MediaPageStoreData[this.id].loadErrorMessage : null;
                break;
            case 'media-comments':
                r = MediaPageStoreData[this.id].comments || [];
                break;
            case 'media-data':
                r = MediaPageStoreData[this.id].data || null;
                break;
            case 'media-id':
                r = MediaPageStoreData[this.id].mediaId;
                break;
            case 'media-url':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.url ? MediaPageStoreData[this.id].data.url : 'N/A';
                break;
            case 'media-edit-subtitle-url':
                r = void 0 !== MediaPageStoreData[this.id].data && 'string' === typeof MediaPageStoreData[this.id].data.add_subtitle_url ? MediaPageStoreData[this.id].data.add_subtitle_url : null;
                break;
            case 'media-likes':
                tmp = MediaPageStoreData[this.id].likedMedia ? 1 : 0;
                if( tmp ){
                    r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.likes ? MediaPageStoreData[this.id].data.likes + tmp : tmp;
                }
                else{
                    r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.likes ? MediaPageStoreData[this.id].data.likes : 'N/A';
                }
                break;
            case 'media-dislikes':
                tmp = MediaPageStoreData[this.id].dislikedMedia ? 1 : 0;
                if( tmp ){
                    r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.dislikes ? MediaPageStoreData[this.id].data.dislikes + tmp : tmp;
                }
                else{
                    r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.dislikes ? MediaPageStoreData[this.id].data.dislikes : 'N/A';
                }
                break;
            case 'media-summary':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.summary ? MediaPageStoreData[this.id].data.summary : null;
                break;
            case 'media-production-company':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.company && null !== MediaPageStoreData[this.id].data.company ? MediaPageStoreData[this.id].data.company.trim() : null;
                break;
            case 'media-website':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.website && null !== MediaPageStoreData[this.id].data.website ? MediaPageStoreData[this.id].data.website.trim() : null;
                break;
            case 'display-media-license-info':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.license_info;
                break;
            case 'media-license-info':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.license_info && Object.keys( MediaPageStoreData[this.id].data.license_info ).length ? MediaPageStoreData[this.id].data.license_info : null;
                break;
            case 'media-countries':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.media_country_info ? MediaPageStoreData[this.id].data.media_country_info : [];
                break;
            case 'media-languages':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.media_language_info ? MediaPageStoreData[this.id].data.media_language_info : [];
                break;
            case 'media-categories':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.categories_info ? MediaPageStoreData[this.id].data.categories_info : [];
                break;
            case 'media-topics':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.topics_info ? MediaPageStoreData[this.id].data.topics_info : [];
                break;
            case 'media-tags':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.tags_info ? MediaPageStoreData[this.id].data.tags_info : [];
                break;
            case 'media-type':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.media_type ? MediaPageStoreData[this.id].data.media_type : null;
                break;
            case 'media-original-url':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.original_media_url ? MediaPageStoreData[this.id].data.original_media_url : null;
                break;
            case 'media-thumbnail-url':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.thumbnail_url ? MediaPageStoreData[this.id].data.thumbnail_url : null;
                break;
            case 'user-liked-media':
                r = MediaPageStoreData[this.id].likedMedia;
                break;
            case 'user-disliked-media':
                r = MediaPageStoreData[this.id].dislikedMedia;
                break;
            case 'media-author-thumbnail-url':
                r = void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.author_thumbnail ? this.mediacms_config.site.url + '/' + MediaPageStoreData[this.id].data.author_thumbnail.replace(/^\//g, '') : null;
                break;
            case 'playlist-data':
                r = this.pagePlaylistData;
                break;
            case 'playlist-id':
                r = this.pagePlaylistId;
                break;
            case 'playlist-next-media-url':

                if( ! this.pagePlaylistData ){
                    break;
                }

                activeItem = 0;
                i = 0;
                while( i < this.pagePlaylistData.playlist_media.length ){

                    if( MediaPageStoreData[this.id].mediaId === this.pagePlaylistData.playlist_media[i].friendly_token ){
                        activeItem = i + 1;
                        break;
                    }

                    i += 1;
                }

                if( activeItem === this.pagePlaylistData.playlist_media.length ){

                    browserCache = PageStore.get('browser-cache');

                    if( true === browserCache.get('loopPlaylist[' + this.pagePlaylistId + ']') ){
                        activeItem = 0;
                    }
                }

                // console.log('ACTIVE (next)', activeItem);

                if( void 0 !== this.pagePlaylistData.playlist_media[activeItem] ){
                    r = this.pagePlaylistData.playlist_media[activeItem].url + '&pl=' + this.pagePlaylistId;
                }

                break;
            case 'playlist-previous-media-url':

                if( ! this.pagePlaylistData ){
                    break;
                }

                activeItem = 0;
                i = 0;
                while( i < this.pagePlaylistData.playlist_media.length ){

                    if( MediaPageStoreData[this.id].mediaId === this.pagePlaylistData.playlist_media[i].friendly_token ){
                        activeItem = i;
                        break;
                    }

                    i += 1;
                }

                if( 0 === activeItem ){

                    activeItem = this.pagePlaylistData.playlist_media.length;

                    browserCache = PageStore.get('browser-cache');

                    if( true === browserCache.get('loopPlaylist[' + this.pagePlaylistId + ']') ){
                        activeItem = activeItem - 1;
                    }
                }
                else{
                    activeItem = activeItem - 1;
                }

                if( void 0 !== this.pagePlaylistData.playlist_media[activeItem] ){
                    r = this.pagePlaylistData.playlist_media[activeItem].url + '&pl=' + this.pagePlaylistId;
                }

                break;
        }
        return r;
    }

    isVideo(){
        return 'video' === this.get('media-type');
    }

    onPlaylistCreationCompleted(response){
        if( response && response.data ){
            this.emit( "playlist_creation_completed", response.data );
        }
        else{
            // @todo
        }
    }

    onPlaylistCreationFailed(){
        this.emit( "playlist_creation_failed" );
    }

    onPlaylistMediaAdditionCompleted( playlist_id, response ){
        if( response ){
            let i = 0;
            while( i < MediaPageStoreData[this.id].playlists.length ){
                if( playlist_id === MediaPageStoreData[this.id].playlists[i].playlist_id ){
                    MediaPageStoreData[this.id].playlists[i].media_list.push( MediaPageStoreData[this.id].mediaId );
                    break;
                }
                i += 1;
            }
            this.emit( "media_playlist_addition_completed", playlist_id );
        }
        else{
            // @todo
        }
    }

    onPlaylistMediaAdditionFailed( playlist_id, response ){
        this.emit( "media_playlist_addition_failed" );
    }

    onPlaylistMediaRemovalCompleted( playlist_id, response ){
        if( response ){
            let j, new_playlist_media;
            let i = 0;
            while( i < MediaPageStoreData[this.id].playlists.length ){
                if( playlist_id === MediaPageStoreData[this.id].playlists[i].playlist_id ){

                    new_playlist_media = [];
                    j = 0;
                    while( j < MediaPageStoreData[this.id].playlists[i].media_list.length ){
                        if( MediaPageStoreData[this.id].mediaId !== MediaPageStoreData[this.id].playlists[i].media_list[j] ){
                            new_playlist_media.push( MediaPageStoreData[this.id].playlists[i].media_list[j] );
                        }
                        j += 1;
                    }
                    MediaPageStoreData[this.id].playlists[i].media_list = new_playlist_media;

                    break;
                }
                i += 1;
            }
            this.emit( "media_playlist_removal_completed", playlist_id );
        }
        else{
            // @todo
        }
    }

    onPlaylistMediaRemovalFailed( playlist_id, response ){
        this.emit( "media_playlist_removal_failed" );
    }

    actions_handler(action) {
        switch(action.type) {
            case 'LOAD_MEDIA_DATA':
                MediaPageStoreData[this.id].mediaId = window.MediaCMS.mediaId || MediaPageStoreData[this.id].mediaId;

                this.pagePlaylistId = extractPlaylistId();

                if( this.pagePlaylistId ){
                    this.loadPlaylistData();
                    this.loadData();
                }
                else{
                    this.emit('loaded_page_playlist_data');
                    this.loadData();
                }

                break;
            case 'UNLIKE_MEDIA':
                /*if( MediaPageStoreData[this.id].likedMedia ){
                    MediaPageStoreData[this.id].likedMedia = false;
                    this.emit("unliked_media");
                }*/
                // if( ! MediaPageStoreData[this.id].likedMedia ){
                //     this.likeActionResponse();
                // }
                break;
            case 'LIKE_MEDIA':
                if( ! MediaPageStoreData[this.id].likedMedia && ! MediaPageStoreData[this.id].dislikedMedia ){
                    this.requestMediaLike();
                    /*MediaPageStoreData[this.id].likedMedia = true;
                    MediaPageStoreData[this.id].dislikedMedia = false;
                    this.emit("liked_media");*/
                }
                break;
            case 'DISLIKE_MEDIA':
                if( ! MediaPageStoreData[this.id].likedMedia && ! MediaPageStoreData[this.id].dislikedMedia ){
                    this.requestMediaDislike();
                    /*MediaPageStoreData[this.id].dislikedMedia = true;
                    MediaPageStoreData[this.id].likedMedia = false;
                    this.emit("disliked_media");*/
                }
                break;
            case 'UNDISLIKE_MEDIA':
                /*if( MediaPageStoreData[this.id].dislikedMedia ){
                    MediaPageStoreData[this.id].dislikedMedia = false;
                    this.emit("undisliked_media");
                }*/
                // if( ! MediaPageStoreData[this.id].dislikedMedia ){
                //     this.dislikeActionResponse();
                // }
                break;
            case 'REPORT_MEDIA':
                if( ! MediaPageStoreData[this.id].reported_times ){
                    if( "" !== action.reportDescription ){
                        this.requestMediaReport( action.reportDescription );
                    }
                }
                break;
            case 'COPY_SHARE_LINK':
                if( action.inputElement instanceof HTMLElement ){
                    action.inputElement.select();
                    document.execCommand('copy');
                    this.emit("copied_media_link");
                }
                break;
            case 'COPY_EMBED_MEDIA_CODE':
                if( action.inputElement instanceof HTMLElement ){
                    action.inputElement.select();
                    document.execCommand('copy');
                    this.emit("copied_embed_media_code");
                }
                break;
            case 'REMOVE_MEDIA':
                if( MediaPageStoreData[this.id].while.deleteMedia ){
                    return;
                }
                MediaPageStoreData[this.id].while.deleteMedia = true;
                deleteRequest( this.mediaAPIUrl, { headers: { 'X-CSRFToken': getCSRFToken() } }, false, this.removeMediaResponse, this.removeMediaFail );
                break;
            case 'SUBMIT_COMMENT':

                if( MediaPageStoreData[this.id].while.submitComment ){
                    return;
                }

                MediaPageStoreData[this.id].while.submitComment = true;

                /*const A = JSON.parse( JSON.stringify( MediaPageStoreData[this.id].comments[0] ) );
                A.uid += '.' + (new Date).toTimeString() ;
                A.text = action.commentText;
                MediaPageStoreData[this.id].comments.push( A );
                this.emit('comment_submit');
                setTimeout(function(ins){
                    MediaPageStoreData[ins.id].while.submitComment = false;
                }, 100, this);*/

                postRequest( this.commentsAPIUrl, { text: action.commentText }, { headers: { 'X-CSRFToken': getCSRFToken() } }, false, this.submitCommentResponse, this.submitCommentFail );
                break;
            case 'DELETE_COMMENT':
                if( null !== MediaPageStoreData[this.id].while.deleteCommentId ){
                    return;
                }
                /*let k;
                let newComments = [];
                for(k in MediaPageStoreData[this.id].comments){
                    if( MediaPageStoreData[this.id].comments.hasOwnProperty(k) ){
                        if( action.commentId !== MediaPageStoreData[this.id].comments[k].uid ){
                            newComments.push( MediaPageStoreData[this.id].comments[k] );
                        }
                    }
                }
                MediaPageStoreData[this.id].comments = newComments;
                newComments = null;
                this.emit('comment_delete', action.commentId);*/
                MediaPageStoreData[this.id].while.deleteCommentId = action.commentId;
                deleteRequest( this.commentsAPIUrl + "/" + action.commentId, { headers: { 'X-CSRFToken': getCSRFToken() } }, false, this.removeCommentResponse, this.removeCommentFail );
                break;
            case 'CREATE_PLAYLIST':

                postRequest(
                    this.mediacms_config.api.playlists,
                    {
                        title: action.playlist_data.title,
                        description: action.playlist_data.description,
                    },
                    {
                        headers: {
                            'X-CSRFToken': getCSRFToken(),
                        }
                    },
                    false,
                    this.onPlaylistCreationCompleted.bind(this),
                    this.onPlaylistCreationFailed.bind(this)
                );
                break;
            case 'ADD_MEDIA_TO_PLAYLIST':
                putRequest(
                    this.mediacms_config.api.playlists + '/' + action.playlist_id,
                    {
                        type: 'add',
                        media_friendly_token: action.media_id,
                    },
                    {
                        headers: {
                            'X-CSRFToken': getCSRFToken(),
                        }
                    },
                    false,
                    this.onPlaylistMediaAdditionCompleted.bind(this, action.playlist_id),
                    this.onPlaylistMediaAdditionFailed.bind(this, action.playlist_id)
                );
                break;
            case 'REMOVE_MEDIA_FROM_PLAYLIST':
                putRequest(
                    this.mediacms_config.api.playlists + '/' + action.playlist_id,
                    {
                        type: 'remove',
                        media_friendly_token: action.media_id,
                    },
                    {
                        headers: {
                            'X-CSRFToken': getCSRFToken(),
                        }
                    },
                    false,
                    this.onPlaylistMediaRemovalCompleted.bind(this, action.playlist_id),
                    this.onPlaylistMediaRemovalFailed.bind(this, action.playlist_id)
                );
                break;
            case 'APPEND_NEW_PLAYLIST':
                MediaPageStoreData[this.id].playlists.push( action.playlist_data );
                this.emit('playlists_load');
                break;
        }
    }

    removeMediaResponse(response){
        if( response && 204 === response.status ){
            this.emit('media_delete', MediaPageStoreData[this.id].mediaId);
        }
    }

    removeMediaFail(){
        this.emit('media_delete_fail', MediaPageStoreData[this.id].mediaId);
        setTimeout(function(ins){
            MediaPageStoreData[ins.id].while.deleteMedia = null;
        }, 100, this);
    }

    removeCommentFail(err){
        this.emit('comment_delete_fail', MediaPageStoreData[this.id].while.deleteCommentId);
        setTimeout(function(ins){
            MediaPageStoreData[ins.id].while.deleteCommentId = null;
        }, 100, this);
    }

    removeCommentResponse(response){

        if( response && 204 === response.status ){

            let k;
            let newComments = [];
            for(k in MediaPageStoreData[this.id].comments){
                if( MediaPageStoreData[this.id].comments.hasOwnProperty(k) ){
                    if( MediaPageStoreData[this.id].while.deleteCommentId !== MediaPageStoreData[this.id].comments[k].uid ){
                        newComments.push( MediaPageStoreData[this.id].comments[k] );
                    }
                }
            }
            MediaPageStoreData[this.id].comments = newComments;
            newComments = null;

            this.emit('comment_delete', MediaPageStoreData[this.id].while.deleteCommentId);
        }
        setTimeout(function(ins){
            MediaPageStoreData[ins.id].while.deleteCommentId = null;
        }, 100, this);
    }

    submitCommentFail(err){
        this.emit('comment_submit_fail');
        setTimeout(function(ins){
            MediaPageStoreData[ins.id].while.submitComment = false;
        }, 100, this);
    }

    submitCommentResponse(response){
        if( response && 201 === response.status && response.data && Object.keys( response.data ) ){
            MediaPageStoreData[this.id].comments.push( response.data );
            this.emit('comment_submit', response.data.uid);
        }
        setTimeout(function(ins){
            MediaPageStoreData[ins.id].while.submitComment = false;
        }, 100, this);
    }
}

export default exportStore( new MediaPageStore, 'actions_handler' );
