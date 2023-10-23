const copyFromDataLayer = require('copyFromDataLayer');
const JSON = require('JSON');
const getUrl = require('getUrl');
const getReferrerUrl = require('getReferrerUrl');
const readTitle = require('readTitle');
const injectScript = require('injectScript');
const callInWindow = require('callInWindow');
const makeNumber = require('makeNumber');
const readCharacterSet = require('readCharacterSet');
const localStorage = require('localStorage');
const sendPixel = require('sendPixel');
const encodeUriComponent = require('encodeUriComponent');
const toBase64 = require('toBase64');
const makeString = require('makeString');
//const setCookie = require('setCookie');
//const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const isConsentGranted = require('isConsentGranted');
const getQueryParameters = require('getQueryParameters');
const makeTableMap = require('makeTableMap');
const Object = require('Object');
const log = require('logToConsole');
let pageLocation = getUrl();

if (
  pageLocation &&
  pageLocation.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0
) {
  data.gtmOnSuccess();

  return;
}

//handleClientSideSegment();
// TODO:
// do proepry field trimming for the input properties for track, page, identify and group according to how stape does it
if (data.sendToServerContainer) {
  handleServerSideSegment();
} else {
  data.gtmOnSuccess();
}

function handleServerSideSegment() {
  const requestType = determinateRequestType();

  if (requestType === 'post') {
    const dataTagScriptUrl =
      data.loadDataTagScriptUrl || 'https://cdn.stape.io/dtag/v7.js';
    log('** injecting script and invoking send post request');
    injectScript(
      dataTagScriptUrl,
      sendPostRequest,
      data.gtmOnFailure,
      dataTagScriptUrl
    );
  } else {
    sendGetRequest();
  }
}

function handlePageCallServerSide(clientSideSegmentObject) {
  const finalPageProperties = getFinalProperties(
    data.pagePropertiesKeyValues,
    data.pagePropertiesObject
  );

  if (data.pageCategory) {
    clientSideSegmentObject.category = data.pageCategory;
  }
  if (data.pageName) {
    clientSideSegmentObject.name = data.pageName;
  }

  clientSideSegmentObject.properties = finalPageProperties;
}

function handleIdentifyCallServerSide(clientSideSegmentObject) {
  clientSideSegmentObject.traits = getFinalProperties(
    data.userTraitsKeyValues,
    data.userTraitsObject
  );
}

function handleTrackCallServerSide(clientSideSegmentObject) {
  const finalEventProperties = getFinalProperties(
    data.eventPropertiesKeyValues,
    data.eventPropertiesObject
  );
  clientSideSegmentObject.event = data.eventName;
  clientSideSegmentObject.properties = finalEventProperties;
}

function handleGroupCallServerSide(clientSideSegmentObject) {
  const finalGroupTraits = getFinalProperties(
    data.groupTraitsKeyValues,
    data.groupTraitsObject
  );
  clientSideSegmentObject.groupId = data.groupId;
  clientSideSegmentObject.traits = finalGroupTraits;
}

function generateClientSideEventBodyForServer() {
  const clientSideSegmentObject = {
    anonymousId: getAnonymousId(),
    context: {
      campaign: generateCampaignForServer(),
      // locale:
      page: generatePageDataForServer(),
      screen: generateScreenDataForServer(),
    },

    userId: getUserId(),
  };

  if (data.callType === 'identify') {
    clientSideSegmentObject.context.traits = getFinalProperties(
      data.userTraitsKeyValues,
      data.userTraitsObject
    );
  }

  if (data.overrideMessageId) {
    clientSideSegmentObject.messageId = data.overrideMessageId;
  }

  const contextProperties = getFinalProperties(
    data.contextPropertiesKeyValues,
    data.contextPropertiesObject
  );
  if (Object.keys(contextProperties).length > 0) {
    clientSideSegmentObject.context = mergeObjects(
      {},
      clientSideSegmentObject.context,
      contextProperties
    );
  }

  const integrations = getFinalProperties(
    data.integrationsKeyValues,
    data.integrationsObject
  );
  if (Object.keys(integrations).length > 0) {
    clientSideSegmentObject.integrations = integrations;
  }

  switch (data.callType) {
    case 'track':
      handleTrackCallServerSide(clientSideSegmentObject);
      break;
    case 'page':
      handlePageCallServerSide(clientSideSegmentObject);
      break;
    case 'group':
      handleGroupCallServerSide(clientSideSegmentObject);
      break;
    case 'identify':
      handleIdentifyCallServerSide(clientSideSegmentObject);
      break;
    default:
      break;
  }

  return clientSideSegmentObject;
}

function generatePageDataForServer() {
  return {
    path: getUrl('path'),
    referrer: getReferrerUrl(),
    search: getUrl('query'),
    title: readTitle(),
    url: getUrl(),
  };
}

function generateCampaignForServer() {
  let utmParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ];
  let campaign = {};

  utmParams.forEach((param) => {
    let value = getQueryParameters(param);
    if (value) {
      campaign[param.split('utm_')[1]] = value;
    }
  });

  return campaign;
}

function generateScreenDataForServer() {
  const dataTagData = callInWindow(
    'dataTagGetData',
    getContainerVersion()['containerId']
  );

  return {
    screen_resolution:
      dataTagData.screen.width + 'x' + dataTagData.screen.height,
    viewport_size: dataTagData.innerWidth + 'x' + dataTagData.innerHeight,
  };
}
function getUserId() {
  return data.userId
    ? data.userId
    : localStorage.getItem('ajs_user_id') || null;
}

function getAnonymousId() {
  return data.anonymousId
    ? data.anonymousId
    : localStorage.getItem('ajs_anonymous_id') || null;
}

// this gets called first
function sendPostRequest() {
  log('*** inside postreqyest');
  let eventData = generateClientSideEventBodyForServer();
  log('eventdata', eventData);
  if (data.addConsentState) {
    eventData = addConsentStateData(eventData);
  }

  log(
    '*** server side urk inovcation url',
    data.gtmServerRequestPath +
      '?v=' +
      makeNumber(data.gtmServerProtocolVersion) +
      '&segment_event_type=' +
      encodeUriComponent(data.callType)
  );

  log('*** calling dataTagSendData');
  callInWindow(
    'dataTagSendData',
    eventData,
    data.gtmServerDomain,
    data.gtmServerRequestPath +
      '?v=' +
      makeNumber(data.gtmServerProtocolVersion) +
      '&segment_event_type=' +
      encodeUriComponent(data.callType),
    false, // dataLayerEventName
    false, //dataLayerVariableName
    false, // wait for cookies
    true // use fetch
  );

  data.gtmOnSuccess();
}

function sendGetRequest() {
  sendPixel(
    addDataForGetRequest(buildEndpoint()),
    data.gtmOnSuccess,
    data.gtmOnFailure
  );
}

function buildEndpoint() {
  return data.gtmServerDomain + data.gtmServerRequestPath;
}

function addDataForGetRequest(url) {
  let eventData = generateClientSideEventBodyForServer();
  url +=
    '?v=' +
    data.gtmServerProtocolVersion +
    '&segment_event_type=' +
    encodeUriComponent(data.callType);

  if (data.addConsentState) {
    eventData = addConsentStateData(eventData);
  }

  // if (data.request_type === 'auto') {
  return (
    url + '&dtdc=' + encodeUriComponent(toBase64(JSON.stringify(eventData)))
  );
  // }

  // for (let eventDataKey in eventData) {
  //   url +=
  //     '&' +
  //     eventDataKey +
  //     '=' +
  //     (eventData[eventDataKey]
  //       ? encodeUriComponent(eventData[eventDataKey])
  //       : '');
  // }

  // return url;
}

// this function generates page data;
// used to be addCommonData()

function addConsentStateData(eventData) {
  const consentState = {
    ad_storage: isConsentGranted('ad_storage'),
    analytics_storage: isConsentGranted('analytics_storage'),
    functionality_storage: isConsentGranted('functionality_storage'),
    personalization_storage: isConsentGranted('personalization_storage'),
    security_storage: isConsentGranted('security_storage'),
  };
  eventData.consentState = consentState;
  return eventData;
}

function determinateRequestType() {
  // const isHashingEnabled = userAndCustomData.some(
  //   (item) =>
  //     item.transformation === 'md5' ||
  //     item.transformation === 'sha256base64' ||
  //     item.transformation === 'sha256hex'
  // );

  // if (isHashingEnabled) return 'post';

  // if (data.add_data_layer) {
  //   return 'post';
  // }

  // const userAndCustomDataLength = makeNumber(
  //   JSON.stringify(userAndCustomData).length
  // );
  // return userAndCustomDataLength > 1500 ? 'post' : 'get';

  return 'post';
}

// not in use

function handleClientSideSegment() {
  const options = {};
  const userTraits = getFinalProperties(
    data.userTraitsKeyValues,
    data.userTraitsObject
  );

  const contextProperties = getFinalProperties(
    data.contextPropertiesKeyValues,
    data.contextPropertiesObject
  );
  if (Object.keys(contextProperties).length > 0) {
    options.context = contextProperties;
  }

  if (data.userId) {
    options.userId = data.userId;
  }

  if (data.anonymousId) {
    options.anonymousId = data.anonymousId;
  }

  if (data.overrideMessageId) {
    options.messageId = data.overrideMessageId;
  }

  if (
    data.callType !== 'identify' &&
    typeof data.userTraits === 'object' &&
    Object.keys(data.userTraits).length > 0
  ) {
    options.traits = userTraits;
  }

  // add integrations here
  const integrations = getFinalProperties(
    data.integrationsKeyValues,
    data.integrationsPropertiesObject
  );
  if (Object.keys(integrations).length > 0) {
    options.integrations = integrations;
  }
  switch (data.callType) {
    case 'track':
      handleTrackCall(options);
      break;
    case 'page':
      handlePageCall(options);
      break;
    case 'group':
      handleGroupCall(options);
      break;
    case 'identify':
      handleIdentifyCall(options, userTraits);
      break;
    default:
      break;
  }
}

function handleIdentifyCall(options, userTraits) {
  callInWindow('analytics.identify', data.userId, userTraits, options);
}

function handleTrackCall(options) {
  const finalEventProperties = getFinalProperties(
    data.eventPropertiesKeyValues,
    data.eventPropertiesObject
  );
  callInWindow(
    'analytics.track',
    data.eventName,
    finalEventProperties,
    options
  );
}

function handlePageCall(options) {
  const finalPageProperties = getFinalProperties(
    data.pagePropertiesKeyValues,
    data.pagePropertiesObject
  );
  callInWindow(
    'analytics.page',
    data.pageCategory,
    data.pageName,
    finalPageProperties,
    options
  );
}

function handleGroupCall(options) {
  const finalGroupTraits = getFinalProperties(
    data.groupTraitsKeyValues,
    data.groupTraitsObject
  );
  callInWindow('analytics.group', data.groupId, finalGroupTraits, options);
}

function getFinalProperties(propertiesKeyValues, propertiesObject) {
  const validatedPropertiesObject =
    typeof propertiesObject === 'object' && propertiesObject !== null
      ? propertiesObject
      : {};
  const propertiesFromKeyValues =
    propertiesKeyValues && Object.keys(propertiesKeyValues).length !== 0
      ? makeTableMap(propertiesKeyValues, 'propertyName', 'propertyValue')
      : {};
  return mergeObjects({}, validatedPropertiesObject, propertiesFromKeyValues);
}

function mergeObjects() {
  let obj = {},
    i = 0,
    il = arguments.length,
    key;
  for (; i < il; i++) {
    for (key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key) && key.trim() !== '') {
        obj[key] = arguments[i][key];
      }
    }
  }
  return obj;
}

/*
function addCommonDataForPostRequest(data, eventData) {
  if (data.add_common || data.add_data_layer) {
    const dataTagData = callInWindow(
      'dataTagGetData',
      getContainerVersion()['containerId']
    );

    if (data.add_data_layer && dataTagData.dataModel) {
      for (let dataKey in dataTagData.dataModel) {
        eventData[dataKey] = dataTagData.dataModel[dataKey];
      }
    }

    if (data.add_common) {
      eventData = addCommonData(data, eventData);
      eventData.screen_resolution =
        dataTagData.screen.width + 'x' + dataTagData.screen.height;
      eventData.viewport_size =
        dataTagData.innerWidth + 'x' + dataTagData.innerHeight;
    }
    if (data.add_consent_state) {
      eventData = addConsentStateData(eventData);
    }
  }

  return eventData;
}


function getCustomData(data, dtagLoaded) {
  let dataToStore = [];
  let customData = userAndCustomData;

  for (let dataKey in customData) {
    let dataValue = customData[dataKey].value;
    let dataTransformation = customData[dataKey].transformation;

    if (dataValue) {
      if (dataTransformation === 'trim') {
        dataValue = makeString(dataValue);
        dataValue = dataValue.trim();
      }

      if (dataTransformation === 'to_lower_case') {
        dataValue = makeString(dataValue);
        dataValue = dataValue.trim().toLowerCase();
      }

      if (dataTransformation === 'base64') {
        dataValue = makeString(dataValue);
        dataValue = toBase64(dataValue);
      }

      if (dtagLoaded && dataTransformation === 'md5') {
        dataValue = makeString(dataValue);
        dataValue = callInWindow('dataTagMD5', dataValue.trim().toLowerCase());
      }

      if (dtagLoaded && dataTransformation === 'sha256base64') {
        dataValue = makeString(dataValue);
        dataValue = callInWindow(
          'dataTag256',
          dataValue.trim().toLowerCase(),
          'B64'
        );
      }

      if (dtagLoaded && dataTransformation === 'sha256hex') {
        dataValue = makeString(dataValue);
        dataValue = callInWindow(
          'dataTag256',
          dataValue.trim().toLowerCase(),
          'HEX'
        );
      }

      if (customData[dataKey].store && customData[dataKey].store !== 'none') {
        dataToStore.push({
          store: customData[dataKey].store,
          name: customData[dataKey].name,
          value: dataValue,
        });
      }

      customData[dataKey].value = dataValue;
    }
  }

  if (dataToStore.length !== 0) {
    storeData(dataToStore);
  }

  return customData;
}

function getObjectLength(object) {
  let length = 0;

  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      ++length;
    }
  }
  return length;
}

function getUserAndCustomDataArray() {
  let userAndCustomDataArray = [];

  if (data.custom_data && data.custom_data.length) {
    userAndCustomDataArray = data.custom_data;
  }

  if (data.user_data && data.user_data.length) {
    for (let userDataKey in data.user_data) {
      userAndCustomDataArray.push(data.user_data[userDataKey]);
    }
  }
  return userAndCustomDataArray;
}
*/
