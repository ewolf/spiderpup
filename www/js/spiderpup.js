/*

  body has a definition that corresponds to a body entry without any arguments

  onload

     * html.head title, load css & js

     * find html.body recipe & all recipes in all filespaces
         - assign id to each recipe
         - consistency check for if/then/else
         - map name -> recipe (namespace.recipes map)

     * build top instance for document.body from recipe + body 'request' without args
         - create state (instance builder may take a parent state)
         - has body tag for top instance
         - assign id, state, recipe to instance
         - assign insertion request tag 'args' ( {} in this case ) to instance (as args)
         - assign instance to state

         ~ run preLoad (only for top)

         - create instance tree (contents)
             * iterate over recipe contents
                 - assign id to instance
                 - assign top instance to instance
                 - attach to contents

     * add instance top child to attach point (document.body)
        - call update instance with body recipe, args

     * update instance( instance/recipe, args )
         - use seen i think
         - find all properties/attributes in args (override) calculate, 
                                             instance calculate, 
                                             args attrs,
                                             instance attrs
           
         - id of attach point is the id of the instance or 'id_0'
           it is a foreach 

         - map child element array into element key -> element
         - iterate over instance contents / idx
            - check if/then/else ( if 'if', check if value.
                                               if true, proceed with installing instance
                                              and set lastif=true,lastifvalue=true
                                              otherwise lastifvalue=false
                                   if 'elseif', check if lastifvalue=false && elseif true
                                               if true, proceed with installing instance
                                               and set lastif=true,lastifvalue=true
                                              otherwise lastifvalue=false
                                   if 'else', check if lastifvalue=false
                                               if true, proceed with installing instance
                                               and set lastif=false,lastifvalue=false )
                  * if lastifvalue=false
                      * if element key in child element map, then remove that child
                  * elseif child element map[key]
                      * update child element map[key] with instance, state
                  * else
                      * thisel = new element
                      * if is a recipe, make a new instance and state
                      * update child element map[key] with instance, state
            - has foreach/forval? that returns an array
                - iterate over list items, idx
                    * set s.idx[forval] = idx
                    * set s.it[forval] = items[idx]
                - remove extra elements that may be there from a previous refresh
 */
window.onload = ev => {

  const defaultNamespace = filespaces[defaultFilename];
  const html = defaultNamespace.html;

  if (html && html.body) {
    if (html.head) {
      const head = document.head;

      document.title = html.head.title || '';

      // explicit css
      let style = defaultNamespace.css;
      if (style) {
        const stylel = document.createElement( 'style' );
        stylel.setAttribute( 'type', 'text/css' );
        if (stylel.styleSheet) { // IE
          stylel.styleSheet.cssText = style;
        } else {
          stylel.appendChild(document.createTextNode(style));
        }
        head.appendChild( stylel );
      }

      // css files
      const css = html.head.css;
      const cssFiles = Array.isArray( css ) ? css : css ? [css] : [];
      cssFiles.forEach( file => {
        const link = document.createElement( 'link' );
        link.setAttribute( 'rel', 'stylesheet' );
        link.setAttribute( 'media', 'screen' );
        link.setAttribute( 'href', file );
        head.appendChild( link );
      } );

      // js files
      const js = html.head.javascript;
      const jsFiles = Array.isArray( js ) ? js : js ? [js] : [];
      jsFiles.forEach( file => {
        const scr = document.createElement( 'script' );
        scr.setAttribute( 'type', 'module' );
        scr.setAttribute( 'src', file );
        head.appendChild( scr );
      } );

    }

    // build a recipe lookup for all recipes across all namespaces/filespaces
    // this lookup is used to distinguish html tags from recipe tags.
    // the lookup includes the recipe data structure, the file it is from and its name.
    // the latter two are for debugging messages.
    const recipeNames = {};
    Object.keys( filespaces )
      .forEach( filename => {
        const namespace = filespaces[filename];
        if (namespace.components) {
          Object.keys(namespace.components)
            .forEach( name => (recipeNames[name] = [namespace.components[name], filename, name] ));
        }
      } );

    // translate the 'namespaces' of each file to a reference to the filespace indicated
    Object.keys( filespaces )
      .forEach( filename => {
        const namespace = filespaces[filename];
        namespace.namespaces &&
          Object.keys( namespace.namespaces )
          .forEach ( name => {
            const filename = namespace.namespaces[name];
            namespace.namespaces[name] = filespaces[filename];
          } )
      } );
    // compile each recipe, translating the data structure into something easier to
    // deal with
    Object.values( recipeNames )
      .forEach( tuple => {
        const [ recipe, filename, name ] = tuple;
        const namespace = filespaces[filename];
        namespace.components[name] = compileRecipe( recipe, filename, name );
      } );

    const bodyRecipe = compileBody( html.body, defaultFilename );
    
    // make state
    const state = newState( defaultNamespace );

    // make instance
    const instance = instantiateRecipe( bodyRecipe, {}, state );
    
    // update body with this instance
    hang( instance, document.body );

    instance.rootel = document.body;

    // onLoad called after everything attached
    if (instance.recipe.onLoad) {
      Promise.resolve( instance.recipe.onLoad( instance.state ) );
      instance.state.refresh();
    }
  } else {
    console.warn( `no body defined in '${defaultFilename}'` );
  }
};

// refresh the element with the instance 
const hang = (instance, el) => {
  const state = instance.state;

  // attach the attributes/properties and calculations
  //  (id may not be updated here)
  const seen = { id: 1 };

  // set the calculated attributes from most to least specific for this instance
  [instance.args && instance.args.calculate, instance.isRecipe && instance.recipe.calculate, instance.calculate]
    .forEach( source => {
      source && Object.keys(source)
        .forEach( attr => {
          seen[attr] = seen[attr] || 0;
          if (0 === seen[attr]++) {
            if (attr === 'textContent') {
              el.textContent = source[attr]( state );
            } else {
              el.setAttribute( attr, source[attr]( state ) );
            }
          }
        } )
    } );

  // set the non calculated attributes
  [instance.args && instance.args.attrs,instance.attrs, instance.isRecipe && instance.recipe.attrs]
    .forEach( source => {
      source && Object.keys(source)
        .forEach( attr => {
          seen[attr] = seen[attr] || 0;
          if (0 === seen[attr]++) {
            if (attr === 'textContent') {
              el.textContent = source[attr];
            } else {
              el.setAttribute( attr, source[attr] );
            }
          }
        } )
    } );
  instance.textContent && (el.textContent = instance.textContent);

  // find if the child instances have been created, and hash key --> element
  const key2el = {};
  Array.from( el.children )
    .forEach( el => el.key && ( key2el[el.key] = el ) );

  instance.contents
    .forEach( (childinstance,idx) => {
      const key = childinstance.id + (childinstance.foreach ? '_0' : '');
      let childel = key2el[key];

      if (!childel) {
        // check if it is a recipe. if so, the tag is the tag of the recipe root instance

        const tag = childinstance.isRecipe ? childinstance.recipe.rootTag : childinstance.tag;
        
        // now create and attach the element
        childel = document.createElement( tag );

        if (childinstance.internalContent) {
          childel.internalContent = true;
        }

        key2el[key] = childel;

        childel.hidden = true;

        // collect el and compo
        const handle = childinstance.handle;
        handle && ( state.el[handle] = childel );

        if (childinstance.isRecipe) {
          childinstance.rootel = childel;
        }

        childel.key = key;
        childinstance.key = key;

        el.append( childel );

        // attach event handlers
        childinstance.on && Object.keys( childinstance.on ).forEach( evname => {
          const evfun = function() {
            const prom = childinstance.on[evname]( state, ...arguments );
            Promise.resolve( prom )
              .then( () => {
                if ( state.data._check() ) state.refresh();
              } );
          };
          childel.addEventListener( evname, evfun );
        } );

        // also attach on_<foo> stuff
        Object.keys( childinstance ).forEach( attr => {
          const l = attr.match( /^on_(.*)/ );
          if (l) {
            const evfun = function() {
              const prom = childinstance[attr]( state, ...arguments );
              Promise.resolve( prom )
                .then( () => {
                  if ( state.data._check() ) state.refresh();
                } );
            }
            childel.addEventListener( l[1], evfun );
          }
        } );
      }
    } );

  // now find the children
  let lastWasConditional = false,
      conditionalDone = false,
      lastConditionalWasTrue = false;

  instance.contents
    .forEach( childInstance => {
      const tagOrComponentName = childInstance.tag;
      const key = childInstance.key;
      const childEl = key2el[key];

      if (childInstance.if) {
        conditionalDone = lastConditionalWasTrue = childInstance.if( state );
        lastWasConditional = true;
      } else if (childInstance.elseif) {
        if (conditionalDone) {
          lastConditionalWasTrue = false;
        } else {
          conditionalDone = lastConditionalWasTrue = childInstance.elseif( state );
        }
      } else if (childInstance.else) {
        if (conditionalDone) {
          lastConditionalWasTrue = false;
        } else {
          lastConditionalWasTrue = true;
        }
      } else {
        lastWasConditional = false;
      }

      if (lastWasConditional === false || lastConditionalWasTrue) {

        if (childInstance.foreach) {
          const basekey = key.replace( /_0$/, '' );
          const forval = childInstance.forval;
          const list = childInstance.foreach( state );
          if (state.lastcount[forval] > list.length) {
            for (let i=list.length === 0 ? 1 : list.length; i<state.lastcount[forval]; i++) {
              const itEl = key2el[basekey + '_' + i];
              itEl && itEl.remove();
            }
          }
          state.lastcount[forval] = list.length;
          if (list.length === 0) {
            childEl.hidden = true;
          } else {
            let lastEl = key2el[basekey + '_0'];
            for (let i=0; i<list.length; i++) {
              const key = basekey + '_' + i;
              let itEl = key2el[key];
              if (!itEl) {
                console.warn ( 'gotta do recipe instances here, too' );
                itEl = document.createElement( tagOrComponentName );
                key2el[key] = itEl;
                itEl.key = key;
                lastEl.after( itEl );
              } else {
                itEl.hidden = false;
              }
              state.idx[forval] = i;
              state.it[forval] = list[i];
              lastEl = itEl;

              hang( childInstance, itEl );
            }
          }
        } else {
          childEl.hidden = false;
          hang( childInstance, childEl );

          // if it is a recipe, it may have internal
          // content in the args
          if (childInstance.isRecipe) {
            const conel = findInternalContent( childEl );
            if (conel) {
              hang( { state, contents: childInstance.args.contents }, conel );
            }
          }

        }
      } else {
        childEl.hidden = true;
      }
    } );

  if (instance.isRecipe && ! instance.didLoad) {
    if (instance.recipe.onLoad) {
      Promise.resolve( instance.recipe.onLoad( instance.state ) );
      instance.didLoad = true;
      instance.state.refresh();
    }
  }
  
}; //hang

let serial = 1;
const newState = (recipe,parent,args) => {
  // get data fields
  const data = {};
  const dataFunConvert = {};

  [recipe,args]
    .forEach( level => level && level.data && Object.keys(level.data).forEach( arg => {
      let val = level.data[arg];
      if (typeof val === 'string') {
        const x = val.substr( 0, 1 );
        const checkVal = val.substr( 1 );
        if (x === 'i') { // int          
          val = Number.parseInt( checkVal );
        } else if (x === 'f') { // float
          val = Number.parseFloat( checkVal );
        } else if (x === 'c') { // code/function
          dataFunConvert[arg] = Number.parseInt(checkVal);
        } else if (x === 's') {
          val = checkVal;
        }
      }
      data[arg] = val;
    } ) );

  const state = {
    id     : serial++,
    desc : 'state',
    parent,

    forRecipe: recipe.name,

    data   : {
      parent,
      _data: data,
      _check: function() { const changed = this._changed; 
                           this._changed = false; return changed; },
      _changed: false,
      get: function(k,defVal) { if (k in this._data) return this._data[k];
                                let val = this.parent && this.parent.data.get( k );
                                if (val===undefined && defVal !== undefined) {
                                  val = this._data[k] = defVal;
                                }
                                return val;
                              },
      set: function(k,v) { this._changed = v !== this._data[k];
                           this._data[k] = v; },
    }, 
    calc   : {}, // attribute name -> calculation
    comp   : {}, // handle -> component state?
    el     : {}, // handle -> element
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value
    lastcount: {}, // iterator name -> last list count
    recipe,
    refresh: function() { hang( this.instance, this.instance.rootel ) },
  };

  // get defined functions
  const stateFuns = parent ? {...parent.fun} : {};
  [recipe,args]
    .forEach( level => level && 
              level.functions && 
              Object.keys(level.functions).forEach( fun => 
                stateFuns[fun] = function() { return level.functions[fun]( state, ...arguments ) }
              ) );

  state.fun = stateFuns,


  console.warn( 'maybe we dont need a state object seperate from the instance' );
  // attach the state funs to the item itself. also maybe we don't need a 
  

  // now that there is a state, use it to calculate function'd data
  // should be parent state, because that is what is sending the data to
  Object.keys( dataFunConvert )
    .forEach( fld => data[fld] = funs[dataFunConvert[fld]](parent) );
  
  return state;
};

const instantiateRecipeComponents = (contents,recipeInstance) => {
  if (contents) {
    const recipe = recipeInstance.recipe;
    return contents.map( child => {

      const childrecipe = lookupRecipe( child.tag, recipe.namespace );
      if (childrecipe) {
        return instantiateRecipe(childrecipe,child.args,recipeInstance.state);
      }

      const childInstance = {...child};

      childInstance.id = serial++;
      childInstance.desc = 'child instance',
      childInstance.state = recipeInstance.state;
      childInstance.recipe = recipe;
      childInstance.args = {};
      childInstance.contents = instantiateRecipeComponents( childInstance.contents, recipeInstance );

      return childInstance;
    } );
  }
  return [];
};

const instantiateRecipe = (recipe,args,state) => {

  state = newState( recipe, state, args );

  const id = serial++;
  const instance = {
    args: args || {},
    desc: 'recipe instance',
    id,
    recipe,
    state,
    isRecipe: true,
  };
  instance.contents = instantiateRecipeComponents(recipe.contents, instance);
  state.instance = instance;

  // collect compo
  const handle = args && args.handle;
  handle && ( state.parent.comp[handle] = instance );

  // run the preLoad if any
  Promise.resolve( recipe.preLoad && recipe.preLoad( state, args ) );

  return instance;
};

const compileBody = (body, filename) => {
  const preLoad = body.preLoad;
  delete body.preLoad;
  return compileRecipe( { preLoad, contents: [{ tag:'body', ...body}] }, filename, 'body' );
};

const compileRecipe = (recipe, filename, recipeName) => {

  try {
    if ( (!recipe.contents) || recipe.contents.length != 1) {
      throw new Error( "recipe '" + recipeName + "' must contain exactly one root element" );
    }

    recipe.id = serial++;
    recipe.namespace = filespaces[filename];
    recipe.name = recipeName;

    prepFunctions( recipe, filename, recipeName );
    compileRecipeNodes( recipe, recipe, filename, recipeName, recipe.namespace, [] );

    recipe.rootTag = recipe.contents[0].tag;
  }
  catch( err ) {
    throw new Error( `Error compiling recipe '${recipeName}' in file '${filename}' : ${err}` );
  }
  return recipe;
};

const lookupRecipe = (tag,namespace) => {
  let recipe = namespace.components && namespace.components[tag];
  if (!recipe) {
    const parts = tag.split( /\./ );
    if (parts.length === 2) {
      recipe = namespace.namespaces[parts[0]] && namespace.namespaces[parts[0]].components[parts[1]];
    }
  }
  return recipe;
}

const findInternalContent = (el,recur) => {
  if ( el.internalContent ) return el;

  const chilInts = Array.from( el.children )
        .map( chld => findInternalContent( chld, true ) )
        .filter( chld => chld !== undefined );

  if (chilInts.length > 0) {
    return chilInts[0];
  }
  if (!recur) {
    return el;
  }
};


// transform recipe instruction from {"tag":{...data...}} into { tag, ...data }
// make sure if/then/else blocks are aligned properly.
// if the instruction is a component, store its data in args
// also toss up an error if there is a circular reference 
const compileRecipeNodes = (root, recipe, filename, recipeName, namespace, recipesEncountered) => {

  let lastWasConditional = false;

  root.contents = root.contents
    .map( node => {

      //
      // handle differently if node is for an html element like 'div'
      // or a spiderpup component - aka - a recipe that is instantiated
      //
      // in both cases, normalize to a form like { contents: [...], attrs: {...}, ... }
      //
      const nodeRecipe = lookupRecipe( node.tag, namespace );
      if (nodeRecipe) {
        if (recipesEncountered[nodeRecipe.id]++) {
          throw new Error( "circular reference detected" );
        }
        node = {
          tag: node.tag,
          functions: node.functions || {},
          nodeRecipe, //used to identify as a recipe instance
          contents: node.contents,
          args: {...node},
        };
      }

      prepFunctions( node, filename, recipeName );

      node.id = serial++;
      node.recipe = recipe;

      if (node.if) {
        lastWasConditional = true;
      } else if (node.elseif) {
        if (!lastWasConditional) {
          throw new Error( `error, got elseif without if` );
        }
      } else if (node.else) {
        if (!lastWasConditional) {
          throw new Error( `error, got elseif without if` );
        }
      } else {
        lastWasConditional = false;
      }
      if (node.foreach && ! node.forval) {
          throw new Error( `error, got foreach without forval` );
      }
      compileRecipeNodes( node, recipe, filename, recipeName, namespace, recipesEncountered );
      return node;
    } );
};

// for a recipe node, place the functions in spots where they are
// references by function index
const prepFunctions = (node, filename, recipeName) => {
  const attrs = node.attrs = node.attrs || {};
  const on = node.on = node.on || {};
  const calcs = node.calculate = node.calculate || {};
  Object.keys( node ).forEach( key => {
    const val = node[key];
    const m = key.match( /^on_(.*)/ );
    if (m) {
      on[ m[1] ] = funs[ val ];
    } else if (key.match( /^((pre|on)Load|if|elseif|foreach)$/ ) ) {
      node[key] = funs[ val ];
    } else if (key.match( /^(calculate|on|functions)$/ ) ) {
      Object.keys( val ).forEach( fld => val[fld] = funs[val[fld]]);
    }
  } );
};

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
            app,target,action,args,sess_id : sess_ids[app],
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
	this._methods = {}; // adding this field for Vue, to be able to bind right to Vue
        if( def ) 
            def.forEach( mthd => this._methods[mthd] = this[mthd] = this._callMethod.bind( this, mthd ) );
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
    } //_update

} //YoteObj

const fetchApp = (appName,yoteArgs) => {
    const config = {...yoteConfig};
    yoteArgs && Object.keys( yoteArgs ).
	forEach( k => config[k] = yoteArgs[k] );

    return rpc(config,appName,'load',undefined,undefined,undefined);
};

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

const el = (sel,loc) => (loc||document).querySelector(sel);
const els = (sel,loc) => Array.from( (loc||document).querySelectorAll(sel) );

const makeEl = builder => {
    const el =document.createElement( builder.tag );
    return el;
};

const makeBuilder = recipe => {
    const r = recipe.slice();
    const builder = { tag : r.shift(), builders : [] };
    while ( r.length > 1 ) {
        const attr = r.shift();
        const val  = r.shift();
        builder[attr] = val;
    }
    if (r.length === 1) {
        // [ 'div', 'hello there' ]
        // [ 'div', [ 'span', 'hello' ] ]
        // [ 'div', [ ['span', 'spanone' ], [ 'span', 'span2' ] ] ]
        if (Array.isArray(r[0])) {
            const builders = Array.isArray( r[0][0] ) ? r[0] : r;
            builders.forEach( r => builder.builders.push( makeBuilder(r) ) );
        }
        else if (typeof r[0] === "string") {
            builder.text = r;
        }
    }
    return builder;
} //makeBuilder

const shouldBuild = (stateObj, builder) => {
    return true;
};

const buildKey = (stateObj, builder, idx) => {
    return idx;
};

const calcState = (stateObj, builder) => {
    return stateObj;
}

const createElement = (stateObj, builder) => {
    return document.createElement( builder.tag );
}

const _fill = (stateObj, attachPointEl, startBuilder) => {

    if (!shouldBuild( stateObj, startBuilder )) {
        return;
    }

    // examine state and map key -> builder for the 
    const key2builder = {};
    const useKeys = [];
    startBuilder.builders.forEach( (builder,idx) => {
        if (shouldBuild( stateObj, builder )) {
            const key = buildKey( stateObj, builder, idx );
            if (key2builder[key]) {
                console.warn( `not building anything. duplicate builder key ${key}` );
                return;
            }
            useKeys.push( key );
            key2builder[key] = builder;
        }
    } );

    // gather child elements, find their keys and make a
    // map of key -> element
    const key2child = {};
    let children = Array.from( attachPointEl.children || [] );
    children.forEach( c => key2child[c.dataset.key] = c );

    // prune out child nodes not paired with a builder
    children = children.filter( child => {
        if (!key2builder[child.dataset.key]) {
            child.remove();
            return false;
        }
        return true;
    } );

    if (children.length === useKeys.length) {
        // no new child elements need be created
        // so just update them all
        useKeys.forEach( (key,idx) => {
            const builder = key2builder[key];
            const child = key2child[key];
            child.dataset.key = key;
            const childState = calcState( stateObj, builder );
            _fill( childState, child, builder );
        } );
    }
    else {
        // inject or update the child elements, using append to
        // get things in the correct order
        useKeys.forEach( (key,idx) => {
            const builder = key2builder[key];
            const childState = calcState( stateObj, builder );
            const child = key2child[key] || createElement( childState, builder );
            // append will move a node that already exists to the
            // end. find a faster way to do this like using insertBefore
            // rather than moving nodes
            attachPointEl.appendChild( child );
            
            _fill( childState, child, builder );
        } );

    }
    
    // update the attachPointEl with builder instructions, if any
    if (startBuilder.text) {
        attachPointEl.textContent = eval( '`' + startBuilder.text + '`');
    }
}; //_fill

const fill = (stateObj, attachPointEl, recipe) => {
    _fill( stateObj, attachPointEl, makeBuilder(recipe) );
}

const loadPage = ( appName, recipe ) => {
    return fetchApp( appName )
        .then( app => {
            const bod = el('body');
            fill( app, bod, recipe );
            return app;
        } );
};


const yote = {
    fetchApp,
    apps : {},
    getLocation,
    loadPage,
    fill,
}

window.yote = yote;
