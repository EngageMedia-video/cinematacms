import './styles/ErrorPage.scss'

import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';

import { LinksConsumer } from '../contexts/LinksContext';
import { ApiUrlConsumer } from '../contexts/ApiUrlContext';

import { Page } from './_Page';
import PageStore from './_PageStore';

export class ErrorPage extends Page {
    constructor(props) {
        super(props, 'error');
    }

    goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
    }

    pageContent() {
        return (
          <LinksConsumer>
              {links => (
                  <ApiUrlConsumer>
                      {apiUrl => (
                          <div className="error-page-content">
                              {/* 404 Header */}
                              <div className="error-header">
                                  <div className="error-code">404</div>
                                  <h1 className="error-title">Page Not Found</h1>
                                  <p className="error-description">
                                      Sorry, the page you're looking for doesn't exist. It might have been moved, 
                                      deleted, or you entered the wrong URL.
                                  </p>
                              </div>

                               {/* Action Buttons */}
                                <div className="error-actions">
                                    <button 
                                        className="error-btn error-btn-primary"
                                        onClick={() => window.location.href = links.home}
                                    >
                                        <i className="material-icons">home</i>
                                        Go Home
                                    </button>
                                    
                                    <button 
                                        className="error-btn error-btn-secondary"
                                        onClick={() => window.location.href = links.latest}
                                    >
                                        <i className="material-icons">movie</i>
                                        Browse Films
                                    </button>
                                    
                                    <button 
                                        className="error-btn error-btn-secondary"
                                        onClick={this.goBack}
                                    >
                                        <i className="material-icons">arrow_back</i>
                                        Go Back
                                    </button>
                                </div>
                          </div>
                      )}
                  </ApiUrlConsumer>
              )}
          </LinksConsumer>
      );
  }
}