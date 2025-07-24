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

                                <div className="error-actions">
                                    <button 
                                        className="error-btn error-btn-primary"
                                        onClick={() => window.location.href = links.home}
                                    >
                                        <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                                        </svg>
                                        Go Home
                                    </button>
                                    
                                    <button 
                                        className="error-btn error-btn-secondary"
                                        onClick={() => window.location.href = links.latest}
                                    >
                                        <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
                                        </svg>
                                        Browse Films
                                    </button>
                                    
                                    <button 
                                        className="error-btn error-btn-secondary"
                                        onClick={this.goBack}
                                    >
                                        <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                                        </svg>
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