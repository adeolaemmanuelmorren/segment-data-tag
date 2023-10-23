const makeTableMap = require('makeTableMap');
const logToConsole = require('logToConsole');
const toBase64 = require('toBase64');
const Object = require('Object');
const base64WriteKey = toBase64(data.writeKey + ':');
const callInWindow = require('callInWindow');
const getUrl = require('getUrl');

let pageLocation = getUrl();

if (
  pageLocation &&
  pageLocation.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0
) {
  data.gtmOnSuccess();

  return;
}
