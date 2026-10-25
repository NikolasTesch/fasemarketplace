import process from 'node:process';
import {createAccessFunction} from '../../server/access-function.mjs';
export default {fetch(request){return createAccessFunction({env:process.env})(request);}};
