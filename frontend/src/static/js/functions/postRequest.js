import axios from 'axios';
import { error as logError } from "./log";

async function postRequest(url, postData, configData, sync, callback, errorCallback) {

    postData = postData || {};

    function responseHandler(result) {
        if( callback instanceof Function ) {
            callback( result );
        }
    }

    function errorHandler(error) {
        if( errorCallback instanceof Function ) {
            errorCallback( error );
        }
    }

    if( sync ){
        await axios.post(url, postData, configData || null).then(responseHandler).catch(errorHandler || null);
    }
    else{
        axios.post(url, postData, configData || null).then(responseHandler).catch(errorHandler || null);
    }
};

export default postRequest;
