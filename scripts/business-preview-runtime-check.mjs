import {createBusinessClient,assertBusinessRuntime} from '../apps/backend/dist/persistence/client.js';
process.env.BUSINESS_ENABLED='true';process.env.BUSINESS_DATABASE_URL=process.env.PREVIEW_BUSINESS_DATABASE_URL;
let client;
try{client=createBusinessClient();await client.$connect();await assertBusinessRuntime(client);console.log('Preview business runtime check passed');}
catch(error){const cause=error?.meta?.driverAdapterError?.cause??{};const detail=String(cause.originalMessage??'').toLowerCase();const hints=['permission denied','does not exist','prepared statement','not supported','unsupported','startup parameter','options','bind message','timeout','ssl','syntax error','not allowed','database error','too many'];console.error('Preview business runtime check failed:',error?.constructor?.name,typeof error?.code==='string'?error.code:'',/^[A-Z0-9]{5}$/.test(cause.originalCode??'')?cause.originalCode:'',hints.filter(h=>detail.includes(h)).join(','));process.exitCode=1;}
finally{await client?.$disconnect();}
