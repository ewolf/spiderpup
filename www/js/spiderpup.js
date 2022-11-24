  // a namespace has the following fields:
  //   components -> { name -> component }
  //   namespaces -> { localname -> namespace }
  //   functions  -> { name -> function }
  //   data       -> { field -> value }
  //   include css|javascript
  //   html head script|title|style
  //        body onLoad|on|contents|listen
  //
  //   a component (recipe) node has the following fields:
  //     functions  -> { name -> function }
  //     data       -> { field -> value }
  //     onLoad|on|contents|listen
  //     contents: content node (singular)
  //
  //   an content node can be an element or component node
  //
  //   an element node has the following fields:
  //     contents -> content nodes
  //     if|elsif|else|foreach|forval - flow control and looping functions
  //     on -> { element event name -> event function }
  //
  //   a component node has the following fields:
  //     contents -> content nodes to be inserted into the component
  //     if|elsif|else|foreach|forval - flow control and looping functions
  //     on -> { component event name -> event function }
  //
  // in addition, each node will gain
  //    id -> serialized field
  //    key -> uniquely identify this node
  //    recipe -> a link to the recipe that it is attached to
  //
  //
  // an instance node will gain
  //    componentRecipe - link to the recipe that created it

/*
    handles

    if/elseif/else

    foreach

 */


// ----------------------------------------------------------------------------------------------------
//                               BOOTSTRAP
// ----------------------------------------------------------------------------------------------------

window.onload = ev => {
  init( filespaces, funs, defaultFilename );
}

// init takes spaces and funz as an argument
// to allow tests
const init = (spaces,funz,defFilename) => {
  filespaces = spaces;
  funs = funz;
  defaultFilename = defFilename;

  // see if the module requested has a body to render.
  // if not, then loading this does nothing
  const html = filespaces[defaultFilename].html;
  if (!(html && html.body)) {
    console.warn( `no body defined in '${defaultFilename}'` );
    return;
  }

  const defaultNamespace = filespaces[defaultFilename];


  // prep and connect the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      const namespace = prepNamespace( filespaces[filename], filename );
      namespace.namespaces = namespace.namespaces || {};
      Object.keys( namespace.namespaces )
        .forEach( alias => (namespace.namespaces[alias] =
                            filespaces[namespace.namespaces[alias]]) );
      if (filename !== defaultFilename) {
        namespace.parent = defaultNamespace;
      }
    } );

  // finalize the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      finalizeNamespaces( filespaces[filename], filename );
    } );

  // html is a recipe too, containing one thing in contents, the body
  const htmlRecipe = {...html.body};
  htmlRecipe.tag = 'html';
  htmlRecipe.contents = [{ tag: 'body', contents: html.body.contents}];

  prepRecipe( htmlRecipe, 'html', defaultNamespace );
  finalizeRecipe( htmlRecipe );

  // there may be a head that has javascript/css imports
  // and explicit style and a title
  if (html.head) {
    const head = document.head;
    document.title = html.head.title || '';

    // explicit style
    let style = html.head.style
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

    // explicit javascript
    let script = html.head.script
    if (script) {
      const scriptel = document.createElement( 'script' );
      scriptel.setAttribute( 'type', 'text/javascript' );
      scriptel.appendChild(document.createTextNode(script));
      head.appendChild( scriptel );
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

  // now make an instance of the body and refresh it
  const bodyInstance = newBodyInstance( htmlRecipe );

  bodyInstance.refresh();

  return bodyInstance;
}; //init


// ----------------------------------------------------------------------------------------------------
//                               PREP LOGIC
// ----------------------------------------------------------------------------------------------------


// setup the namespace, attach methods, prep all the recipes inside, and verify their names
const prepNamespace = (namespace,filename) => {
  prepNode( namespace, 'namespace' );
  namespace.filename = filename;
  namespace.name = `namespace ${filename}`;
  attachGetters( namespace );
  namespace.components = namespace.components || {};
  Object.keys( namespace.components )
    .forEach( recipeName => {
      if (recipeName === 'body' || recipeName === 'html') {
        throw new Error( `may not use the name '${recipeName}' for components in file ${namespace.filename}` );
      }
      const recipe = namespace.components[recipeName];
      prepRecipe( recipe, recipeName, namespace );
    } );

  // find recipe given a tag. this can cross namespaces if defined
  namespace.findRecipe = function(tag) {
    const tagParts = tag.split('.');
    if (tagParts.length == 2) {
      const space = this.namespaces[tagParts[0]];
      if (!space) {
        throw new Error( `requested namespace that was not imported` );
      }
      return space.findRecipe( tagParts[1] );
    } else if (tagParts.length == 1) {
      return this.components[tag];
    } else {
      throw new Error( `invalid tag '${tag}' in namespace '${this.filename}'` );
    }
  } //findRecipe

  return namespace;
}; //prepNamespace






// make sure this namespace contains no recipe with a cyclic dependency
const finalizeNamespaces = (namespace,filename) => {
  Object.keys( namespace.components )
    .forEach( recipeName => {
      const recipe = namespace.components[recipeName];
      finalizeRecipe( recipe );
    } );
}; //finalizeNamespaces





// ready this recipe node
const prepRecipe = (recipe,name,namespace) => {
  if (recipe.contents.length !== 1) {
    throw new Error( `recipe must contain exactly one root element for '${name}' in '${namespace.filename}'` );
  }
  prepNode( recipe, 'recipe', namespace );
  recipe.namespace = namespace;
  recipe.parent = namespace;
  recipe.name = name;
  attachGetters( recipe );

  return recipe;
} //prepRecipe





// make sure the recipe does not have a cyclic dependency
// it checks to see if a recipe is an alias for an other
// (which may be an alias for an other)
// and it copies data and functions from its alias chain
//
// it sets the rootElementNode from the end of its alias chain
// or the first of its contents.
//
// it preps all the html elements from the root node forwards.
//
// in any case, it copies data and functions from its namespace
const finalizeRecipe = (recipe) => {
  if (recipe.isFinalized) { return recipe; }
  const namespace = recipe.namespace;

  let root = recipe.contents[0];

  let aliasedRecipe = namespace.findRecipe( recipe.contents[0].tag );
  if (aliasedRecipe) {
    recipe.aliasedRecipe = aliasedRecipe;
    if (! aliasedRecipe.isFinalized) {
      finalizeRecipe( aliasedRecipe );
    }
    root = aliasedRecipe.rootElementNode;
    attachFunctions( recipe, aliasedRecipe );
    recipe.parent = aliasedRecipe;
    attachData( recipe, aliasedRecipe );
  }


  // set up the rest from the original namespace
  recipe.isFinalized = true;
  recipe.rootElementNode = root;
  attachFunctions( recipe, namespace );
  prepContents( recipe.contents, namespace );

  return recipe;

} //finalizeRecipe

const newBodyInstance = recipe => {
  const instance = newInstance(recipe);
  instance.parent = recipe.namespace;
  const bodyKey = instance._key();
  document.body.key = document.body.dataset.key = bodyKey;

  document.body.instance = instance;
  instance.rootEl = document.body;

  instance.refresh = function() {
    // refresh the contents of the body
    this._refresh( recipe.contents[0], document.body );
  };

  instance.loadPromise = Promise.resolve( instance.preLoad )
    .then(() => recipe.onLoad && recipe.onLoad(instance));

  return instance;
}; //newBodyInstance


// ----------------------------------------------------------------------------------------------------
//                               INSTANCE LOGIC
// ----------------------------------------------------------------------------------------------------


const newInstance = (recipe,parent,node) => {

  const instance = {
    recipe: recipe,
    parent,
    name: parent ? `instance of recipe ${recipe.name} in ${parent.name}` : `instance of recipe ${recipe.name}`,

    rootNode: node,

    // handles
    el: {},
    comp: {},

    // foreach temporary vars
    _loop_level: 0,
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value

    // listeners
    eventListeners: {}, // event name -> listeners
    on: {}, //handler -> function

    broadcast: function( act, msg ) {
      this.top._propagateBroadcast(act,msg);
      this.top.refresh();
    },
    _propagateBroadcast: function(act, msg) {
      this.broadcastListener && this.broadcastListener(this,act, msg );
      // propagates here and each child with the given message
      Object.values( this._key2instance ).forEach( c => c._propagateBroadcast(act,msg) );

    },

    event: function(event,result) {
      const listeners = this.eventListeners[event];
      listeners && listeners.forEach( l => l( result ) );
    },

    broadcastListener: (node && node.listen) || recipe.listen,

    // instance functions
    fun: {}, 

    // TODO: should listens be additive? that is, run
    // listen code for recipe and for the node?
    // also make class attribute additive?
    //    broadcastListener: node.listen || recipe.listen,

    refresh: function() {
      this._refresh( recipe, this.rootEl );
    }, //refresh

    _refresh: refresh,
    _refresh_content: _refresh_content,
    _refresh_component: _refresh_component,
    _new_el: _new_el,
    _refresh_element:  _refresh_element,
    _resolve_onLoad: _resolve_onLoad,

    _key2instance: {},

    _key: function(node,idxOverride) {
      node = node || this.recipe.rootElementNode;
      let base = `${this.id}.${node.id}`;
      const indexes = {...instance.idx};
      if (node.foreach) {
        indexes[node.forval] = indexes[node.forval] || 0;
      }
      if (idxOverride !== undefined) {
        indexes[node.forval] = idxOverride;
      }
      const indexesToUse = Object
            .keys(indexes)
            .sort()
            .filter( k => indexes[k] !== undefined );
      if (indexesToUse.length > 0) {
        base += ':' + indexesToUse
          .map( k => `${k}=${indexes[k]}` )
          .join(',');
      }
      return base;
    }, //key

    _attachElHandle: function( el, handle ) {
      if (this._loop_level > 0) {
        if (!Array.isArray(this.el[handle])) {
          this.el[handle] = [];
        } 
        this.el[handle].push( el );
      } else {
        this.el[handle] = el;
      }
    },

    _attachCompHandle: function( comp, handle ) {
      if (this._loop_level > 0 ) {
        if (!Array.isArray(this.comp[handle])) {
          this.comp[handle] = [];
        } 
        this.comp[handle].push( comp );
      } else {
        this.comp[handle] = comp;
      }
    },
  };

  instance.top = (parent && parent.top) || instance;

  prepNode( instance, 'instance', recipe );

  if (node) {
    attachFunctions( instance, node );
    attachData( instance, node );
  }
  attachFunctions( instance, recipe );
  attachData( instance, recipe );
  if (parent) {
    attachFunctions( instance, parent );
    attachForFields( instance, parent );
  }
  
  // now convert functions
  Object.keys( instance.functions )
    .forEach( funname => {
      const fun = instance.functions[funname];
      instance.fun[funname] = function() { return fun(instance, ...arguments ) }
    } );
  delete instance.functions;

  attachGetters( instance );

  recipe.preLoad && (instance.preLoad = recipe.preLoad(instance)); 

  return instance;
}; //newInstance

const attachGetters = node => {
  node.set = function(k,v) {
    this._changed = this._changed || v !== this.data[k];
    this.data[k] = v;
    return this;
  };
  node.get = function(k,defVal) {
    if (k in this.data) return dataVal( this.data[k], node );
    let val = this.parent && this.parent.get( k );
    if (val === undefined && defVal !== undefined) {
      val = this.data[k] = defVal;
    }
    // data can be a value or a function. if a function, run it to
    // get the data
    return dataVal( val, node );
  };
  node._check = function() {
    const changed = this._changed;
    this._changed = false;
    return changed;
  }
  
};

// serial is an int that serializes all the nodes.
let serial = 1;

// this does two things, it attaches function references
// to the funs array. this will not be needed if functions are
// included as first class objects rather than references.
//
// the second thing this does is attach functions from the
// parent node of this one, be it namespace, recipe or instance
// node
const attachFunctions = (node,parent) => {
  [ 'on', 'calculate', 'functions' ]
    .forEach( funtype => {
      const funhash = parent[funtype];
      funhash && Object.keys(funhash)
        .forEach( funname => node[funtype][funname] = node[funtype][funname] || funhash[funname]  )
    } );
}; //attachFunctions

const attachData = (node,parent) => {
  Object.keys( parent.data )
    .forEach( fld =>
      (node.data[fld] = fld in node.data ? node.data[fld] : parent.data[fld])
    );
}; //attachData

const attachForFields = (node,parent) => {
  [ 'it', 'idx' ]
    .forEach( fd => {
      const forhash = parent[fd];
      forhash && Object.keys(forhash)
        .forEach( forname => node[fd][forname] = forhash[forname]  )
    } );
}; //attachForData

/*
  Nodes types:

    namespace: static data, functions from itself

    recipe: static data, functions from itself and parent namespace

    component: static data, functions from itself and parent recipe

    element: no data or functions

    instance: dynamic data, functions built from component

*/
const prepNode = (node,type,parent) => {
  node.type = type;
  node['is'+type.substr(0,1).toUpperCase()+type.substr(1)] = true;
  node.id = serial++;


  //
  // attach functions where proxy references exist
  //
  [ 'preLoad', 'onLoad', 'if', 'elseif', 'foreach', 'listen' ]
    .forEach( fun =>
      node[fun] !== undefined && ( node[fun] = funs[node[fun]] ) );


  [ 'calculate', 'on', 'functions' ]
    .forEach( hashName => {
      const funHash = node[hashName];
      if (funHash) {
        Object.keys( funHash )
          .forEach( fun => ( funHash[fun] = funs[funHash[fun]] ) )
      }
    } );

  if (type !== 'element') {
    node.functions = node.functions || {};
    node.data = node.data || {};
    prepData( node.data );
  }
  if (node.contents) {
    
  }

  return node;
} //prepNode

// data may be obtained from a function or a value
const dataVal = (v,s) => typeof v === 'function' ? v(s) : v;

// data is encoded as a string. the first letter of the string
// describes the data. this sets the value of the data as the translation
// of the string.
const prepData = data => {
  Object.keys( data )
    .forEach( key => {
      let val = data[key];
      let isFun = false;
      if (typeof val === 'string') {
        const x = val.substr( 0, 1 );
        const checkVal = val.substr( 1 );
        if (x === 'i') { // int
          val = Number.parseInt( checkVal );
        } else if (x === 'f') { // float
          val = Number.parseFloat( checkVal );
        } else if (x === 'c') { // code/function
          val = funs[Number.parseInt(checkVal)];
          isFun = true;
        } else if (x === 's') { //string
          val = checkVal;
        } else {
        }
        return data[key] = val;
      }
    } );
  return data;
};

const prepContents = (contents,namespace) => {
  contents
    && contents.forEach( con => {
      const recipe = namespace.findRecipe(con.tag);
      if (recipe) {
        prepComponentNode( con, namespace, recipe );
      } else {
        prepElementNode( con, namespace );
      }
    } );
};

const prepComponentNode = (node,namespace,recipe) => {
  prepNode( node, 'component', recipe );
  attachFunctions( node, recipe );
  node.recipe = recipe;
  prepContents( node.contents, namespace );
};


const prepElementNode = (node,namespace) => {
  prepNode( node, 'element' );
  prepContents( node.contents, namespace );
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

function _refresh_element( node, el ) {
  // el must have a value if it has gotten to this point

  // an element that needs init has no handlers and stuff
  // so attach those now
  const needsInit = !!!el.hasInit;
  if (needsInit) {
    el.hasInit = true;

    // attach element event handlers once
    if (node.on) {
      const instance = this;
      Object.keys( node.on ).forEach( evname => {
        const evfun = function() {
          const prom = node.on[evname]( instance, ...arguments );
          // resolve in case it returns undefined or returns a promise
          Promise.resolve( prom )
            .then( () => {
              if ( instance._check() ) instance.refresh();
            } );
        };
        // element event listeners
        el.addEventListener( evname, evfun );
      } );
    }
  } // needs init

  // check on handles
  node.handle && this._attachElHandle( el, node.handle );


  const seen = {};

  const rootNode = el.instance && el.instance.rootNode;
  if (rootNode) {

    // attach handle if needed. attach this instance to its parent instance
    rootNode.handle && this.parent._attachCompHandle( this, rootNode.handle );

    // this is the root element of the component, so any attributes
    // attached to the component node should be transfered to its root element
    // populate the attributes of the element
    const calcs = rootNode.calculate;

    calcs && Object.keys( calcs )
      .filter( attr => ! seen[attr] )
      .forEach( attr => {
        seen[attr] = true;
        if (attr.match( /^(textContent|innerHTML)$/)) {
          el[attr] = calcs[attr](this);
        } else {
          el.setAttribute( attr, calcs[attr](this) );
        }
      } );

    const attrs = rootNode.attrs;
    attrs && Object.keys( attrs )
      .filter( attr => ! seen[attr] )
      .forEach( attr => {
        seen[attr] = true;
        if (attr.match( /^(textContent|innerHTML)$/)) {
          el[attr] = attrs[attr];
        } else {
          el.setAttribute( attr, attrs[attr] );
        }
      } );
  }
  
  const calcs = node.calculate;
  calcs && Object.keys( calcs )
    .filter( attr => ! seen[attr] )
    .forEach( attr => {
      seen[attr] = true;
      if (attr.match( /^(textContent|innerHTML)$/)) {
        el[attr] = calcs[attr](this);
      } else {
        el.setAttribute( attr, calcs[attr](this) );
      }
    } );

  const attrs = node.attrs;
  attrs && Object.keys( attrs )
    .filter( attr => ! seen[attr] )
    .forEach( attr => {
      seen[attr] = true;
      if (attr.match( /^(textContent|innerHTML)$/)) {
        el[attr] = attrs[attr];
      } else {
        el.setAttribute( attr, attrs[attr] );
      }
    } );

  return needsInit;
} //_refresh_element

function refresh(node,el,internalContent,isAliased) {

  const needsInit = this._refresh_element( node, el );
  
  // create elements as needed here, even if hidden
  // make sure if then else chain is good
  node.contents && this._refresh_content( node.contents, el );
  if (internalContent) {
    const innerContainer = findInternalContent( el );
    if (this.parent && ! isAliased) {
      this.parent._refresh_content( internalContent, innerContainer );
    } else {
      this._refresh_content( internalContent, innerContainer );
    }
  }

  needsInit && this._resolve_onLoad(el);

} //refresh

function _resolve_onLoad(el) {
  // 
  const rootNode = el.instance && el.instance.rootNode;
  if (rootNode) {
    this.recipe.onLoad && Promise.resolve( this.preLoad )
      .then (() => this.recipe.onLoad( this ) );
    // check for listeners

    const instance = this.parent;
    rootNode.on && Object.keys( rootNode.on )
      .forEach( evname => {
        // so a componentInstance uses 'event' to send a message
        // to its listeners
        const evfun = function() {
          const prom = rootNode.on[evname]( instance, ...arguments );
          // resolve in case it returns undefined or returns a promise
          Promise.resolve( prom )
            .then( () => {
              if ( instance._check() ) instance.refresh();
            } );
        };

        // update component instance event listeners
        this.eventListeners[evname] = this.eventListeners[evname] || [];
        this.eventListeners[evname].push( evfun );
      } );
  }

} //refresh

function _refresh_component( compo, el, recipe ) {
  // component
  const aliased = recipe.aliasedRecipe;
  if (aliased) {
    const root = aliased.contents[0];
    if (root.isComponent) {
      this._refresh_component( root, el, aliased );
    }
    if (root.content && root.content.length > 0) {
      this._refresh( root, el, root.content.length );
    } else {
      this._refresh_element( root, el );
    }
    el.instance._refresh( compo, el, recipe.contents[0].contents, true );
    return;
  }
  el.instance._refresh( compo.recipe.rootElementNode, el, compo.contents );

} //_refresh_component

function _refresh_content(content, el) {
  const recipe = this.recipe;
  const namespace = recipe.namespace;

  // gather the child nodes under this element
  const key2el = makeKey2el( el );

  // check if/elseif/else integrity
  // make sure elements are there

  let lastWasConditional = false,
      conditionalDone = false,
      lastConditionalWasTrue = false;

  content.forEach( (con,idx) => {
    let key = this._key( con );

    let conEl = key2el[key];

    // if there was not an element here, make it
    // and hide it
    if (!conEl) {
      const recipe = this.recipe.namespace.findRecipe( con.tag );

      if (recipe) {
        // needs a new instance
        const conInst =
              this._key2instance[key] = newInstance( recipe, this, con );
        conEl = conInst._new_el( conInst.recipe.rootElementNode, key, el );
        conEl.instance = conInst;
        conInst.rootEl = conEl;
        
      } else {
        conEl = this._new_el( con, key, el );
      }
      conEl.style.display = 'none';
      key2el[key] = conEl;
    }

    if (con.if) {
      lastWasConditional = true;
      conditionalDone = lastConditionalWasTrue = con.if(this);
      conEl.dataset.ifCondition = conditionalDone;

    } else if (con.elseif) {
      if (! lastWasConditional ) {
        throw new Error( `elseif must be preceeded by if or elseif in file '${namespace.filename}' and recipe '${recipe.name}'` );
      }
      if (conditionalDone) {
        lastConditionalWasTrue = false;
        conEl.dataset.elseIfCondition = 'n/a';
      } else {
        conditionalDone = lastConditionalWasTrue = con.elseif( this );
        conEl.dataset.elseIfCondition = conditionalDone;
      }
    } else if ( con.else ) {
      if (! lastWasConditional ) {
        throw new Error( `else must be preceeded by if or elseif in file '${namespace.filename}' and recipe '${recipe.name}'` );
      }
      if (conditionalDone) {
        lastConditionalWasTrue = false;
        conEl.dataset.else = false;
      } else {
        lastConditionalWasTrue = true;
        conEl.dataset.else = true;
      }
    } else {
      lastWasConditional = false;
    }

    if (lastWasConditional === false || lastConditionalWasTrue) {
      // show this element
      conEl.style.display = null;

      if (con.foreach) {
        // remove extras but never the first index
        const forval = con.forval;
        const list = con.foreach( this );
        const upto = conEl.lastcount || 0;
        this._loop_level++;
        
        // remove any that are more than the list count
        if (upto > list.length) {
          for (let i=list.length === 0 ? 1 : list.length; i<upto; i++) {
            conKey = this._key( con, i );
            const itEl = key2el[conKey];
            itEl && itEl.remove();
          }
        }
        conEl.lastcount = list.length;

        if (list.length === 0) {
          // nothing to display, so hide the zero indexed foreach
          conEl.style.display = 'none';
        } else {
          // make sure each foreach list item is populated
          // for those that are for instances, they each get their
          // own instance
          let lastEl;
          const forInstances = [];
          for (let i=0; i<list.length; i++ ) {
            // set the iteration temporary variables
            this.idx[forval] = i;
            this.it[forval] = list[i];

            const forKey = this._key( con, i );

            let forEl = key2el[forKey];

            if (con.isComponent) {
              let forInstance = this._key2instance[ forKey ];

              if (!forInstance) {
                const recipe = this.recipe.namespace.findRecipe( con.tag );
                forInstance = newInstance( recipe, this, con );
                forEl = i == 0 ? forInstance._new_el( forInstance.recipe.rootElementNode, forKey, el ) : forInstance._new_el( forInstance.recipe.rootElementNode, forKey, undefined, lastEl );
                forInstance.rootEl = forEl;
                forEl.instance = forInstance;
                this._key2instance[ forKey ] = forInstance;
              }
              forInstances.push( forInstance );

              forInstance.idx[forval] = i;
              forInstance.it[forval] = list[i];

              forInstance._refresh( con.recipe.rootElementNode, forEl, con.contents );
            } 
            else { //is element
              forEl = forEl || ( i == 0 ? this._new_el( con, forKey, el ) :
                                 this._new_el( con, forKey, undefined, lastEl ) );
              this._refresh( con, forEl );
            }
            lastEl = forEl;

          } //foreach list item

          // reset it and idx back to undefined
          this.idx[forval] = undefined;
          this.it[forval] = undefined;
          forInstances.forEach( fi => { fi.it[forval] = undefined; fi.idx[forval] = undefined } );
          this._loop_level--;
        }
      } //has a foreach 

      // not in foreach 
      else if (con.isComponent) {
        conEl.instance._refresh_component( con, conEl, con.recipe );
      } else {
        // normal element
        this._refresh( con, conEl );
      }

    } else { // ELEMENT NOT DISPLAYED
      conEl.style.display = 'none';

      if (con.handle) {
        if (con.isComponent) {
        
        } else {
          delete this.el[con.handle];
        }
      }

      // remove handles
      delete this.el[key];

      if (con.foreach) {
        // remove all but first loop entry
        for (let i=1; i<conEl.lastcount; i++) {
          const forKey = this._key( con, i );
          const forEl = key2el[forKey];
          forEl && forEl.remove();
          delete this._key2instance[ forKey ];
        }
      }
    }

  } ); //each content item

} //_refresh_content

const _new_el = (node,key,attachToEl, attachAfterEl) => {
  const tag = node.tag;
  const newEl = document.createElement( tag );
  if (node.internalContent) {
    newEl.internalContent = newEl.dataset.internalContent = true;
  }
  newEl.key = newEl.dataset.key = key;
  if (attachAfterEl) {
    attachAfterEl.after( newEl );
  } else {
    attachToEl.append( newEl );
  }
  return newEl;
}; //_new_el

const makeKey2el = el => {
  const key2el = {};
  Array.from( el.children )
      .forEach( el => el.key && ( key2el[el.key] = el ) );
  return key2el;
}; //makeKey2el

console.warn( 'TODO: should listens be additive? that is, run listen code for recipe and for the node? also make class attribute additive?' );
