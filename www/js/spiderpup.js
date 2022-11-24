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

window.onload = ev => {
  init( filespaces, funs, defaultFilename );
}

// init takes spaces and funz as an argument
// to allow tests
const init = (spaces,funz,defFilename) => {
  filespaces = spaces;
  funs = funz;
  defaultFilename = defFilename;

  console.log( filespaces, `FILESPACES default is '${defaultFilename}'` );

  // see if the module requested has a body to render.
  // if not, then loading this does nothing
  const defaultNamespace = prepNamespace( filespaces[defaultFilename], defaultFilename );
  const html = filespaces[defaultFilename].html;
  if (!(html && html.body)) {
    console.warn( `no body defined in '${defaultFilename}'` );
    return;
  }  

  // prep and connect the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      const namespace = prepNamespace( filespaces[filename], filename );
      namespace.namespaces = namespace.namespaces || {};
      Object.keys( namespace.namespaces )
        .forEach( alias => (namespace.namespaces[alias] =
                            filespaces[namespace.namespaces[alias]]) );
    } );

  // finalize the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      finalizeNamespaces( filespaces[filename], filename );
    } );

  // html is a recipe too, containing one thing in contents, the body
  const htmlRecipe = prepRecipe( { tag: 'html', contents: [{ tag: 'body', contents: html.body.contents}] }, 'html', defaultNamespace );
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
  const bodyKey = bodyInstance.key();
  document.body.key = document.body.dataset.key = bodyKey;

  bodyInstance.refresh();

  return bodyInstance;
}; //init




// setup the namespace, attach methods, prep all the recipes inside, and verify their names
const prepNamespace = (namespace,filename) => {
  prepNode( namespace, 'namespace' );
  namespace.filename = filename;

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
      return this.namespaces[tagParts[0]].findRecipe( tagParts[1] );
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
      finalizeRecipe( recipeName );
    } );
}; //finalizeNamespaces





// ready this recipe node
const prepRecipe = (recipe,name,namespace) => {
  if (recipe.contents.length !== 1) {
    throw new Error( `recipe must contain exactly one root element for '${name}' in '${namespace.filename}'` );
  }
  prepNode( recipe, 'recipe', namespace );
  recipe.namespace = namespace;
  recipe.name = name;

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

  // check if this recipe is in fact an alias to a different recipe
  let aliasRecipe = recipe;
  const seen = {};
  let aliasedRecipe = namespace.findRecipe( aliasRecipe.contents[0].tag );
  while( aliasedRecipe ) {
    if (seen[aliasedRecipe.id]) {
      throw new Error( `cyclic recipe dependency found in ${recipe.name} in namespace ${namespace.filename}` );
    }
    if (! aliasedRecipe.isFinalized) {
      finalizeRecipe( aliasedRecipe );
    }
    seen[aliasedRecipe.id] = true;
    root = aliasedRecipe.contents[0];
    attachFunctions( aliasRecipe, aliasedRecipe );
    attachData( aliasRecipe, aliasedRecipe );
    aliasedRecipe = aliasedRecipe.namespace.findRecipe( aliasRecipe.contents[0].tag );
  }

  // set up the rest from the original namespace
  recipe.isFinalized = true;
  recipe.rootElementNode = root;
  attachFunctions( recipe, namespace );
  attachData( recipe, namespace );
  prepContents( [root], namespace );

  return recipe;
  
} //finalizeRecipe

const newBodyInstance = recipe => {
  const instance = newInstance(recipe);
  instance.refresh = function() {
      // refresh the contents of the body
      this._refresh( recipe.contents[0], document.body, recipe.contents[0].contents );
  };
  return instance;
}; //newBodyInstance

const newInstance = (recipe,parent) => {
  const instance = {
    recipe,
    parent,

    refresh: function(el) {
      this._refresh( recipe, el );
    }, //refresh

    _refresh: refresh,
    _refresh_content: refresh_content,
    _make_el: makeEl,

    _key2instance: {},

    key: function(node,idxOverride) {
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
  };

  prepNode( instance, 'instance', recipe );
  attachFunctions( instance, parent || recipe );
  attachData( instance, parent || recipe );

  // copy data from the recipe
  instance._data = {...recipe.data};
  
  instance.set = function(k,v) {
    this._changed = this._changed || v !== this._data[k];
    this._data[k] = v;
    return this;
  };
  instance.get = function(k,defVal) {
    if (k in this._data) return dataVal( this._data[k], instance );
    let val = this.parent && this.parent.get( k );
    if (val === undefined && defVal !== undefined) {
      val = this._data[k] = defVal;
    }
    // data can be a value or a function. if a function, run it to
    // get the data
    return dataVal( val, instance );
  };
  instance._check = function() {
    const changed = this._changed;
    this._changed = false;
    return changed;
  }

  return instance;
}; //newInstance



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
        .forEach( funname => node[funhash][funname] = node[funtype][funname] || funhash[funname]  )
    } );
}; //attachFunctions

const attachData = (node,parent) => {
  Object.keys( parent.data )
    .forEach( fld => 
      (node.data[fld] = fld in node.data ? node.data[fld] : parent.data[fld])
    );
}; //attachData

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
    node.fun = node.functions || {};
    node.data = node.data || {};
    prepData( node.data );
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
      if (namespace.findRecipe(con.tag)) {
        prepComponentNode( con, namespace );
      } else {
        prepElementNode( con, namespace );
      }
    } );
};

const prepComponentNode = (node,namespace) => {
  prepDescriptiveNode( node, 'element' );
  prepContents( node.contents, namespace );
};


const prepElementNode = (node,namespace) => {
  prepNode( node, 'element' );  
  prepContents( node.contents, namespace );
}

function _installElement( node, key, attachToEl, attachAfter ) {
    const tag = getTag(node);
    const newEl = document.createElement( tag );
    if (node.internalContent) {
      newEl.internalContent = true;
    }
    newEl.key = key;
    newEl.dataset.key = key;
    if (node.handle) {
      if (instance._loop_level > 0) {
        if (! Array.isArray( instance.el[node.handle])) {
          const old = instance.el[node.handle];
          instance.el[node.handle] = [];
          if (old) {
            instance.el[node.handle][0] = old;
            old.dataset.handle = `${node.handle} [0]`;
          }
        }
        const idx = instance.el[node.handle].length;
        instance.el[node.handle].push( newEl );
        newEl.dataset.handle = `${node.handle} [${idx}]`;
      } else {
        instance.el[node.handle] = newEl;
        newEl.dataset.handle = node.handle;
      }
    }
    if (attachAfter) {
      attachToEl.after( newEl );
    } else {
      attachToEl.append( newEl );
    }
    newEl.style.display = 'none';

    return newEl;
}

function refresh(node,el,content) {
  content = content || node.content || [];
  
  // el must have a value if it has gotten to this point

  // an element that needs init has no handlers and stuff
  // so attach those now
  const needsInit = !!!el.hasInit;
  if (needsInit) {
    el.hasInit = true;
    
    // attach element event handlers once
    if (node.on) {
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
  
  // populate the attributes of the element
  node.calculate && Object.keys( node.calculate )
    .forEach( attr => {
      if (attr.match( /^(textContent|innerHTML)$/)) {
        el[attr] = calcs[attr](instance);
      } else {
        el.setAttribute( attr, calcs[attr](instance) );
      }
    } );

  node.attrs && Object.keys( node.attrs )
    .forEach( attr => {
      if (attr.match( /^(textContent|innerHTML)$/)) {
        el[attr] = node.attrs[attr];
      } else {
        el.setAttribute( attr, node.attrs[attr] );
      }
    } );
  
  // create elements as needed here, even if hidden
  // make sure if then else chain is good
  node.contents && this._refresh_content( node.contents, node, el );

} //refresh

function refresh_content(content, node, el) {
  const recipe = this.recipe;
  const namespace = recipe.namespace;

  // gather the child nodes under this element
  const key2el = makeKey2el( el );

  // check if/elseif/else integrity
  // make sure elements are there

  let lastWasIfElse = false,
      lastWasIf = false;

  content.forEach( con => {
    if ( con.else ) {
        if (! (lastWasIf  || lastWasIfElse )) {
          throw new Error( `else must be preceeded by if or elseif in file '${namespace.filename}' and recipe '${recipe.name}'` );
        }
      lastWasIfElse = lastWasIf = false;
    }
    else if (con.elseif) {
      if (! (lastWasIf  || lastWasIfElse )) {
        throw new Error( `elseif must be preceeded by if or elseif in file '${namespace.filename}' and recipe '${recipe.name}'` );
      }
      lastWasIfElse = true;
      lastWasIf = false;
    }
    else if (con.elseif) {
      lastWasIf = true;
      lastWasIfElse = false;
    }
    let key = this.key( con );
    let conEl = key2el[key];
    if (!conEl) {
      const recipe = this.recipe.namespace.findRecipe( con.tag );
      if (recipe) {
        // needs a new instance
        const conInst = 
              this._key2instance[key] = newInstance( recipe, this );
        conEl = this._make_el( conInst.recipe.rootElementNode.tag, key, el );
      } else {
        conEl = this._make_el( con.tag, key, el );
      }
      this._refresh( con, conEl ); 
    }
  } );
} //refresh_content

const makeEl = (tag,key,attachToEl, attachAfterEl) => {
  const newEl = document.createElement( tag );
  if (attachAfterEl) {
    attachAfterEl.after( newEl );
  } else {
    attachToEl.append( newEl );
  }
  return newEl;
}; //makeEl

const makeKey2el = el => {
  const key2el = {};
  Array.from( el.children )
      .forEach( el => el.key && ( key2el[el.key] = el ) );
  return key2el;
}; //makeKey2el

