function checkIframeLoaded(iframe, resolve) {
  // Get a handle to the iframe element
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  // Check if loading is complete
  if (iframeDoc.readyState === 'complete') {
    iframe.contentWindow.onload = () => {
      console.log('iframe contentWindow loaded');
    };
    // The loading is complete, call the function we want executed once the iframe is loaded
    console.log('iframedoc is complete');
    return resolve();
  }

    console.log('iframedoc is NOT complete');
  // If we are here, it is not loaded. Set things up so we check   the status again in 100 milliseconds
  setTimeout(checkIframeLoaded, 500);
}

const asyncIframe = async (url) => {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'url';
    /*
    iframe.onload = () => {
      resolve();
      console.log('hi');
      document.body.removeChild(iframe);
      console.log('nooo hi');
    };
    */
    iframe.src = url;
    document.body.appendChild(iframe); // add it to wherever you need it in the document

    setTimeout(resolve, 5000);
    // checkIframeLoaded(iframe, resolve);
  });
};

export default asyncIframe;
export { asyncIframe };
