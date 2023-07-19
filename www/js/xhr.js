window.SP ||= {};
SP.xhr = {};

SP.xhr.openFile = file => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
    xhr.open( 'GET', file );
    xhr.onload = () => {
      if( xhr.status === 200 ) {
        resolve( xhr.response );
      };
    }
    xhr.onerror = () => reject(xhr.statusText);
    
    xhr.send();
  } );
};
