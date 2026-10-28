import process from 'node:process';
import {createBusinessFunction} from '../server/business-function.mjs';
export default {fetch(request){return createBusinessFunction({env:process.env})(request);}};
