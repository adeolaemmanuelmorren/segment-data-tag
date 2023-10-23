function dataTagGetData(containerId) {
  debugger;
  console.log('*** insided dataTagGetData', containerId);
  window.dataTagData = {
    document: {
      characterSet: window.document.characterSet,
    },
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
    dataModel: window.google_tag_manager[containerId].dataLayer.get({
      split: function () {
        return [];
      },
    }),
  };

  return window.dataTagData;
}
