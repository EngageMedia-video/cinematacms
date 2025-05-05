// import { post as axiosPost } from 'axios';
import axios from 'axios';
import { error as logError } from "./log";

async function deleteRequest(url, configData, sync, callback, errorCallback) {

    configData = configData || {};

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
        await axios.delete(url, configData || null).then(responseHandler).catch(errorHandler || null);
    }
    else{
        axios.delete(url, configData || null).then(responseHandler).catch(errorHandler || null);
    }
};

export default deleteRequest;
