import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { usePopup } from '../hooks/usePopup';

import { PopupMain } from '../Popup';
import { PendingItemsList } from '../PendingItemsList';

import getCSRFToken from '../../../functions/getCSRFToken';
import deleteRequest from '../../../functions/deleteRequest';
import { PositiveInteger } from '../../../functions/propTypeFilters';

import urlParse from 'url-parse';

import { renderManageItems } from './includes/functions';
import initManageItemsList from './includes/initManageItemsList';
import { ManageItemsListHandler } from "./includes/ManageItemsListHandler";

import "../../styles/ManageItemList.scss";

function useManageItemList( props, itemsListRef ){

    let previousItemsLength = 0;

    let itemsListInstance = null;

    const [ items, setItems ] = useState([]);

    const [ countedItems, setCountedItems ] = useState(false);
    const [ listHandler, setListHandler ] = useState(null);

    function onItemsLoad(itemsArray){
        setItems([...itemsArray]);
    }

    function onItemsCount(totalItems){
        setCountedItems(true);
        if (void 0 !== props.itemsCountCallback) {
            props.itemsCountCallback(totalItems);
        }
    }

    function addListItems(){

        if ( previousItemsLength < items.length) {

            if (null === itemsListInstance) {
                itemsListInstance = initManageItemsList([itemsListRef.current])[0];
            }

            // TODO: Should get item elements from children components.
            const itemsElem = itemsListRef.current.querySelectorAll('.item');

            if( ! itemsElem || ! itemsElem.length ){
                return;
            }

            let i = previousItemsLength;

            while (i < items.length) {
                itemsListInstance.appendItems(itemsElem[i]);
                i += 1;
            }

            previousItemsLength = items.length;
        }
    }

    useEffect(() => {
        if (void 0 !== props.itemsLoadCallback) {
            props.itemsLoadCallback();
        }
    }, [items]);

    return [ items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems ];
}

function useManageItemListSync( props ){

    const itemsListRef = useRef(null);
    const itemsListWrapperRef = useRef(null);

    const [ items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems ] = useManageItemList( {...props, itemsCountCallback}, itemsListRef );

    const [ totalItems, setTotalItems ] = useState(null);

    let classname = {
        list: 'manage-items-list',
        listOuter: 'items-list-outer' + ('string' === typeof props.className ? ' ' + props.className.trim() : '' )
    };

    function onClickLoadMore(){
        listHandler.loadItems();
    }

    function itemsCountCallback(itemsSumm){
    	setTotalItems(itemsSumm);
    }

    function afterItemsLoad(){}

    function renderBeforeListWrap() {
        return null;
    }

    function renderAfterListWrap() {

        if( ! listHandler ){
            return null;
        }

        return 1 > listHandler.totalPages() || listHandler.loadedAllItems() ? null : <button className="load-more" onClick={ onClickLoadMore }>SHOW MORE</button>;
    }

    useEffect(() => {
        addListItems();
        afterItemsLoad();
    }, [items]);

    return [ countedItems, totalItems, items, listHandler, setListHandler, classname, itemsListWrapperRef, itemsListRef, onItemsCount, onItemsLoad, renderBeforeListWrap, renderAfterListWrap ];
}

function pageUrlQuery( baseQuery, pageNumber ){

    let queryParams = [];
    let pos = 0;

    if( '' !== baseQuery ){

        queryParams = baseQuery.split('?')[1].split('&');

        let param;

        let i = 0;

        while( i < queryParams.length ){

            param = queryParams[i].split('=');

            if( 'page' === param[0] ){
                pos = i;
                break;
            }

            i += 1;
        }
    }

    queryParams[pos] = 'page=' + pageNumber;

    return '?' + queryParams.join('&');
}

function pageUrl( parsedUrl, query ){
    return parsedUrl.set('query', query).href;
}

function BulkActions(props){

    const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();

    const [ selectedBulkAction, setSelectedBulkAction ] = useState('');
    const [ selectedItemsSize, setSelectedItemsSize ] = useState(props.selectedItemsSize);

    function onBulkActionSelect(ev){
        setSelectedBulkAction(ev.currentTarget.value);
    }

    function onClickProceed(){

        if( 'function' === typeof props.onProceedRemoval ){
            props.onProceedRemoval();
        }

        popupContentRef.current.tryToHide();
    }

    function onClickCancel(){
        popupContentRef.current.tryToHide();
    }

    useEffect(()=>{
        setSelectedItemsSize(props.selectedItemsSize);
    }, [props.selectedItemsSize]);

    return  (<div className="manage-items-bulk-action">

                <select value={ selectedBulkAction } onChange={ onBulkActionSelect } >
                    <option value="" >Bulk actions</option>
                    <option value="delete">Delete selected</option>
                </select>

                { ! selectedItemsSize ? null : <PopupTrigger contentRef={ popupContentRef }>
                    <button>Apply</button>
                </PopupTrigger> }

                <PopupContent contentRef={ popupContentRef }>
                    <PopupMain>
                        <div className="popup-message">
                            <span className="popup-message-title">Bulk removal</span>
                            <span className="popup-message-main">You're willing to remove selected items permanently?</span>
                        </div>
                          <hr/>
                        <span className="popup-message-bottom">
                            <button className="button-link cancel-profile-removal" onClick={ onClickCancel }>CANCEL</button>
                            <button className="button-link proceed-profile-removal" onClick={ onClickProceed }>PROCEED</button>
                        </span>
                    </PopupMain>
                </PopupContent>

            </div>);
}

function ManageItemsOptions(props){
    return ( <div className={props.className}>
                <BulkActions selectedItemsSize={props.items.length} onProceedRemoval={props.onProceedRemoval} />
                { 1 === props.pagesSize ? null :
                    <div className="manage-items-pagination">
                        <PaginationButtons totalItems={props.totalItems} pageItems={props.pageItems} onPageButtonClick={props.onPageButtonClick} query={props.query} />
                    </div>
                }
            </div>);
}

function PaginationButtons(props){

    const buttons = [];

    let i;

    let maxPagin = 11;

    const newPagesNumber = {
    	last: Math.ceil( props.totalItems / props.pageItems ),
    	current: 1,
    };

    if( '' !== props.query ){

        const queryParams = props.query.split('?')[1].split('&');

        let param;

        let i = 0;
        while( i < queryParams.length ){
            param = queryParams[i].split('=');
            if( 'page' === param[0] ){
                newPagesNumber.current = parseInt( param[1], 10);
                break;
            }
            i += 1;
        }
    }

    const paginButtonsData = paginationButtonsList( maxPagin, newPagesNumber );

    i = 0;
    while( i < paginButtonsData.length ){

        if( 'button' === paginButtonsData[i].type ){
            buttons.push(
                <button key={ i +'[button]' } onClick={ props.onPageButtonClick } page={ paginButtonsData[i].number } className={ newPagesNumber.current === paginButtonsData[i].number ? 'active' : '' }>
                    { paginButtonsData[i].number }
                </button> );
        }
        else if( 'dots' === paginButtonsData[i].type ){
            buttons.push( <span key={ i +'[dots]' } className="pagination-dots">...</span> );
        }

        i += 1;
    }

    return buttons;
}

function paginationButtonsList( maxPagin, pagesNumber ){

    if( 3 > maxPagin ){
        maxPagin = 3;
    }

    let i;

    let maxCurr;
    let maxEdge = 1;

    if( maxPagin >= pagesNumber.last ){
        maxPagin = pagesNumber.last;
        maxCurr = pagesNumber.last;
        maxEdge = 0;
    }
    else {

        if( 5 < maxPagin ){

            if( 7 >= maxPagin ){
                maxEdge = 2;
            }
            else{
                maxEdge = Math.floor( maxPagin / 4 );
            }
        }

        maxCurr = maxPagin - ( 2 * maxEdge );
    }

    const currentArr = [];
    const firstArr = [];
    const lastArr = [];

    if( pagesNumber.current <= maxCurr + maxEdge - pagesNumber.current ){

        i = 1;

        while( i <= maxCurr + maxEdge ){
            currentArr.push(i);
            i += 1;
        }

        i = pagesNumber.last - maxPagin + currentArr.length + 1;

        while( i <= pagesNumber.last ){
            lastArr.push(i);
            i += 1;
        }
    }
    else if( pagesNumber.current > pagesNumber.last - ( maxCurr + maxEdge - 1 ) ){

        i = pagesNumber.last - ( maxCurr + maxEdge - 1 );

        while( i <= pagesNumber.last ){
            currentArr.push(i);
            i += 1;
        }

        i = 1;
        while( i <= maxPagin - currentArr.length ){
            firstArr.push(i);
            i += 1;
        }
    }
    else{

        currentArr.push( pagesNumber.current );

        i = 1;
        while( maxCurr > currentArr.length ){

            currentArr.push( pagesNumber.current + i );

            if( ( maxCurr === currentArr.length ) ){
                break;
            }

            currentArr.unshift( pagesNumber.current - i );

            i += 1;
        }

        i = 1;
        while( i <= maxEdge){
            firstArr.push(i);
            i += 1;
        }

        i = pagesNumber.last - ( maxPagin - ( firstArr.length + currentArr.length ) - 1 );
        while( i <= pagesNumber.last){
            lastArr.push(i);
            i += 1;
        }
    }

    const ret = [];

    i = 0;
    while( i < firstArr.length ){
        ret.push({
            type: 'button',
            number: firstArr[i]
        });
        i += 1;
    }

    if( firstArr.length && currentArr.length && ( firstArr[firstArr.length - 1] + 1 ) < currentArr[0] ){
        ret.push({
            type: 'dots'
        });
    }

    i = 0;
    while( i < currentArr.length ){
        ret.push({
            type: 'button',
            number: currentArr[i]
        });
        i += 1;
    }

    if( currentArr.length && lastArr.length && ( currentArr[currentArr.length - 1] + 1 ) < lastArr[0] ){
        ret.push({
            type: 'dots'
        });
    }

    i = 0;
    while( i < lastArr.length ){
        ret.push({
            type: 'button',
            number: lastArr[i]
        });
        i += 1;
    }

    return ret;
}

export function ManageItemList(props){
	props = { maxItems: 99999, pageItems: 24, requestUrl: null, ...props };

	const [
		countedItems,
		totalItems,
		items,
		listHandler,
		setListHandler,
		classname,
		itemsListWrapperRef,
		itemsListRef,
		onItemsCount,
		onItemsLoad,
		renderBeforeListWrap,
		renderAfterListWrap
	] = useManageItemListSync(props);

	const [ selectedItems, setSelectedItems ] = useState([]);
	const [ selectedAllItems, setSelectedAllItems ] = useState(false);

	const [ parsedRequestUrl, setParsedRequestUrl ] = useState(null);
	const [ parsedRequestUrlQuery, setParsedRequestUrlQuery ] = useState(null);

    function onPageButtonClick(ev) {

        const clickedPageUrl = pageUrl( parsedRequestUrl, pageUrlQuery( parsedRequestUrlQuery, ev.currentTarget.getAttribute('page') ) );

        if( 'function' === typeof props.onPageChange ){
            props.onPageChange( clickedPageUrl, ev.currentTarget.getAttribute('page') );
        }
    }

    function onBulkItemsRemoval(){
        deleteSelectedItems();
    }

	function onAllRowsCheck( selectedAllRows, tableType ){

        const newSelected = [];

        if( selectedAllRows ){

            if( items.length !== selectedItems.length ){

                let entry;

                if( 'media' === tableType ){

                    for(entry of items){
                        newSelected.push( entry.friendly_token );
                    }
                }
                else if( 'users' === tableType ){

                    for(entry of items){
                        newSelected.push( entry.username );
                    }
                }
                else if( 'comments' === tableType ){

                    for(entry of items){
                        newSelected.push( entry.uid );
                    }
                }
            }
        }

        setSelectedItems(newSelected);
        setSelectedAllItems(newSelected.length === items.length);
    }

	function onRowCheck( token, isSelected ){

		if( void 0 !== token ){

			let newSelected;

            if( -1 === selectedItems.indexOf( token ) ){

                if( isSelected ){

                    newSelected = [ ...selectedItems, token ];

                    setSelectedItems(newSelected);
                    setSelectedAllItems(newSelected.length === items.length);
                }
            }
            else{

                if( ! isSelected ){

                    newSelected = [];

                    let entry;
                    for(entry of selectedItems){
                        if( token !== entry ){
                            newSelected.push( entry );
                        }
                    }

                    setSelectedItems(newSelected);
                    setSelectedAllItems(newSelected.length === items.length);
                }
            }
        }
	}

    function removeBulkMediaResponse( response ){

        if( response && 204 === response.status ){

        	setSelectedItems([]);
        	setSelectedAllItems(false);

        	if( 'function' === typeof props.onRowsDelete ){
        		props.onRowsDelete( true );
        	}
        }
    }

    function removeBulkMediaFail(){
    	if( 'function' === typeof props.onRowsDeleteFail ){
	        props.onRowsDeleteFail( true );
	    }
    }

	function deleteItem( token, isManageComments ){
		/*console.log("DELETE ITEM:", token, isManageComments, props.manageType);
        console.log( props.requestUrl.split('?')[0] );*/
        deleteRequest(
            props.requestUrl.split('?')[0] + ( 'comments' === props.manageType ? '?comment_ids=' : '?tokens=' ) + token,
            {
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
                tokens: token,
            },
            false,
            removeMediaResponse,
            removeMediaFail
        );
	}

    function deleteSelectedItems(){

        deleteRequest(
            props.requestUrl.split('?')[0] + ( 'comments' === props.manageType ? '?comment_ids=' : '?tokens=' ) + selectedItems.join(','),
            {
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
            },
            false,
            removeBulkMediaResponse,
            removeBulkMediaFail
        );
    }

	function removeMediaResponse(response){
		if( response && 204 === response.status ){
            props.onRowsDelete( false );
        }
	}

	function removeMediaFail(){
		props.onRowsDeleteFail( false );
	}

	useEffect(()=>{
		// console.log('ITEMS:', items);
	}, [items]);

	useEffect(()=>{
		if( parsedRequestUrl ){
			setParsedRequestUrlQuery(parsedRequestUrl.query);
		}
	}, [parsedRequestUrl]);

	useEffect(()=>{
		// console.log( props.requestUrl );
		setParsedRequestUrl(urlParse(props.requestUrl));
    }, [props.requestUrl]);

    useEffect(() => {

    	setListHandler( new ManageItemsListHandler(props.pageItems, props.maxItems, props.requestUrl, onItemsCount, onItemsLoad) );

        return () => {
            if( listHandler ){
                listHandler.cancelAll();
                setListHandler(null);
            }
        };
    }, []);

    return ( ! countedItems ?
            <PendingItemsList className={ classname.listOuter } /> :
            ( ! items.length ? null : <div className={ classname.listOuter }>

                { /*renderBeforeListWrap()*/ }

                <ManageItemsOptions
                	totalItems={totalItems}
                	pageItems={props.pageItems}
                	onPageButtonClick={onPageButtonClick}
                	query={parsedRequestUrlQuery || ''}
                	className='manage-items-options'
                	items={ selectedItems }
                	pagesSize={ listHandler.totalPages() }
                	onProceedRemoval={ onBulkItemsRemoval } />

                <div ref={ itemsListWrapperRef } className="items-list-wrap">
                    <div ref={ itemsListRef } className={ classname.list }>
                    {renderManageItems( items, {
			            ...props,
			            onAllRowsCheck: onAllRowsCheck,
			            onRowCheck: onRowCheck,
			            selectedItems: selectedItems,
			            selectedAllItems: selectedAllItems,
			            onDelete: deleteItem,
			        })}
                    { /*items.map( ( itm, index ) => <ListItem key={ index } { ...listItemProps( props, itm, index ) } /> )*/ }
                    </div>
                </div>

                <ManageItemsOptions
                	totalItems={totalItems}
                	pageItems={props.pageItems}
                	onPageButtonClick={onPageButtonClick}
                	query={parsedRequestUrlQuery || ''}
                	className='manage-items-options popup-on-top'
                	items={ selectedItems }
                	pagesSize={ listHandler.totalPages() }
                	onProceedRemoval={ onBulkItemsRemoval } />

                { /*renderAfterListWrap() */}

            </div> )
           );
}


// export class AsyncManageItemListSync extends React.PureComponent {

// 	constructor(props) {

//         super(props);

//         this.state = {
//             items: [],
//             totalItems: void 0,
//             countedItems: false,
//             date: new Date().getTime(),
//             selectedItems: [],
//             selectedAllItems: false,
//         };

//         this.onItemsLoad = this.onItemsLoad.bind(this);
//         this.onItemsCount = this.onItemsCount.bind(this);

//         this.previousItemsLength = 0;
//         this.itemsListInstance = null;

//         this.listHandler = null;

//         this.classname = {
//             listOuter: 'items-list-outer' + (!!props.className ? ' ' + props.className : ''),
//             list: 'manage-items-list',
//         };

//         this.onRowCheck = this.onRowCheck.bind(this);
//         this.onAllRowsCheck = this.onAllRowsCheck.bind(this);

//         this.deleteItem = this.deleteItem.bind(this);
//         this.deleteSelectedItems = this.deleteSelectedItems.bind(this);

//         this.removeMediaResponse = this.removeMediaResponse.bind(this);
//         this.removeMediaFail = this.removeMediaFail.bind(this);

//         this.removeBulkMediaResponse = this.removeBulkMediaResponse.bind(this);
//         this.removeBulkMediaFail = this.removeBulkMediaFail.bind(this);

//         this.parsedRequestUrl = urlParse( this.props.requestUrl );
//         this.parsedRequestUrlQuery = this.parsedRequestUrl.query;

//         this.pagesNumber = {
//             last: 1,
//             current: 1,
//         };

//         this.onPageButtonClick = this.onPageButtonClick.bind(this);

//         this.onBulkItemsRemoval = this.onBulkItemsRemoval.bind(this);
//     }

//     onBulkItemsRemoval(){
//         this.deleteSelectedItems();
//     }

//     componentDidUpdate(prevProps) {
//         if (prevProps.requestUrl !== this.props.requestUrl) {
//             this.parsedRequestUrl = urlParse( this.props.requestUrl );
//             this.parsedRequestUrlQuery = this.parsedRequestUrl.query;
//         }
//     }

//     componentDidMount() {
//         this.listHandler = new ManageItemsListHandler(this.props.pageItems, this.props.maxItems, this.props.requestUrl, this.onItemsCount, this.onItemsLoad);
//     }

//     onPageButtonClick(ev) {
//         const clickedPageUrl = pageUrl( this.parsedRequestUrl, pageUrlQuery( this.parsedRequestUrlQuery, ev.currentTarget.getAttribute('page') ) );
//         if( 'function' === typeof this.props.onPageChange ){
//             this.props.onPageChange( clickedPageUrl, ev.currentTarget.getAttribute('page') );
//         }
//     }

//     onItemsLoad(items) {
//         this.setState({
//             items: items,
//             date: new Date().getTime(), // @note: Triggers state update.
//         }, function() {
//             this.addListItems();
//         });
//     }

//     addListItems() {

//         if (this.previousItemsLength < this.state.items.length) {

//             if (null === this.itemsListInstance) {
//                 this.itemsListInstance = initManageItemsList([this.refs.ItemsList])[0];
//             }

//             let i = this.previousItemsLength;

//             while (i < this.state.items.length) {
//                 this.itemsListInstance.appendItems(this.refs['item-' + i].refs.item);
//                 i += 1;
//             }

//             this.previousItemsLength = this.state.items.length;
//         }
//     }

//     onItemsCount(totalItems) {
//         this.setState({
//             totalItems: totalItems,
//             countedItems: true,
//         }, function() {
//             if (void 0 !== this.props.itemsCountCallback) {
//                 this.props.itemsCountCallback(totalItems);
//             }
//         });
//     }

//     onAllRowsCheck( selectedAllRows, tableType ){

//         const selectedItems = [];

//         if( selectedAllRows ){

//             if( this.state.items.length !== this.state.selectedItems.length ){

//                 let entry;

//                 if( 'media' === tableType ){

//                     for(entry of this.state.items){
//                         selectedItems.push( entry.friendly_token );
//                     }
//                 }
//                 else if( 'users' === tableType ){

//                     for(entry of this.state.items){
//                         selectedItems.push( entry.username );
//                     }
//                 }
//                 else if( 'comments' === tableType ){

//                     for(entry of this.state.items){
//                         selectedItems.push( entry.uid );
//                     }
//                 }
//             }
//         }

//         this.setState({
//             selectedItems: selectedItems,
//             selectedAllItems : selectedItems.length === this.state.items.length,
//         }, function(){
//             // console.log( "C", this.state.selectedItems );
//         });
//     }

//     onRowCheck( token, isSelected ){

//         if( void 0 !== token ){

//             let selectedItems;

//             if( -1 === this.state.selectedItems.indexOf( token ) ){

//                 if( isSelected ){

//                     selectedItems = [ ...this.state.selectedItems, token ];

//                     this.setState({
//                         selectedItems: selectedItems,
//                         selectedAllItems : selectedItems.length === this.state.items.length,
//                     }, function(){
//                         // console.log( "A", this.state.selectedAllItems );
//                     });
//                 }
//             }
//             else{

//                 if( ! isSelected ){

//                     selectedItems = [];

//                     let entry;
//                     for(entry of this.state.selectedItems){
//                         if( token !== entry ){
//                             selectedItems.push( entry );
//                         }
//                     }

//                     this.setState({
//                         selectedItems: selectedItems,
//                         selectedAllItems : selectedItems.length === this.state.items.length,
//                     }, function(){
//                         // console.log( "B", this.state.selectedAllItems );
//                     });
//                 }
//             }
//         }
//     }

//     deleteItem( token, isManageComments ){

//         /*console.log("DELETE ITEM:", token, isManageComments, this.props.manageType);
//         console.log( this.props.requestUrl.split('?')[0] );*/

//         deleteRequest(
//             this.props.requestUrl.split('?')[0] + ( 'comments' === this.props.manageType ? '?comment_ids=' : '?tokens=' ) + token,
//             {
//                 headers: {
//                     'X-CSRFToken': getCSRFToken(),
//                 },
//                 tokens: token,
//             },
//             false,
//             this.removeMediaResponse,
//             this.removeMediaFail
//         );
//     }

//     deleteSelectedItems( isManageComments ){

//         /*console.log("DELETE SELECTED ITEMS", this.state.selectedItems, this.props.manageType);
//         console.log( this.state.selectedItems.join(',') );*/

//         deleteRequest(
//             this.props.requestUrl.split('?')[0] + ( 'comments' === this.props.manageType ? '?comment_ids=' : '?tokens=' ) + this.state.selectedItems.join(','),
//             {
//                 headers: {
//                     'X-CSRFToken': getCSRFToken(),
//                 }/*,
//                 tokens: this.state.selectedItems.join(','),*/
//             },
//             false,
//             this.removeBulkMediaResponse,
//             this.removeBulkMediaFail
//         );
//     }

//     removeMediaResponse( response ){

//         if( response && 204 === response.status ){
//             // this.emit('media_delete', MediaPageStoreData[this.id].mediaId);
//             this.props.onRowsDelete( false );
//         }
//     }

//     removeMediaFail(){
//         this.props.onRowsDeleteFail( false );
//     }

//     removeBulkMediaResponse( response ){

//         if( response && 204 === response.status ){

//             this.setState({
//                 selectedItems: [],
//                 selectedAllItems : 0,
//             }, function(){
//                 this.props.onRowsDelete( true );
//                 // console.log( "C", this.state.selectedItems );
//             });
//         }
//     }

//     removeBulkMediaFail(){
//         this.props.onRowsDeleteFail( true );
//     }

//     render() {

//         if (!this.state.countedItems) {
//             return <div className={ this.classname.listOuter }>
//                         <div ref="itemsListWrapWaiting" className="items-list-wrap items-list-wrap-waiting">
//                             <SpinnerLoader />
//                         </div>
//                     </div>;
//         }

//         const listAttr = {
//             ref: "ItemsList",
//             className: this.classname.list,
//         };

//         const props = {
//             ...this.props,
//             onAllRowsCheck: this.onAllRowsCheck,
//             onRowCheck: this.onRowCheck,
//             selectedItems: this.state.selectedItems,
//             selectedAllItems: this.state.selectedAllItems,
//             onDelete: this.deleteItem,
//         };

//         return !this.state.items.length ? null : <div className={ this.classname.listOuter }>

//                     <ManageItemsOptions totalItems={this.state.totalItems} pageItems={this.props.pageItems} onPageButtonClick={this.onPageButtonClick} query={this.parsedRequestUrlQuery} pagesNumber={this.pagesNumber} className='manage-items-options' items={ this.state.selectedItems } pagesSize={ this.listHandler.totalPages() } onProceedRemoval={ this.onBulkItemsRemoval } />

//                     <div ref="itemsListWrap" className="items-list-wrap">

//                         <div {...listAttr}>
//                             { renderManageItems( this.state.items, props ) }
//                         </div>

//                     </div>

//                     <ManageItemsOptions totalItems={this.state.totalItems} pageItems={this.props.pageItems} onPageButtonClick={this.onPageButtonClick} query={this.parsedRequestUrlQuery} pagesNumber={this.pagesNumber} className='manage-items-options' items={ this.state.selectedItems } pagesSize={ this.listHandler.totalPages() } onProceedRemoval={ this.onBulkItemsRemoval } />

//                 </div>;
//     }
// }
