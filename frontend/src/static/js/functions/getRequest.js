import axios from 'axios';
import { error as logError } from "./log";

async function getRequest(url, sync, callback, errorCallback) {

    const requestConfig = {
        timeout: null,
        maxContentLength: null,
        };

    function responseHandler(result) {
        if( callback instanceof Function ) {
            callback( result );
        }
    }

    function errorHandler(error) {

        // console.warn( error.response );

        if( errorCallback instanceof Function ) {
            let err = error;
            if( void 0 === error.response ){
                err = {
                    type: "network",
                    error: error,
                };
            }
            else if( void 0 !== error.response.status ){

                // TODO: Valid only in case of media request.
                switch( error.response.status ){
                    case 401:
                        err = {
                            type: "private",
                            error: error,
                            message: "Media is private",
                        };
                        break;
                    case 400:
                        err = {
                            type: "unavailable",
                            error: error,
                            message: "Media is unavailable",
                        };
                        break;
                }
            }
            errorCallback( err );
        }
    }

    if( sync ){
        await axios.get(url, requestConfig).then(responseHandler).catch(errorHandler || null);
    }
    else{
        axios.get(url, requestConfig).then(responseHandler).catch(errorHandler || null);
    }
}

export default getRequest;
