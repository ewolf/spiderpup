/*
ABOUT -----------------------------

 Convert a json data structure into a 
 Single Application Page on top of very simple html
 that includes a head and empty body.

INIT -------------------------------

 The init takes a json data structure and
 default filename.

 The json data structure is a hash of filenames to
 namespace objects. The default filename corresponds
 to the namespace object that is used to attach the
 body component to the document.

 Init 'preps' each namespace, adding functions and
 fields as it goes. It connects namespaces together
 via aliases defined in their 'namespaces' field.

   * parses and adds to the data structure
   * attaches styles, css links and script tags to the head
   * instantiates a body instance object
   * calls refresh on the body instance object

 NAMESPACE DATA STRUCTURE --------------------------

   a namespace has the following fields:
     components -> { name       -> component }
     namespaces -> { localname  -> namespace }
     functions  -> { name       -> function }
     data       -> { field      -> value or once computed function }
     include    -> { css        -> [urls],
                     javascript -> [urls] }
     html       -> {
         head -> {
           script -> text
           title  -> string
           style  -> text
         }
         body -> {
           onLoad   -> function
           on       -> { eventname -> function }
           contents -> [ element|component instance node...]
           listen   -> function
         }
        }
  fields computed/added compile time:
     type        -> 'namespace'
     isNamespace -> true
     id          -> serialized field
     fun         -> copy of functions
     filename    -> filename this namespace is from
     name        -> namespace name for debugging
     set         -> function
     get         -> function
     has         -> function
     _check      -> function
     findRecipe  -> function
     key         -> uniquely identify this node
     dataFunctions -> { filled with data -> function (for functions in data) }


 COMPONENT (RECIPE) DATA STRUCTURE -----------------------
 
  a component (recipe) node has the following fields:
    functions  -> { name -> function }
    data       -> { field -> value }
    onLoad     -> function
    on         -> { event -> function }
    listen     -> function
    contents   -> [content node] (may only have one content node)
    attrs      -> { attributename -> value or function }
  fields computed/added compile time:
     type            -> 'recipe'
     isRecipe        -> true
     id              -> serialized field
     fun             -> copy of functions
     namespace       -> namespace object
     parent          -> namespace object
     name            -> name of recipe
     aliasedRecipe   -> recipe object if the first content node 
                        is not an element but is a recipe. 
                        these may chain
     isFinalized     -> true
     rootElementNode -> the first (and only) entry in the contents list
    

 
 ELEMENT DATA STRUCTURE -----------------------

 an element node has the following fields:
   tag              -> element tagname
   contents         -> [element or component instance, element or component instance, ... ]
   handle           -> handle name for instance.el hash
   if|elsif|foreach -> function
   else             -> true
   forval           -> looping variable name
   on               -> { element event name -> event function }
   fill             -> true|<name> where true is the default fill for a 
                       component and a name connects to fill_contents
   attrs            -> { attributename -> value or function }
  fields computed/added at compile time:
     type            -> 'element'
     isElement       -> true
     id              -> serialized field
     recipe          -> recipe object this is content of
  fields computed/added at generate time:

 COMPONENT INSTANCE DATA STRUCTURE -----------------------

 a component instance node has the following fields:
   tag              -> name of recipe
   contents         -> [element or component instance, element or component instance, ... ]
   handle           -> handle name for instance.comp hash
   if|elsif|foreach -> function
   else             -> true
   forval           -> looping variable name
   on               -> { component event name -> event function }
   attrs            -> { attributename -> value or function }
   fill_contents    -> { filltargetname -> [ element or component instances ] }
  fields computed/added at compile time:
     type            -> 'component'
     isComponent     -> true
     id              -> serialized field
     recipe          -> a link to the recipe that it is attached to
 
 THE BODY INSTANCE

  the body is a special recipe. if the default namespace has html->body,
  an instance object will be created for it and attached to the
  html document.body element, and the _refresh method on the instance
  will be called.

 REFRESHING AN INSTANCE

   The instance data structure is created on refresh. foreach iterations
   each have their own instance data structures. instances in foreach iterations
   beyond the first iteration may be destroyed and recreated as refresh is 
   called to a parend instance.


 INSTANCE DATA STRUCTURE -----------------------------------------
   recipe   -> recipe object
   parent   -> parent instance, or if the body instance, the default namespace
   name     -> string `instance of recipe foo` or `instance of recipe foo in (parent name)`
   rootNode -> (if not the body instance) component instance object
   el       -> { handle -> html element }
   comp     -> { handle -> instance object }
   _loop_level -> number (temporary foreach var)
   idx      -> { iterator name -> iterator index }  (temporary foreach var)
   it       -> { iterator name -> iterator value }  (temporary foreach var)
   on       -> { event name -> function }
   broadcast -> function( act, msg )
   _propagateBroadcast -> function( act, msg )
   handleEvent -> function( event, result )
   event -> function(event,result)  ->  initiates the event
   broadcastListener -> function to handle broadcasts
   fun  -> { functionname -> function }
   refresh -> function that refreshes this instance and all 
              child instances under it
   _refresh -> refresh function( node, element )
   _refresh_content -> function( content, elelement ) - refreshes the content instance node
   _refresh_component -> function( component, element, recipe )
   _new_el -> function(node,key,attachToEl,attachAfterEl)
   _refresh_element -> function(node,element)
   _resolve_onLoad -> function
   _key2instance -> { key string -> instance object }
   _key -> function( node, idxOverride ) - returns a key for the node
                                           the node is inside this instance
   _attachElHandle -> function( el, handle ) attaches an element to this
                      instance by given handle
   _attachCompHandle -> function( component, handle ) attaches a
                      component to this instance by given handle
   top -> the body instance this instance is ultimetly contained in
   type -> 'instance'
   isInstance -> true
   id -> serialized id
   data -> { fieldname -> value } * inherited from parent if the fieldname is not defined in the component instance node
   set         -> function
   get         -> function
   has         -> function
   _check      -> function
   rootEl      -> html element that is the top container for this component instance

 HTML ELEMENT FIELDS ADDED -----------------------------------
   hasInit -> true when this element has undergone init process
   (event handlers) -> as per recipe element node definitions
   instance -> (just for rootEl of instance), the instance object
   style
     display -> 'none' (removed when element is to be displayed)
   dataSet
     key -> result of _key
     ifCondition -> true|false if the condition test has been met
     elseIfCondition -> 'n/a' if condition above it has been met
                        so test was not performed, 
                        otherwise true|false for result of condition
     else            -> true when no condition met, false otherwise
     fill            -> if this is a container that takes fill

 element events
   these are handled on the element itself with the instance as 
   the first parameter and event as the second

 broadcasts
   easy, broadcasts are heard by all listeners

 component events
   these are a bit tricker. events bubble up from one component
   instance to its parent. the event should be patterend off of the 
   element event with a stopPropagation and preventDefault possibly,
   however the difficulty comes in when one recipe basically inherets
   from an other by having its root content node be an other recipe


 UPDATES
   when refresh is called on an instance, all instances inside it
   have their refresh called.

   an instance refresh starts with their rootEl html element refresh.
   refresh sets up vent listeners handles, updates classes, 
   textContent|innerHTML|fill, and attributes, calling functions for
   those values if functions provide them, or using the values provided
   otherwise.

   once the root element has been refreshed, the content that it contains
   is also refreshed.

   if this is the first time the instance was refreshed, onLoad is called
   as the last part of the rfresh

 */


// ----------------------------------------------------------------------------------------------------
//                               BOOTSTRAP
// ----------------------------------------------------------------------------------------------------

window.onload = ev => {
  init( filespaces, defaultFilename );
}

let defaultNamespace;

// init takes spaces and funz as an argument
// to allow tests
const init = (spaces,defFilename) => {
  filespaces = spaces;
  defaultFilename = defFilename;

  console.log( spaces, defFilename );

  // see if the module requested has a body to render.
  // if not, then loading this does nothing
  const htmlNode = filespaces[defaultFilename].html;
  if (!(htmlNode && htmlNode.body)) {
    console.warn( `no body defined in '${defaultFilename}'` );
    return;
  }

  defaultNamespace = filespaces[defaultFilename];

  // prep and connect the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      const namespace = prepNamespace( filespaces[filename], filename );
      namespace.namespaces = namespace.namespaces || {};
      Object.keys( namespace.namespaces )
        .forEach( alias => (namespace.namespaces[alias] =
                            filespaces[namespace.namespaces[alias]]) );
      // if (filename !== defaultFilename) {
      //   namespace.parent = defaultNamespace;
      // }
    } );

  // finalize the namespaces
  Object.keys( filespaces )
    .forEach( filename => {
      finalizeNamespaces( filespaces[filename], filename );
    } );

  // html is a recipe too, containing one thing in contents, the body
  const htmlRecipe = {...htmlNode.body};
  htmlRecipe.tag = 'html';


  const primeNode = defaultNamespace.findRecipe( htmlNode.body.contents[0].tag );
  if (htmlNode.body.contents.length === 1 && primeNode && primeNode.rootElementNode.tag === 'body') {
    htmlRecipe.contents = [{ tag: 'document', contents: htmlNode.body.contents}];
  } else {
    htmlRecipe.contents = [{ tag: 'document', contents: [{ tag: 'body', contents: htmlNode.body.contents}]}];
  }

  prepRecipe( htmlRecipe, 'html', defaultNamespace );
  finalizeRecipe( htmlRecipe );

  // there may be a head that has javascript/css imports
  // and explicit style and a title
  if (htmlNode.head) {
    const head = document.head;
    document.title = htmlNode.head.title || '';

    // explicit style
    let style = htmlNode.head.style
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
    let script = htmlNode.head.script
    if (script) {
      const scriptel = document.createElement( 'script' );
      scriptel.setAttribute( 'type', 'text/javascript' );
      scriptel.appendChild(document.createTextNode(script));
      head.appendChild( scriptel );
    }

    // css files
    const css = htmlNode.head.css;
    const cssFiles = Array.isArray( css ) ? css : css ? [css] : [];
    cssFiles.forEach( file => {
      const link = document.createElement( 'link' );
      link.setAttribute( 'rel', 'stylesheet' );
      link.setAttribute( 'media', 'screen' );
      link.setAttribute( 'href', file );
      head.appendChild( link );
    } );

    // js files
    const js = htmlNode.head.javascript;
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
        throw new Error( `requested namespace '${tagParts[0]}' that was not imported` );
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
    // store data functions in backup hash
    namespace.dataFunctions = {};
    namespace.data && Object.keys(namespace.data)
      .filter( dk => typeof namespace.data[dk] === 'function' )
      .forEach( dk => {
        namespace.dataFunctions[dk] = namespace.data[dk];
        namespace.data[dk] = namespace.dataFunctions[dk](namespace);
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

  let aliasedRecipe = namespace.findRecipe( root.tag );
  if (aliasedRecipe) {
    recipe.aliasedRecipe = aliasedRecipe;
    if (! aliasedRecipe.isFinalized) {
      finalizeRecipe( aliasedRecipe );
    }
    root = aliasedRecipe.rootElementNode;
    attachFunctions( recipe, aliasedRecipe );
    recipe.parent = aliasedRecipe;
    attachData( recipe, aliasedRecipe );
    
    attachFunctions( recipe, root );
    attachData( recipe, root );
  }


  // set up the rest from the original namespace
  recipe.isFinalized = true;
  recipe.rootElementNode = root;
  attachFunctions( recipe, namespace );
  prepContents( recipe.contents, namespace );

  // if class is specified here
  if ( recipe.attrs ) {
    root.attrs = root.attrs || {};
    Object.keys(recipe.attrs).forEach (attr => {
      const val = recipe.attrs[attr];
      if (attr === 'class') {
        // class is additive and applies to the root element
        root.attrs[attr] = root.attrs[attr] ? [root.attrs[attr], val].join( ' ' ) : val;
      } else {
        // other attributes do not override the attribute (should they?)
        root.attrs[attr] = attr in root.attrs ? root.attrs[attr] : val;
      }
    } );
  }

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
    this._refresh( recipe.contents[0], document );
  };

  instance.loadPromise = Promise.resolve( instance.preLoad )
    .then(() => recipe.onLoad && recipe.onLoad(instance));

  return instance;
}; //newBodyInstance


// ----------------------------------------------------------------------------------------------------
//                               INSTANCE LOGIC
// ----------------------------------------------------------------------------------------------------


const newInstance = (recipe,parent,node) => {

  if (recipe.aliasedRecipe) {
//    debugger;
    //  example:
    //    loginForm is an alias of forminput which has on_submit in
    //    its recipe instance 
    // 
    //
    // the aliased recipe is going to make the parent instance
    //parent = newInstance(recipe.aliasedRecipe,parent,node);
    //    recipe = recipe.aliasedRecipe;

    // 

    //console.warn( "SO, should aliasedRecipes have multiple instances, and which direction should they bubble up and/or down?" );
  }


  let instance = {
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
    on: {}, //handler -> function

    // broadcasts a message. refreshes if there were any listeners
    broadcast: function( act, msg ) {
      this.top._propagateBroadcast(act,msg) && this.top.refresh();
    },
    _propagateBroadcast: function(act, msg) {
      let needsRefresh = false;
      this.broadcastListener && this.broadcastListener(this,act, msg ) && (needsRefresh = true);
      // propagates here and each child with the given message
      Object.values( this._key2instance ).forEach( c => c._propagateBroadcast(act,msg) && (needsRefresh=true) );
      return needsRefresh;
    },

    handleEvent: function(event,result) {
      console.log( this.name );

      const listener = this.on && this.on[event];
      const handled = listener && listener( this, result );
      if (handled) {
        this._check() && this.refresh();
      }
      else if (this.parent 
            && this.parent.handleEvent 
            && this.parent.handleEvent(event,result) ) {
        this.parent._check() && this.parent.refresh();
      }
    },

    event: function(event,result) {
      this.parent && this.parent.handleEvent( event,result );
    },

    broadcastListener: (node && node.listen) || recipe.listen,

    // instance functions
    fun: {}, 

    // TODO: should listens be additive? that is, run
    // listen code for recipe and for the node?
    // also make class attribute additive?
    //    broadcastListener: node.listen || recipe.listen,

    refresh: function() {
      this._refresh( this.recipe.contents[0], this.rootEl );
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
    }, //_key

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

  //
  // if the recipe is an aliased recipe from an other namespace
  // connect the namespace top to the parent 
  // instance.
  // 
  if (instance.recipe.namespace !== defaultNamespace) {
    const oldget = instance.get;
    instance.get = function(k,defVal) {
      let val = oldget(k);
      if (val === undefined) {
        val = parent.get(k);
      }
      if (val === undefined && defVal !== undefined) {
        val = this.data[k] = defVal;
      }
      return val;
    };
  }

  prepNode( instance, 'instance', recipe );

  if (node) {
    attachFunctions( instance, node );
    attachData( instance, node );
  }

  if (recipe.rootElementNode) {
    console.log( recipe.rootElementNode.on );
//    attachFunctions( instance, recipe.rootElementNode );
//    attachData( instance, recipe.rootElementNode );
  }

  attachFunctions( instance, recipe );
  attachData( instance, recipe );
  if (parent) {
    attachFunctions( instance, parent );
    attachForFields( instance, parent );
  }

  // store data functions in backup hash
  instance.dataFunctions = {};
  instance.data && Object.keys(instance.data)
    .filter( dk => typeof instance.data[dk] === 'function' )
    .forEach( dk => instance.dataFunctions[dk] = instance.data[dk] );

  
  // attach instance wrapped functions
  Object.keys( instance.functions )
    .forEach( funname => {
      const fun = instance.functions[funname];
      instance.fun[funname] = function() { return fun(instance, ...arguments ) }
    } );
  delete instance.functions;

  attachGetters( instance );

  if (recipe.aliasedRecipe) {
    // the aliased recipe is going to make the parent instance
//    instance = newInstance(recipe.aliasedRecipe,instance,node);

    // 

    console.warn( "SO, should aliasedRecipes have multiple instances, and which direction should they bubble up and/or down?" );
  }
  if (recipe.aliasedRecipe) {
//    debugger;
  }
  recipe.preLoad && (instance.preLoad = recipe.preLoad(instance)); 

  return instance;
}; //newInstance

const attachGetters = node => {
  node.set = function(k,v) {
    this._changed = this._changed || v !== this.data[k];
    this.data[k] = v;
    return v;
  };
  node.has = function(k) {
    return (k in this.data) || this.parent && this.parent.has( k );
  };

  node.get = function(k,defVal) {
    if (k in this.data) return this.data[k];
    let val = this.parent && this.parent.get( k );
    if (val === undefined && defVal !== undefined) {
      val = this.data[k] = defVal;
    }
    // data can be a value or a function. if a function, run it to
    // get the data
    return val;
  };
  node._check = function() {
    const changed = this._changed;
    this._changed = false;
    return changed;
  }
  
};

// serial is an int that serializes all the nodes.
let serial = 1;

// attach functions from the
// parent node of this one, be it namespace, recipe or instance
// node
const attachFunctions = (node,parent) => {
  [ 'on', 'functions', 'fun' ]
    .forEach( funtype => {
      const funhash = parent[funtype];
      funhash && Object.keys(funhash)
        .forEach( funname => node[funtype][funname] = node[funtype][funname] || funhash[funname]  )
    } );
}; //attachFunctions

const attachData = (node,parent) => {
  parent.data && Object.keys( parent.data )
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
}; //attachForFields

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

  node.on = node.on || {};

  if (type !== 'element') {
    node.fun = node.functions = node.functions || {};
    node.data = node.data || {};
  }

  return node;
} //prepNode

// data may be obtained from a function or a value
const dataVal = (v,s) => typeof v === 'function' ? v(s) : v;

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
  node.fill_contents && 
    Object.keys(node.fill_contents)
    .forEach( targ => {
      prepContents( node.fill_contents[targ], namespace );
    } );
};


const prepElementNode = (node,namespace) => {
  prepNode( node, 'element' );
  prepContents( node.contents, namespace );
}

const findFill = (el,name,recur) => {
  if (name !== undefined) {
    if ( el.fill === name ) return el;
    const chilInts = Array.from( el.children || [] )
          .map( chld => findFill( chld, name, true ) )
          .filter( chld => chld !== undefined );

    if (chilInts.length > 0) {
      return chilInts[0];
    }
  } else {
    if ( el.fill === true ) return el;
    const chilInts = Array.from( el.children || [] )
          .map( chld => findFill( chld, name, true ) )
          .filter( chld => chld !== undefined );
    
    if (chilInts.length > 0) {
      return chilInts[0];
    }
  }

  if (name === undefined && !recur) {
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

    const attrs = rootNode.attrs;
    attrs && Object.keys( attrs )
      .filter( attr => ! seen[attr] )
      .forEach( attr => {
        seen[attr] = true;
        const val = dataVal( attrs[attr], this );
        if (attr.match( /^(textContent|innerHTML|fill)$/)) {
          el[attr] = val;
        } else if (attr === 'class' ) {
          val.split( /\s+/ ).forEach( cls => el.classList.add( cls ) );
        } else {
          el.setAttribute( attr, val );
        }
      } );
  }
  
  const attrs = node.attrs;
  attrs && Object.keys( attrs )
    .filter( attr => ! seen[attr] )
    .forEach( attr => {
      seen[attr] = true;
      const val = dataVal( attrs[attr], this );
      if (attr.match( /^(textContent|innerHTML|fill)$/)) {
        el[attr] = val;
        } else if (attr === 'class' ) {
          val.split( /\s+/ ).forEach( cls => el.classList.add( cls ) );
      } else {
        el.setAttribute( attr, val );
      }
    } );

  return needsInit;
} //_refresh_element

// attached to an instance, refreshes it and any child
// instances it has
function refresh(node,el,placeholderNode,isAliased) {

  const needsInit = this._refresh_element( node, el );
  
  // create elements as needed here, even if hidden
  // make sure if then else chain is good

  node.contents && node.contents.length > 0 && this._refresh_content( node.contents, el );

  if (placeholderNode) {
    placeholderNode.fill_contents && 
      Object.keys( placeholderNode.fill_contents )
      .forEach( ph => {
        const phContainer = findFill( el, ph );
        if (phContainer) {
          const contents = placeholderNode.fill_contents[ph];
          console.warn( "IS ALIASED? LOOK HERE" );
          if (this.parent && ! isAliased) {
            this.parent._refresh_content( contents, phContainer );
          } else {
            this._refresh_content( contents, phContainer );
          }
        }
      } );


    const placeholder = placeholderNode.contents;
    if (placeholder) {
      const innerContainer = findFill( el );
      if (this.parent && ! isAliased) {
        this.parent._refresh_content( placeholder, innerContainer );
      } else {
        this._refresh_content( placeholder, innerContainer );
      }
    }
  }

  needsInit && this._resolve_onLoad(el);

} //refresh

function _resolve_onLoad(el) {

  if (el.instance && el.instance.rootNode) {
    
    if (this.recipe.onLoad) {
        Promise.resolve( this.preLoad );
        Promise.resolve( this.recipe.onLoad( this ) );
    }
  }

} //_resolve_onLoad

function _refresh_component( compo, el, recipe ) {
  // component
  const aliased = recipe.aliasedRecipe;
  if (aliased) {
    const root = aliased.contents[0];
    if (root.isComponent) {
      this._refresh_component( root, el, aliased );
    }
    if (root.contents && root.contents.length > 0) {
      this._refresh_content( root.contents, el );
    }
    this._refresh_element( root, el );

    el.instance._refresh( compo, el, recipe.contents[0], true );
    return;
  }
  el.instance._refresh( compo.recipe.rootElementNode, el, compo );

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
        const list = typeof con.foreach === 'function' ? con.foreach( this ) : con.foreach;
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
                // note, i won't be 0 because that instance was created in the start of _refresh_content
                forEl = forInstance._new_el( forInstance.recipe.rootElementNode, forKey, undefined, lastEl );
                forInstance.rootEl = forEl;
                forEl.instance = forInstance;
                this._key2instance[ forKey ] = forInstance;
              }


              forInstances.push( forInstance );

              // update data for foreach instance before refresh
              forInstance.idx[forval] = i;
              forInstance.it[forval] = list[i];

              Object.keys( forInstance.dataFunctions )
                .forEach( dname => {
                  forInstance.data[dname] = dataVal( forInstance.dataFunctions[dname], forInstance );
                } );

              forInstance._refresh( con.recipe.rootElementNode, forEl, con );
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
        // extract data from functions if any
        const conInst = conEl.instance;
        Object.keys( conInst.dataFunctions )
          .forEach( dname => {
              conInst.data[dname] = dataVal( conInst.dataFunctions[dname], this );
          } );

        conInst._refresh_component( con, conEl, con.recipe );
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
  if (attachToEl === document) {
    document.body.key = key;
    return document.body;
  }
  const newEl = document.createElement( node.tag );
  if (node.fill) {
    newEl.fill = newEl.dataset.fill = node.fill;
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
  if (el === document) {
    key2el[document.body.key] = document.body;
  } else {
    Array.from( el.children )
      .forEach( el => el.key && ( key2el[el.key] = el ) );
  }
  return key2el;
}; //makeKey2el


window.init = init;
