
window.onload = ev => {

  // stores
  const recipeNames = {};

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


  // connect the namespaces to each other via imports, set namespace types and filename
  Object.keys( filespaces )
    .forEach( filename => {
      const namespace = filespaces[filename];
      namespace.type = 'namespace';
      namespace.filename = filename;
      // connect namespaces
      if (namespace.namespaces) {
        Object.keys( namespace.namespaces )
          .forEach( alias => (namespace.namespaces[alias] = filespaces[namespace.namespaces[alias]]) );
      }
    } );

  const defaultNamespace = filespaces[defaultFilename];
  const html = defaultNamespace.html;

  // now prep the nodes
  Object.keys( filespaces )
    .forEach( filename => {
      const namespace = filespaces[filename];
      prepNode( namespace );
    } );

  // instantiate
  if (html && html.body) {
    console.log( filespaces );

    // now make an instance
    const bodyInstance = newInstance( html.body );
    bodyInstance.rootEl = document.body;
    document.body.key = bodyInstance.id;
    document.body.dataset.key = bodyInstance.id;

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
    bodyInstance.refresh( document.body );

    // build the body instance and refresh it
    // may have to update the body element key before the refresh



    // // attach any body listeners
    // if (html.body.on) {
    //   Object.keys( html.body.on ).forEach( evname => {
    //     const evfun = function() {
    //       const prom = html.body.on[evname]( bodyComponent, ...arguments );
    //       // resolve in case it returns undefined or returns a promise
    //       Promise.resolve( prom )
    //         .then( () => {
    //           if ( bodyComponent._check() ) bodyComponent.refresh();
    //         } );
    //     };
    //     // element event listeners
    //     document.body.addEventListener( evname, evfun );
    //   } );
    // }
  } else {
    console.warn( `no body defined in '${defaultFilename}'` );
  }
/*
  const defaultNamespace = filespaces[defaultFilename];
  defaultNamespace.filename = defaultFilename;
  const html = defaultNamespace.html;

  const namespaceComponent = newComponentInstance( { data: defaultNamespace.data,
                                                     functions: defaultNamespace.functions,
                                                     namespace: defaultNamespace,
                                              }, {} );
*/

}; //onLoad


let serial = 1;

const prepNode = (node,namespace) => {
  namespace = namespace || node;
  node.id = serial++;
  attachFunctions( node );
  if (node.type === 'namespace') {
    node.components && Object.keys( node.components )
      .forEach( recipeName => {
        const comp = node.components[recipeName];
        if (recipeName === 'body') {
          throw new Error( `may not use the name 'body' for components in file ${namespace.filename}` );
        }
        comp.type = 'recipe';
        comp.namespace = namespace;
        comp.name = recipeName;
        comp.inRecipe = comp; // self referential
        comp.asRecipe = comp; // self referential
        if (comp.contents.length !== 1) {
          throw new Error( `recipe must contain exactly one root element for '${recipeName}' in '${namespace.filename}'` );
        }
        comp.rootNode = comp.contents[0];
        comp.rootNode.isRoot = true;
        prepNode( comp, namespace );
      } );
    if (node.html && node.html.body) {
      node = node.html.body;
      node.namespace = namespace;
      node.type = 'recipe';
      node.name = 'body';
      const rootNode = { tag: 'body',
                         type: 'element',
                         id: serial++,
                         isRoot: true,
                         contents: node.contents };
      node.rootNode = rootNode;
      node.contents = [rootNode];
      node.inRecipe = node; // self referential
      node.asRecipe = node; // self referential
      prepNode( node, namespace );
      rootNode.on = node.on;
    }
  }
  else if (node.contents) {

    // check integrity of if/elseif/else
    let lastWasIf = false;

    node.contents.forEach( con => {
      const tag = con.tag;
      const tagParts = tag.split( '.');

      con.inRecipe = node.inRecipe;

      if ( [con.else, con.elseif, con.if].filter( x => x !== undefined ).length > 1 ) {
        throw new Error( `may not have more than one of if,elseif,else in file ${namespace.filename} and recipe ${con.inRecipe.name}` );
      }

      if (!lastWasIf && (con.else || con.elseif)) {
        throw new Error( `else and elseif must be preceeded by if or elseif : in file ${namespace.filename} and recipe ${con.inRecipe.name}` );
      } else {
        lastWasIf = !!(con.elseif || con.if);
      }

      if (tagParts.length == 2) {
        con.type = 'component';
        con.isComponent = true;
        const importedNamespace = namespace.namespaces[tagParts[0]];
        con.asRecipe = importedNamespace.components[tagParts[1]];
      } else if (namespace.components[tag]) {
        con.type = 'component';
        con.isComponent = true;
        con.asRecipe = namespace.components[tag];
      } else {
        con.type = 'element';
      }
      if (con.isComponent && con.isRoot) {
        throw new Error( `recipe root node must be an html element for '${con.inRecipe.name}' in '${con.inRecipe.namespace.filename}'` );
      }
      prepNode( con, namespace );
    } );
  }

}; //prepNode

const attachFunctions = node => {
  [ 'preLoad', 'onLoad', 'if', 'elseif', 'foreach', 'listen' ]
    .forEach( fun =>
      node[fun] !== undefined && ( node[fun] = funs[node[fun]] ) );

  [ 'calculate', 'on', 'functions' ]
    .forEach( hashName => {
      const funHash = node[hashName];
      if (funHash) {
        Object.keys( funHash )
          .forEach( fun => ( funHash[fun] = funs[funHash[fun]] ) );
      }
    } );
}; //attachFunctions

const dataVal = (v,s) => typeof v === 'function' ? v(s) : v;

  // populate instance with the fields:
  //
  //   node it is created from
  //   parent (enclosingInstance)
  //
  //   type (desciption of this instance)
  //
  //   data -> data values
  //   fun -> functions
  //   handles for html elements
  //   handles for component instances
  //
  //   broadcastListener function to hear broadcasts
  //   eventListeners to hear events of component instances
  //
  //   _key2subinstance - stores all component instances
  //                     direction attached to this one
  //
  //   idx/it/lastcount - temporary variables for foreach
  //
  //
  // and the methods
  //
  //   preLoad - method defined in recipe / enclosing instance
  //
  //   get( key, defaultVal ) get the data by the field
  //                          transversing parent instances
  //   set( key, values ) set the data in this instance
  //   _check - returns true if data has changed. used
  //            to determine if a refresh is neede
  //   broadcast( tag, message) -> broadcasts a message to
  //                               all listeners in document
  //   event( event, result) -> sends an instance event
  //                            to its eventListeners
  //   refresh( el, node, key ) -> refreshes this instance
  //         and all its decendents. creates and removes
  //         els as needed
  //
  //

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

const makeKey2el = el => {
  const key2el = {};
  Array.from( el.children )
      .forEach( el => el.key && ( key2el[el.key] = el ) );
  return key2el;
}

// node - root node of creating recipe
const newInstance = (node, enclosingInstance) => {


  // the recipe that builds this component instance
  const asRecipe = node.asRecipe;
  const asNamespace = asRecipe.namespace;

  // the recipe that this component instance is embedded in
  const inRecipe = node.inRecipe;
  const inNamespace = inRecipe.namespace;

  //console.log( 'making instance of ' + asRecipe.name + ' ' + (serial) );
  //console.log( node.data, "NOD" );

  const instance = {
    id: serial++,

    node,
    parent: enclosingInstance,
    needsInit: true,

    type: `instance of ${asRecipe.name} from ${asNamespace.filename}`,

    _key2subinstance: {},

    // handles
    comp   : {}, // handle -> component component?
    el     : {}, // handle -> element

    // foreach temporary vars
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value
    lastcount: {}, // iterator name -> last list count

    // listeners
    eventListeners: {}, // event name -> listeners
    broadcastListener: node.listen || asRecipe.listen,
  };


  // level of functions
  //    namespace ( asRecipe namespace )
  //    recipe    ( asRecipe )
  //    node itself ( the one embedded )


  // level of data
  //    namespace ( asRecipe namespace )
  //    recipe    ( asRecipe )
  //    enclosingInstance
  //    node itself ( the one embedded )

  const data = instance._data = {};

  // INSTALL DATA ----------------------

  // populate data from the namespace, recipe, enclosing instance and the node
  // itself (in ascending precedence)
  [asNamespace,asRecipe,enclosingInstance,node].forEach( level =>
    level && level.data &&
      Object.keys(level.data).forEach( arg => {
        let val = level.data[arg];
        if (typeof val === 'string') {
          const x = val.substr( 0, 1 );
          const checkVal = val.substr( 1 );
          if (x === 'i') { // int
            val = Number.parseInt( checkVal );
          } else if (x === 'f') { // float
            val = Number.parseFloat( checkVal );
          } else if (x === 'c') { // code/function
            recipeDataFunConvert[arg] = Number.parseInt(checkVal);
          } else if (x === 's') {
            val = checkVal;
          }
        }
        data[arg] = val;
      } ) );

  // gets data from this instance or parent instance
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

  // sets data in this instance. returns the instance so it can be chained
  instance.set = function(k,v) {
    this._changed = this._changed || v !== this._data[k];
    this._data[k] = v;
    return this;
  };

  // function that returns true if data from this instance
  // has chanced since the last time this was called
  instance._check = function() {
    const changed = this._changed;
    this._changed = false;
    return changed;
  };





  // INSTALL FUNCTIONS ----------------------

  // functions are installed in this order: namespace, recipe, enclosing instance and node
  //   (in ascending precedence)
  const instanceFuns = {...asNamespace.functions};
  instance.fun = instanceFuns;

  // set up all functions to take this instance as their first argument
  Object.keys( instanceFuns )
    .forEach( funName => {
      const oldFun = instanceFuns[funName];
      instanceFuns[funName] = function() { oldFun( instance, ...arguments ) };
    } );


  asRecipe.functions &&
    Object.keys(asRecipe.functions).forEach( fun =>
      instanceFuns[fun] = function() { return asRecipe.functions[fun]( instance, ...arguments ) }
    );

  // already sends the enclosing instance as first argument
  if (enclosingInstance && enclosingInstance.fun) {
    Object.keys( enclosingInstance.fun )
      .forEach( fun =>
        (instanceFuns[fun] = enclosingInstance.fun[fun]) );
  }

  node.functions &&
    Object.keys(node.functions).forEach( fun =>
      instanceFuns[fun] = function() { return node.functions[fun]( instance, ...arguments ) }
    );





  // SET UP LISTENERS -----------------


  // this sends a component event from its instance to its parent
  instance.event = (event,result) => {
    const listeners = instance.eventListeners[event];
    listeners && listeners.forEach( l => l( result ) );
  };

  // propagateMessage
  instance._propagateBroadcast = (tag,msg) => {
    // checks to see if this node has listeners for the message
    instance.broadcastListener && instance.broadcastListener(instance,tag,msg);

    // propagates here and each child with the given message
    Object.values( instance._key2subinstance ).forEach( c => c._propagateBroadcast(tag,msg) );
  };


  // the body instance is the ultimate top level instance of the page
  instance.top = (enclosingInstance && enclosingInstance.top) || instance;

  // called in the recipe to broadcast a message
  instance.broadcast = (tag,msg) => {
    instance.top._propagateBroadcast(tag,msg);
    instance.top.refresh();
  };

  

  // method _prepElement
  instance._prepElement = ( node, key, attachToEl, attachAfter ) => {
    const tag = node.isComponent ? node.asRecipe.rootNode.tag : node.tag;
    const newEl = document.createElement( tag );
    if (node.internalContent) {
      newEl.internalContent = true;
    }
    newEl.key = key;
    newEl.dataset.key = key;
    if (node.handle) {
      instance.el[node.handle] = newEl;
    }
    if (attachAfter) {
      attachToEl.after( newEl );
    } else {
      attachToEl.append( newEl );
    }
    newEl.style.display = 'none';

    return newEl;
  }; //_prepElement

  // method _refreshElement
  instance._refreshElement = ( el, node ) => {

    // an element that needs init has no handlers and stuff
    // so attach those now
    const needsInit = !!!el.hasInit;
    if (needsInit) {
      el.hasInit = true;

      // attach element event handlers
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
    } // needs init block 1

    // now set any calculated attributes (+ innerHTML, textContent) on the 
    // element
    
    // update calculated element attrs
    const seen = {};

    // set attributes from the element node
    // and if a root, update set attributes from its component node
    [node.calculate, node.isRoot && instance.node.calculate ]
    .forEach( calcs => 
      calcs && Object.keys(calcs)
        .forEach( attr => {
          seen[attr] = seen[attr] || 0;
          if (0 === seen[attr]++) {
            if (attr.match( /^(textContent|innerHTML)$/)) {
              el[attr] = calcs[attr](instance);
            } else {
              el.setAttribute( attr, calcs[attr](instance) );
            }
          }
        }));

    // update element attrs and textContent assigned with constants
    [ node.attrs, node.isRoot && instance.node.attrs ]
      .forEach( attrs =>
        attrs && Object.keys(attrs)
          .forEach( attr => {
            seen[attr] = seen[attr] || 0;
            if (0 === seen[attr]++) {
              if (attr === 'textContent') {
                el.textContent = attrs[attr];
              } else if (attr === 'innerHTML') {
                el.innerHTML = attrs[attr];
              } else {
                el.setAttribute( attr, attrs[attr] );
              }
            }
          }));

    // get a census of key --> element for child elements of this element.
    const key2el = makeKey2el(el);

    // make this element visible
    if (!el.noshow) {
      el.style.display = null;
    }

    // now fill in the contents. first make sure that the contents have
    // corresponding elements
    const contents = node.contents;

    if (contents) {
      let lastWasConditional = false,
          conditionalDone = false,
          lastConditionalWasTrue = false;

      contents
        .forEach( con => {
          let conEl, conInstance;
          let conKey = `${instance.id}.${con.id}`;

          const asRecipe = con.asRecipe;

          if (con.foreach) {
            conKey = conKey + '_0';
          }

          conEl = key2el[ conKey ] || instance._prepElement( con, conKey, el );
          key2el[ conKey ] = conEl;

          // if it is branched, determine if it should appear by running the branching
          // check functions
          if (con.if) {
            conditionalDone = lastConditionalWasTrue = con.if( instance );
            lastWasConditional = true;
            conEl.dataset.ifCondition = conditionalDone;
            conEl.noshow = !conditionalDone;
          } else if (con.elseif) {
            if (conditionalDone) {
              lastConditionalWasTrue = false;
            } else {
              conditionalDone = lastConditionalWasTrue = con.elseif( instance );
              conEl.dataset.elseIfCondition = conditionalDone;
              conEl.noshow = !conditionalDone;
            }
          } else if (con.else) {
            if (conditionalDone) {
              lastConditionalWasTrue = false;
              conEl.dataset['else'] = false;
              conEl.noshow = true;
            } else {
              lastConditionalWasTrue = true;
              conEl.dataset['else'] = true;
              conEl.noshow = false;
            }
          } else {
            lastWasConditional = false;
          }

          if (lastWasConditional === false || lastConditionalWasTrue) {
            // this element should be visible and populated

            if (con.foreach) {
              // remove extras but never the first index
              const forval = con.forval;
              const list = con.foreach( instance );
              const upto = instance.lastcount[forval];

              // remove any that are more than the list count
              if (instance.lastcount[forval] > list.length) {
                for (let i=list.length === 0 ? 1 : list.length; i<instance.lastcount[forval]; i++) {
                  conKey = conKey.replace( /_\d+$/, '_' + i );
                  const itEl = key2el[conKey];
                  itEl && itEl.remove();
                }
              }
              instance.lastcount[forval] = list.length;

              if (list.length === 0) {
                // nothing to display, so hide the zero indexed foreach
                conEl.style.display = 'none';
              } else {
                // make sure each foreach list item is populated
                // for those that are for instances, they each get their
                // own instance
                let lastEl;
                for (let i=0; i<list.length; i++ ) {
                  conKey = conKey.replace( /_\d+$/, '_' + i );

                  let forEl = key2el[conKey] || ( i == 0 ? instance._prepElement( con, conKey, el ) : instance._prepElement( con, conKey, lastEl, 'after' ) );
                  // hide this element for now
                  forEl.style.display = 'none';
                  
                  // set the iteration temporary variables
                  instance.idx[forval] = i;
                  instance.it[forval] = list[i];
                  lastEl = forEl;

                  if (con.isComponent) {
                    let forInstance = instance._key2subinstance[ conKey ];
                    if (!forInstance) {
                      forInstance = newInstance( con, instance );
                      forInstance.rootEl = forEl;
                      instance._key2subinstance[ conKey ] = forInstance;
                    }

                    const comps = instance.comp[con.handle] = instance.comp[con.handle] || [];
                    comps.length = list.length;
                    comps[i] = componentInstance;

                    forInstance._refreshComponent( con, forEl, i, true );
                    if (con.contents) {
                      // more contents to hang inside a child of the internal instance
                      // though maybe in refresh?
                      const intEl = findInternalContent( conEl );
                      const intKey2el = makeKey2el(intEl);
                      const intRoot = con.contents[0];
                      const intKey = `${instance.id}.${intRoot.id}_${i}`;
                      const child = intKey2el[intKey] || forInstance._prepElement( intRoot, intKey, intEl );
                
                      forInstance._refreshElement( child, intRoot );
                    }
                  } else {
                    instance._refreshElement( forEl, con, conKey );
                  }
                }
              }
            } // end of has foreach

            else if (con.isComponent) {
              conInstance = instance._refreshComponent( con, conEl, undefined, true );

              // more contents to hang inside a child of the internal instance
              // though maybe in refresh?
              if (con.contents && con.contents.length === 1) {
                const intEl = findInternalContent( conEl );
                const intKey2el = makeKey2el(intEl);
                const intRoot = con.contents[0];
                const intKey = `${instance.id}.${intRoot.id}`;
                const child = intKey2el[intKey] || instance._prepElement( intRoot, intKey, intEl );
                
                conInstance._refreshElement( child, intRoot );
              }
            } else {
              instance._refreshElement( conEl, con );
            }
          } else {
            // hide this element
            conEl.style.display = 'none';

            // if if is a component, it should have an instance, hidden or not. 
            if (con.isComponent && ! instance.comp[con.handle]) {
              let newinst;
              if (con.foreach) {
                instance.comp[con.handle] = instance.comp[con.handle] || [];
                newinst
                  = instance.comp[con.handle][0]
                  = instance._key2subinstance[ conKey ]
                  = newInstance( con, instance );
                newinst.rootEl = conEl;
              } else {
                newinst 
                  = instance.comp[con.handle]
                  = instance._key2subinstance[ conKey ]
                  = newInstance( con, instance );
              }
              newinst.noInit = true;
              newinst.rootEl = conEl;
            }

            // if a list, remove all but the first
            if (con.foreach) {
              const upto = instance.lastcount[instance.forval];
              for (let i=1; i<upto; i++) {
                conKey = conKey.replace( /_\d+$/, '_' + i );
                key2el[conKey].remove();
              }
            }
          }
        } );
    } // if this has contents in it

  }; //_refreshElement

  // method _refreshComponent
  instance._refreshComponent = ( node, el, idx, noMoreInit ) => {
    // the node is a node that represents a component.
    const asRecipe = node.asRecipe;

    // it will be anchored in the document at its root element
    // which has the key of instance id of which it is embedded
    // in, and node id for the root node for this element
    const key = `${instance.id}.${node.id}`;
    let componentInstance = instance._key2subinstance[key];

    let needsInit = !!!componentInstance;
    if (noMoreInit && componentInstance) {
      needsInit = componentInstance.noInit;
      componentInstance.noInit = false;
    } else {
      needsInit = needsInit && !(componentInstance && componentInstance.noInit);      
    }
    if (! componentInstance ) {
      // no instance yet, so build one and attach the root element to the document.

      componentInstance = instance._key2subinstance[key] = newInstance(node, instance);
      componentInstance.rootEl = el;

      // install component event listeners. these can only come from the node
      // and send the messages to the parent node
      const inRecipe = node.inRecipe;
      node.on && Object.keys( node.on ).forEach( evname => {
        // so a componentInstance uses 'event' to send a message
        // to its listeners
        const evfun = function() {
          const prom = node.on[evname]( instance, ...arguments );
          // resolve in case it returns undefined or returns a promise
          Promise.resolve( prom )
            .then( () => {
              if ( instance._check() ) instance.refresh();
            } );
        };

        // update component instance event listeners
        componentInstance.eventListeners[evname] = componentInstance.eventListeners[evname] || [];
        componentInstance.eventListeners[evname].push( evfun );
      } );
      if (node.handle) {
        if (idx !== undefined) {
          instance.comp[node.handle] = instance.comp[node.handle] || [];
          instance.comp[node.handle][idx] = componentInstance;
        } else {
          instance.comp[node.handle] = componentInstance;
        }
      }
    }


    componentInstance.refresh();

    // once filled in, if this is a new thing with an onLoad
    // even, run that onLoad event
    if (needsInit && asRecipe.onLoad) {
      // indicates that this is the root node for a component that
      // has not had its onLoad done. The preLoad may be a promise,
      // so resolve that and then run the onLoad
      Promise.resolve( componentInstance.preLoad )
        .then (() => asRecipe.onLoad( componentInstance ) );
    }

    return componentInstance;

  }; //_refreshComponent

  // method refresh the instance
  instance.refresh = () => {

    // refreshses a component, like the body for example
    const recipe = asRecipe;
    const el = instance.rootEl;
    const rootNode = recipe.rootNode;

    instance._refreshElement( el, rootNode );
    
    if (instance.needsInit) {
      // indicates that this is the root node for a component that
      // has not had its onLoad done. The preLoad may be a promise,
      // so resolve that and then run the onLoad
      instance.needsInit = false;
      Promise.resolve( instance.preLoad )
        .then (() => asRecipe.onLoad( instance ) );
      
    }
  }; //refresh

  asRecipe.preLoad && (instance.preLoad = asRecipe.preLoad(instance));
  return instance;


}; //newInstance
