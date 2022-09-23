console.warn( "how about defining component events that can be listened to" );
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

  const pageComponent = newComponentInstance( { data: defaultNamespace.data,
                                                functions: defaultNamespace.functions,
                                              }, {} );
  if (html && html.body) {
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
    // for example, the yaml:
    //
    // ---
    // import:
    //   - bar: examples/more_imports
    //
    // will get translated to namespaces.bar = [...namespace referenced by examples/more_imports...]
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
        if (name === 'body') {
          throw new Error( "invalid component recipe name; 'body' is a reserved word" );
        }
        namespace.components[name] = compileRecipe( recipe, filename, name );
      } );
    const bodyRecipe = compileBody( html.body, defaultFilename, defaultNamespace );

    const bodyComponent = newComponentInstance( bodyRecipe, html.body, pageComponent );
    pageComponent._key2subcomponent['body'] = bodyComponent;
    html.body.key = bodyRecipe.id;

    bodyComponent.refresh( document.body );

    // attach any body listeners
    if (html.body.on) {
      Object.keys( html.body.on ).forEach( evname => {
        const evfun = function() {
          const prom = html.body.on[evname]( bodyComponent, ...arguments );
          // resolve in case it returns undefined or returns a promise
          Promise.resolve( prom )
            .then( () => {
              if ( bodyComponent._check() ) bodyComponent.refresh();
            } );
        };
        // element event listeners
        document.body.addEventListener( evname, evfun );
      } );
    }

  } else {
    console.warn( `no body defined in '${defaultFilename}'` );
  }
};

const dataVal = (v,s) => typeof v === 'function' ? v(s) : v;

let serial = 1;
const newComponentInstance = (recipe,recipeNode,parent) => {

  // discover state data and state data generating functions
  // that will be called after the state is set up
  // newComponentInstance is also where the preLoad routine should be called
  // after the data is set up.
  //
  //  so:
  //     _data values set from constants
  //     instance created
  //     _data values set from functions
  //     preLoad called and given the state so it can then call any data
  //             manipulation
  //
  //  and after data is refreshed for the first time,
  //     call onLoad passing it the data
  //
  const data = {};
  const recipeDataFunConvert = {};
  const nodeDataFunConvert = {};

  // populate data
  recipe.data && 
    Object.keys(recipe.data).forEach( arg => {
      let val = recipe.data[arg];
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
    } );


  recipeNode.data && 
    Object.keys(recipeNode.data).forEach( arg => {
      let val = recipeNode.data[arg];
      if (typeof val === 'string') {
        const x = val.substr( 0, 1 );
        const checkVal = val.substr( 1 );
        if (x === 'i') { // int
          val = Number.parseInt( checkVal );
        } else if (x === 'f') { // float
          val = Number.parseFloat( checkVal );
        } else if (x === 'c') { // code/function
          nodeDataFunConvert[arg] = Number.parseInt(checkVal);
        } else if (x === 's') {
          val = checkVal;
        }
      }
      data[arg] = val;
    } );


  // get a state object ready before calling the  preLoad to populate the calculated data. this means that functions run after regular data values are placed
  const component = {
    id     : serial++,

    desc : `component for recipe '${recipe.name}'`,

    parent,
    
    _key2subcomponent: {},

    calc   : {}, // attribute name -> calculation
    comp   : {}, // handle -> component component?
    el     : {}, // handle -> element
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value
    lastcount: {}, // iterator name -> last list count
    eventListeners: {}, // event name -> listeners
    recipe,

    refresh: function( el, node, key ) {
      const component = this;
      if (!component.parent) { // the root
        return component._key2subcomponent.body.refresh(document.body);
      }
      const recipe = component.recipe;
      el = el || component.rootEl;
      node = node || recipe.rootNode;
      key = key || component.id; // for foreach case

      const needsInit = el.hasInit ? false : true;
      const isRecipeNode = node.nodeRecipe ? true : false;

      if (needsInit) {
        // element has not been given a key, so not initied
        el.hasInit = true;

        el.key = key;
        el.dataset.key = key;

        component.rootEl || (component.rootEl = el);

        // attach element event handlers
        if (! isRecipeNode && node.on) {
          Object.keys( node.on ).forEach( evname => {
            const evfun = function() {
              const prom = node.on[evname]( component, ...arguments );
              // resolve in case it returns undefined or returns a promise
              Promise.resolve( prom )
                .then( () => {
                  if ( component._check() ) component.refresh();
                } );
            };
            // element event listeners
            el.addEventListener( evname, evfun );
          } );
        }
      }

      // update element attrs and textContent assigned thru calculation
      const seen = { id: 1 };
      [ node.calculate, recipe.calculate ]
        .forEach( calcs => 
          calcs && Object.keys(calcs)
            .forEach( attr => {
              seen[attr] = seen[attr] || 0;
              if (0 === seen[attr]++) {
                if (attr === 'textContent') {
                  el.textContent = calcs[attr](component);
                } else {
                  el.setAttribute( attr, calcs[attr](component) );
                }
              }
            }));

      // update element attrs and textContent assigned with constants
      [ node.attrs, node.nodeRecipe && recipe.rootNode.attrs ]
        .forEach( attrs =>
          attrs && Object.keys(attrs)
            .forEach( attr => {
              seen[attr] = seen[attr] || 0;
              if (0 === seen[attr]++) {
                if (attr === 'textContent') {
                  el.textContent = attrs[attr];
                } else {
                  el.setAttribute( attr, attrs[attr] );
                }
              }
            }));

      // get a census of key --> element for child elements of this element.
      // then build the nodes as needed
      const key2el = {};
      Array.from( el.children )
        .forEach( el => el.key && ( key2el[el.key] = el ) );

      // now fill in the contents. first make sure that the contents have
      // corresponding elements
      const contents = isRecipeNode ? recipe.rootNode.contents : node.contents;

      if (contents) {
        let lastWasConditional = false,
            conditionalDone = false,
            lastConditionalWasTrue = false;
        
        contents
          .forEach( con => {
            let conKey, conEl, conComponent;
            const conRecipe = con.nodeRecipe;
            if (conRecipe) {
              // translate conRecipe id and con id to a component lookup
              const lookup = `${component.id}_${con.id}`;
              conComponent = component._key2subcomponent[ lookup ];
              if ( ! conComponent ) {
                conComponent = newComponentInstance(conRecipe,con,component);
                if (con.handle) {
                  component.comp[con.handle] = conComponent;
                }
                con.on && Object.keys( con.on ).forEach( evname => {
                  const evfun = function() {
                    const prom = con.on[evname]( component, ...arguments );
                    // resolve in case it returns undefined or returns a promise
                    Promise.resolve( prom )
                      .then( () => {
                        if ( component._check() ) component.refresh();
                      } );
                  };
                  // node event listeners
                  conComponent.eventListeners[evname] = conComponent.eventListeners[evname] || [];
                  conComponent.eventListeners[evname].push( evfun );
                } );

                component._key2subcomponent[ lookup ] = conComponent;
              }
              conKey = conComponent.id;
            } else {
              conKey = `${component.id}_${con.id}`;
            }
            if (con.foreach) {
              conKey = conKey + '_0';
            }

            conEl = key2el[ conKey ];
            if (!conEl) {
              conEl = document.createElement( conRecipe ? conRecipe.rootNode.tag : con.tag );
              conEl.key = conKey;
              conEl.dataset.key = conKey;
              if (con.handle) {
                if (isRecipeNode) {
                  if (conRecipe.rootNode.handle) {
                    component.el[conRecipe.rootNode.handle] = conEl;
                  }
                } else {
                  component.el[con.handle] = conEl;
                }
              }
              key2el[conKey] = conEl;
              // ok to change style display, if it will be displayed, the properties will be reset
              // on refresh
              conEl.style.display = 'none';
              el.append( conEl );
            }

            if (con.if) {
              conditionalDone = lastConditionalWasTrue = con.if( component );
              lastWasConditional = true;
            } else if (con.elseif) {
              if (conditionalDone) {
                lastConditionalWasTrue = false;
              } else {
                conditionalDone = lastConditionalWasTrue = con.elseif( component );
              }
            } else if (con.else) {
              if (conditionalDone) {
                lastConditionalWasTrue = false;
              } else {
                lastConditionalWasTrue = true;
              }
            } else {
              lastWasConditional = false;
            }

            if (lastWasConditional === false || lastConditionalWasTrue) {
              // this element should be visible and populated

              if (con.foreach) {
                // remove extras but never the first index
                const forval = con.forval;
                const list = con.foreach( component );
                const upto = component.lastcount[forval];
                if (component.lastcount[forval] > list.length) {
                  for (let i=list.length === 0 ? 1 : list.length; i<component.lastcount[forval]; i++) {
                    conKey = conKey.replace( /_\d+$/, '_' + i );
                    const itEl = key2el[conKey];
                    itEl && itEl.remove();
                  }
                }
                component.lastcount[forval] = list.length;
                if (list.length === 0) {
                  conEl.style.display = 'none';
                } else {
                  // make sure each foreach list item is populated
                  // for those that are for components, they each get their
                  // own component
                  let lastEl;
                  for (let i=0; i<list.length; i++ ) {
                    conKey = conKey.replace( /_\d+$/, '_' + i );
                    let forEl = key2el[conKey];
                    if (forEl) {
                      conEl.style.display = null;
                    } else {
                      forEl = document.createElement( conRecipe ? conRecipe.rootNode.tag : con.tag );
                      forEl.key = conKey;
                      forEl.dataset.key = conKey;
                      lastEl.after( forEl );
                    }
                    component.idx[forval] = i;
                    component.it[forval] = list[i];
                    lastEl = forEl;

                    if (conRecipe) {
                      let forComponent = component._key2subcomponent[ conKey ];
                      if (!forComponent) {
                        forComponent = newComponentInstance( conRecipe, con, component );
                        component._key2subcomponent[ conKey ] = forComponent;
                        if (conRecipe && con.handle) {
                          component.comp[con.handle] = component.comp[con.handle] || [];
                          component.comp[con.handle][i] = forComponent;
                        }
                      }
                      forComponent.refresh( forEl, con );
                      if (con.contents) {
                        // more contents to hang inside a child of the internal component
                        // though maybe in refresh?
                        const intEl = findInternalContent( conEl );
                        if (intEl) {
                          forComponent.refresh( intEl, con.contents );
                        }
                      }
                    } else {
                      component.refresh( forEl, con, conKey );
                    }
                  }
                }
              } // end of foreach
              else if (conRecipe) {
                // recipe component node that may have extra contents
                conEl.style.display = null;
                conComponent.refresh( conEl, con, conKey );
                if (con.contents) {
                  // more contents to hang inside a child of the internal component
                  // though maybe in refresh?
                  const intEl = findInternalContent( conEl );
                  if (intEl) {
                    conComponent.refresh( intEl, con.contents );
                  }
                }
              } else {
                // html element node
                conEl.style.display = null;
                component.refresh( conEl, con, conKey );
              }
            } else {
              // hide this
              conEl.style.display = 'none';
              // if a list, remove all but the first
              if (con.foreach) {
                const upto = component.lastcount[component.forval];
                for (let i=1; i<upto; i++) {
                  conKey = conKey.replace( /_\d+$/, '_' + i );
                  key2el[conKey].remove();
                }
              }
              
            }
          } );
      } // if contents

      if (needsInit && isRecipeNode) {
        // indicates that this is a recipe (component) node that 
        // has not had its onLoad done. The preLoad may be a promise,
        // so resolve that and then run the onLoad
        recipe.onLoad &&
          Promise.resolve( component.preLoad )
                 .then (r =>recipe.onLoad(component) );
      }
    }, //refresh


    broadcastListener: (recipe.listen || recipeNode.listen),

  }; //component

  component.top = (parent && parent.top) || component;

  // called in the recipe to broadcast a message
  component.broadcast = (tag,msg) => {
    component.top.propagateBroadcast(tag,msg);
    component.top.refresh();
  }

  // propagateMessage
  component.propagateBroadcast = (tag,msg) => {
    // checks to see if this node has listeners for the message
    component.broadcastListener && component.broadcastListener(component,tag,msg);

    // propagates here and each child with the given message
    Object.values( component._key2subcomponent ).forEach( c => c.propagateBroadcast(tag,msg) );
  };

  // this sends a component event, called in the recipe
  component.event = (event,result) => {
    const listeners = component.eventListeners[event];
    listeners && listeners.forEach( l => l( result ) );
  };

  component._data = data;
  component.get = function(k,defVal) { 
    if (k in this._data) return dataVal( this._data[k], component );
    let val = this.parent && this.parent.get( k );
    if (val===undefined && defVal !== undefined) {
      val = this._data[k] = defVal;
    }
    return dataVal( val, component );
  };

  component.set = function(k,v) { 
    this._changed = this._changed || v !== this._data[k];
    this._data[k] = v; 
  };

  component._check = function() { 
    const changed = this._changed;
    this._changed = false; 
    return changed; 
  };

  // get defined functions
  const componentFuns = parent ? {...parent.fun} : {};
  [recipe,recipeNode]
    .forEach( level => level &&
              level.functions &&
              Object.keys(level.functions).forEach( fun =>
                componentFuns[fun] = function() { return level.functions[fun]( component, ...arguments ) }
              ) );

  component.fun = componentFuns;

  
  Object.keys( nodeDataFunConvert )
    .forEach( fld => data[fld] = funs[nodeDataFunConvert[fld]](parent) );

  Object.keys( recipeDataFunConvert )
    .forEach( fld => data[fld] = funs[recipeDataFunConvert[fld]](component) );

  recipe.preLoad && (component.preLoad = recipe.preLoad( component ));

  return component;
}; //newComponentInstance

const compileBody = (body, filename, namespace) => {

  // gotta compile the recipe and rewrite the body.
  // the body should have no contents after this is done? 

  const nodeRecipe = {};
  body.nodeRecipe = body.recipe = nodeRecipe;
  [ 'data', 'functions', 'preLoad', 'onLoad', 'listen' ]
    .forEach( bp => {
      const val = body[bp];
      if (val) {
        nodeRecipe[bp] = val;
        delete body[bp];
      }
    } );

  nodeRecipe.contents = [ { tag: 'body', 
                            attrs: body.attrs,
                            contents: body.contents } ];

  namespace.components.body = nodeRecipe;
  compileRecipe( nodeRecipe, filename, 'body' );
  prepFunctions(body,filename,'body');
  return nodeRecipe;

}; //compileBody

// takes a recipe and
//  * gives it a serialized id
//  * replaces function indexes with the actual functions
//  * compiles all child nodes under the recipe
//  * finds the root node of the recipe
const compileRecipe = (recipe, filename, recipeName) => {

  try {
    if ( (!recipe.contents) || recipe.contents.length != 1) {
      throw new Error( "recipe '" + recipeName + "' must contain exactly one root element" );
    }

    recipe.id = serial++;
    recipe.namespace = filespaces[filename];

    recipe.desc = `Recipe '${recipeName}'`;
    recipe.name = recipeName;

    prepFunctions( recipe, filename, recipeName );
    compileRecipeNodes( recipe, recipe, filename, recipeName, recipe.namespace, [] );

    recipe.rootNode = recipe.contents[0];
    recipe.rootNode.isRootNode = true;
  }
  catch( err ) {
    throw new Error( `Error compiling recipe '${recipeName}' in file '${filename}' : ${err}` );
  }
  return recipe;
}; //compileRecipe

// takes a node which may be an html element or component descriptor
//  * gives it a serialized id
//  * replaces function indexes with the actual functions
//  * marks the node as a component if it is one
//  * compiles all child nodes under the recipe
//  * finds the root node of the recipe
const compileRecipeNodes = (root, recipe, filename, recipeName, namespace, recipesEncountered) => {

  let lastWasConditional = false;

  // transforms the root's contents
  root.contents && root.contents
    .forEach( node => {

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
        node.nodeRecipe = nodeRecipe;
      }

      prepFunctions( node, filename, recipeName );

      node.id = serial++;
      node.recipe = recipe;

      node.desc = `Node '${node.tag}' for '${recipe.name}'`;

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
}; //compileRecipeNodes

// for a recipe node, place the functions in spots where they are
// references by function index
const prepFunctions = (node, filename, recipeName) => {
  const attrs = node.attrs = node.attrs || {};
  const on = node.on = node.on || {};
  const calcs = node.calculate = node.calculate || {};
  Object.keys( node ).forEach( key => {
    const val = node[key];
    if (key.match( /^((pre|on)Load|if|elseif|foreach|listen)$/ ) ) {
      node[key] = funs[ val ];
    } else if (key.match( /^(calculate|on|functions)$/ ) ) {
      Object.keys( val ).forEach( fld => val[fld] = funs[val[fld]]);
    }
  } );
};

// used to grab a recipe given a tag. The tag may cross namespaces if any are defined
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

// given a starting element, return the first of it or
// its children that are marked as 'internalContent' which means
// it is a place for a component node to put any content that it has.
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
