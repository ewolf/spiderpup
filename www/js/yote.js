const yoteConfig = {
    endpoint : "/yote"
};

let sess_ids_txt  = localStorage.getItem( 'sess_ids' );
let sess_ids = sess_ids_txt ? JSON.parse( sess_ids_txt ) : {};

let cache = {};
let defs  = {};

const marshal = args => {
    if( typeof args === 'object' ) {
        if( args._id ) {
            return "r" + args._id;
        }
        if( Array.isArray( args ) ) {
            return args.map( item => marshal( item ) );
        }
        let r = {};
        Object.keys( args ).forEach( k => r[k] = marshal( args[k] ) );
        return r;
    }
    if (args === undefined )
	return 'u';
    return "v" + args;
} //marshal

const unmarshal = (resp,app) => {
    if( typeof resp === 'object' ) {
        if( Array.isArray( resp ) ) {
            return resp.map( item => unmarshal( item, app ) );
        }
        let r = {};
        Object.keys( resp ).forEach( k => r[k] = unmarshal( resp[k], app ) );
        return r;
    }
    if ( resp === undefined ) { return undefined; }
    var type = resp.substring(0,1);
    var val = resp.substring(1);
    if( type === 'r' ) {
        return cache[app][val];
    }
    else if( type === 'v' ) {
        return val;
    }
    return undefined;
} //unmarshal

const rpc = (config,app,action,target,args,files) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'json';
        xhr.open( 'POST', config.endpoint );
        xhr.onload = () => {
          if( xhr.status === 200 ) {

//	    console.log( xhr.response, 'resp' );
            
            const resp = xhr.response.payload;
            const token = xhr.response.token;
	    
            // xhr response succ, data, error, ret
            let retv = resp.ret;
	    let data = resp.data;
	    
            if( token && sess_ids[app] !== token ) {
              //clear cache if new session
	      const oldCache = cache[app] || {};
	      Object.keys( oldCache )
		.filter( k => ! (k in data) )
		.forEach( k => delete oldCache[k] );
              sess_ids[app] = token;
              localStorage.setItem( 'sess_ids', JSON.stringify(sess_ids) );    
            } else if (!token) {
              // remove account
              sess_ids[app] = undefined;
              yote.acct = undefined;
            }
            cache[app] = cache[app] || {};

            let inDefs = resp.defs;
            inDefs && Object.keys( inDefs ).forEach( k => defs[k] = inDefs[k] );

	    // first round define
            if (data) {
              Object.keys( data ).forEach( id => {
                if( ! cache[app][id] ) {
		  const cls = data[id][0];
		  const objdata = data[id][1];
		  if (cls === 'ARRAY') {
		    cache[app][id] = [];
		  } else if (cls === 'HASH') {
		    cache[app][id] = {};
		  } else {
		    cache[app][id] = new YoteObj( config, app, id, objdata, defs[cls] );
		  }
                }
              } );

	      // second round update
              Object.keys( data ).forEach( id => {
		const cls     = data[id][0];
		const newdata = data[id][1];

		const item = cache[app][id];
		if (cls === 'ARRAY') {
		  item.splice( 0, item.length, ...newdata.map( item => unmarshal(item,app) ) );
		} else if (cls === 'HASH') {
		  Object.keys( item ).forEach( k => delete item[k] );
		  Object.keys( newdata ).forEach( k => item[k] = unmarshal(newdata[k],app) );
		} else {
                  item._update( newdata );
		}
              } );
	    }

            let payload = unmarshal( retv, app );
	    resp.succ ? resolve(payload) : reject(payload);

          } else {
            reject('unknown');
          }
        };
      xhr.onerror = () => reject(xhr.statusText);
      
      let fd = new FormData();

      args = marshal( args );
      
        let payload = {
            app,target,action,args,token : sess_ids[app],
        };

//	console.log( payload, 'PAY' );
        fd.append( 'payload', JSON.stringify(payload) );
        if( files ) {
            fd.append( 'files', files.length );
            for( let i=0; i<files.length; i++ )
                fd.append( 'file_' + i, files[i] );
        }
        xhr.send(fd);
    } );
}; //rpcs


class YoteObj {
  constructor( config, app, id, data, def ) {
    this._config = config;
    this._id = id;
    this._app = app;
    this._data = {};
    this._updateListeners = [];
    if( def ) {
      def.forEach( mthd => this[mthd] = this._callMethod.bind( this, mthd ) );
    }
    this._update( data );
  } //constructor

  // get any of the data. The data may not be set, but only updated by server calls
  get( key ) {
    return unmarshal( this._data[key], this._app );
  }
  
  _callMethod( mthd, args, files ) {
    return rpc( this._config, this._app, mthd, this._id, args, files );
  }
  _update( newdata ) {
    let updated = false;
    Object.keys( this._data )
      .filter( k => ! k in newdata )
      .forEach( k => {
	delete this[ k ];
	delete this._data[k];
	updated = true;
      } );
    Object.keys( newdata )
      .forEach( k => {
	if (typeof this[k] === 'function') {
	  console.warn( `Obj ${this._id} clash between method and field for '${k}'` );
	}
	updated = updated || ( this._data[k] === newdata[k] );
	this._data[k] = newdata[k];
	this[k] = unmarshal( this._data[k], this._app );
      } );

    if (updated) {
      this._updateListeners.forEach( l => l(this) );
    }
  } //_update

  addUpdateListener( listener ) {
    this._updateListeners.push( listener );
  }

} //YoteObj

const decorateApp = app => {
  return app;
};

const fetchApp = (appName,yoteArgs) => {
  const config = {...yoteConfig};
  yoteArgs && Object.keys( yoteArgs ).
    forEach( k => config[k] = yoteArgs[k] );
  
  return rpc(config,appName,'load',undefined,undefined,undefined)
    .then( app => { yote.apps[appName] = decorateApp(app); return app } );
};

const fetchAppTryLogin = (appName,yoteArgs) => {
  const config = {...yoteConfig};
  yoteArgs && Object.keys( yoteArgs ).
    forEach( k => config[k] = yoteArgs[k] );
  
  return rpc(config,appName,'load_and_login',undefined,undefined,undefined)
    .then( pair => { const app = yote.apps[appName] = decorateApp(pair[0]);
                     app.acct = pair[1];
                     return app;
                   } );
};

const logout = (appName,yoteArgs) => {
  const config = {...yoteConfig};
  yoteArgs && Object.keys( yoteArgs ).
    forEach( k => config[k] = yoteArgs[k] );
  const prom = rpc(config,appName,'logout');
  delete sess_ids[appName];
  localStorage.setItem( 'sess_ids', JSON.stringify(sess_ids) );    
  return prom;
}

const yote = {
  logout,
  fetchApp,
  fetchAppTryLogin,
  apps : {},
}

window.yote = yote;


/*
class LocationPath {
    constructor(path) {
	this.path = path || [];
	this.top = this.path[0];
    }
    navigate( url, noPush ) {
	console.log( `nav to locationpath ${url}` );
	this.updateToUrl( url );
	if (url != this.url ) {
	    noPush || window.history.pushState( { app : 'test' }, '', url );
	    this.url = url;
	}
    }
    updateToUrl( url ) {
	console.log(`location to ${url}`);
	const matches = url.match( /^(https?:..[^/]+)?([^?#]+)[#?]?(.*)/ );
	const newpath = matches ?  matches[2].split(/\//).filter( p => p.length > 0 ) : [];
	console.log( newpath, matches[2], "NEWP" );
	newpath.shift();
	this.path.splice( 0, this.path.length, ...newpath );
	this.top = this.path[0];
	console.log( this.path.join(" "), this.top, "NEWPATH" );
    }
    subPath() {
	return new LocationPath( this.path.splice(1) );
    }
} //LocationPath

let locationPath; //singleton
const getLocation = () => {
    if (locationPath) return locationPath;
    locationPath = new LocationPath();
    locationPath.navigate( window.location.href );
    window.addEventListener( 'popstate', e => locationPath.navigate( e.target.location.href, true ) );
    return locationPath;
};
*/
