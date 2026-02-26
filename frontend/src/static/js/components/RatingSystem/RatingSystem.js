import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';

import LinksContext from '../../contexts/LinksContext';
import UserContext from '../../contexts/UserContext';
import SiteContext from '../../contexts/SiteContext';

import PageStore from '../../pages/_PageStore.js';

import RatingSystemStore from './store.js';
import * as RatingSystemActions from './actions.js';

import { SpinnerLoader } from '../-NEW-/SpinnerLoader.js';
import { CircleIconButton } from '../-NEW-/CircleIconButton.js';

import '../styles/RatingSystem.scss';

export class RatingCategory extends React.PureComponent {

	constructor(props){

		super(props);

		this.initialScore = props.score;

		this.state = {
			score: props.score,
			initialScore: props.score,
			submitingScore: false,
			message: null,
		};

		this.submitRate = this.submitRate.bind(this);
		this.closeRateMessage = this.closeRateMessage.bind(this);
		this.onSucceedRateSubmit = this.onSucceedRateSubmit.bind(this);
		this.onFailedRateSubmit = this.onFailedRateSubmit.bind(this);

		RatingSystemStore.on( 'succeed_rate_submit[' + props.id + ']', this.onSucceedRateSubmit  );
		RatingSystemStore.on( 'failed_rate_submit[' + props.id + ']', this.onFailedRateSubmit );
	}

	closeRateMessage(){
		this.setState({ message: null });
	}

	onSucceedRateSubmit( score ){
		this.setState({
			initialScore: score,
			submitingScore: false,
			message: 'Thank you for your rating in category of "<strong>' + this.props.title + '</strong>".',
		});
	}

	onFailedRateSubmit( score ){
		this.setState({
			submitingScore: false,
			message: 'A problem has occurred when submitting your score for the category of "<strong>' + this.props.title + '</strong>". Please try again.',
		});		
	}

	onButtonClick(score){
		this.setState({ score: score });
	}

	submitRate(){
		this.setState({
			submitingScore: true,
		}, function(){
			RatingSystemActions.rateSumbit( this.props.id, this.state.score );
		});
	}

	stars(){
		const ret = [];
		let i = 1;
		while( i < 6 ){
			ret.push( <div key={i} className={ ( i <= this.state.score ? "active" : "" ) + ( i === this.state.score ? ' selected' : '' ) }><CircleIconButton onClick={ this.onButtonClick.bind(this, i) }><i className="material-icons">star_rate</i></CircleIconButton></div> );
			i += 1;
		}
		return ret;
	}

	render(){

		return <div className= { "rating-category" + ( this.state.submitingScore || null !== this.state.message ? ' submit-loading' : '' )}>
					<div className="category-title">{ this.props.title }</div>
					<div className="stars">{ this.stars() }</div>
					<div className="rate-action"><button disabled={ this.state.score === this.state.initialScore } onClick={ this.state.score === this.state.initialScore ? null : this.submitRate } >Submit score</button></div>
					{ this.state.submitingScore ? <div className="submit-loader"><SpinnerLoader /></div> : null }
					{ null !== this.state.message ? <div className="submit-loader"><div className="submit-msg"><div dangerouslySetInnerHTML={ { __html : this.state.message } }></div></div><CircleIconButton className="close-msg" onClick={ this.closeRateMessage }><i className="material-icons">clear</i></CircleIconButton></div> : null }
				</div>;
	}
}

RatingCategory.propTypes = {
	id: PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]).isRequired,
	title: PropTypes.string.isRequired,
	score: PropTypes.number.isRequired,
};

export class RatingSystem extends React.PureComponent {

	constructor(props){
		
		super(props);

		this.state = {
			extended: RatingSystemStore.get('extended-rate-categories'),
		};

		this.onClickExtend = this.onClickExtend.bind(this);
		this.onRateCategoriesToggle = this.onRateCategoriesToggle.bind(this);

		RatingSystemStore.on( 'changed_rate_categories_visibility', this.onRateCategoriesToggle );
	}

	componentDidMount(){
		RatingSystemActions.init(this.props.media_id);
	}

	onClickExtend(){
		RatingSystemActions.extendRateCategories();
	}

	onRateCategoriesToggle(){
		this.setState({
			extended: RatingSystemStore.get('extended-rate-categories'),
		});
	}

	ratingCategories(){
		const ret = [];
		let i = 0;
		while( i < this.props.ratings_data.length ){
			ret.push( <RatingCategory key={i} id={ this.props.ratings_data[i].category_id } title={ this.props.ratings_data[i].category_title } score={ this.props.ratings_data[i].score } /> );
			i += 1;
		}
		return ret;
	}

	render(){

		let  logginRedirectUrl;

		if( UserContext._currentValue.is.anonymous ){
			logginRedirectUrl = window.location.href.replace( SiteContext._currentValue.url, '' ).replace(/^\//g, '');
			logginRedirectUrl = LinksContext._currentValue.signin + "?next=/" + logginRedirectUrl;
		}

		return <div className={ 'ratings-container' + ( this.state.extended ? ' extended' : '' ) }>
					<button className="extend-rating-form" onClick={ this.onClickExtend }>Rate the film <CircleIconButton type="span"><i className="material-icons">{ this.state.extended ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }</i></CircleIconButton></button>
					<div className={ 'rating-categories' }>
						{ ! UserContext._currentValue.is.anonymous ? this.ratingCategories() : <div className= { "rating-category need-login" }>
							<div className="category-title">Ιn order to be able to rate the film you need to be signed in</div>
							<div className="rate-action"><a href={ logginRedirectUrl } title="Sign in">SIGN IN</a></div>
						</div> }
					</div>
				</div>;
	}

}

RatingSystem.propTypes = {
	media_id: PropTypes.string.isRequired,
	ratings_data: PropTypes.array.isRequired,
};
