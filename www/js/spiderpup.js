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

    state.refresh( document.body );

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
  [instance.args && instance.args.calculate, instance.calculate, instance.isRecipe && instance.recipe.calculate]
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

  // make sure each child element defined in the instance node is in the document.
  // if a handle is defined for that instance node, add it to state.el[handle] -> element
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

        // TODO - this bit is not needed since on_<foo> is converted to on: foo
        //        by perl. disable and test
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
        // hide old nodes if they are not going to be shown
        // for the case of foreach nodes, hide them all
        childEl.hidden = true;
        if (childInstance.foreach) {
          const lastCount = state.lastcount[childInstance.forval];
          if (lastCount > 1) {
            for (let i=1; i<lastCount; i++) {
              const basekey = key.replace( /_0$/, '' );
              const itEl = key2el[basekey + '_' + i];
              itEl && (itEl.hidden = true);
            }
          }
        }
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

  // discover state data and state data generating functions
  // that will be called after the state is set up
  // newState is also where the preLoad routine should be called
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
  //     call postLoad passing it the data
  //
  const data = {};
  const dataFunConvert = {};

  // populate data and dataFunConvert
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

  // get a state object ready before calling the dataFunConvert and preLoad
  // to populate the data
  const state = {
    id     : serial++,

    desc : 'state',

    parent,

    _key2substate: {},

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

    refreshOld: function() { hang( this.instance, this.instance.rootel ) },

    refresh: function( el, key, node ) {

      const state = this;
      const recipe = state.recipe;
      key = key || state.id; // for foreach case
      node = node || recipe.contents[0];

      const needsInit = el.key ? false : true;
      if (needsInit) {
        // element has not been given a key, so not initied
        el.key = key;
        state.rootEl = el;

        // attach any event handlers
        node.on && Object.keys( node.on ).forEach( evname => {
          const evfun = function() {
            const prom = con.on[evname]( state, ...arguments );
            // resolve in case it returns undefined or returns a promise
            Promise.resolve( prom )
              .then( () => {
                if ( state.data._check() ) state.refresh();
              } );
          };
          el.addEventListener( evname, evfun );
        } );


        console.warn( "how about defining component events that can be listened to" );
      }

      // update element attrs and textContent assigned thru calculation
      const seen = { id: 1 };
      [ node.calculate, node.args && node.args.calculate ]
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

      // update element attrs and textContent assigned with constants
      [ node.args && node.args.attrs, instance.attrs ]
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

      // get a census of key --> element for child elements of this element.
      // then build the nodes as needed
      const key2el = {};
      Array.from( el.children )
        .forEach( el => el.key && ( key2el[el.key] = el ) );

      // now fill in the contents. first make sure that the contents have
      // corresponding elements

      recipe.contents
        .forEach( con => {
          let conKey, conEl;
          const conRecipe = con.nodeRecipe;
          if (conRecipe) {
            // translate conRecipe id and con id to a state lookup
            const lookup = `${state.id}_${conRecipe}`;
            let conState = state._key2substate[ lookup ];
            if ( ! conState ) {
              conState = newState(conRecipe,state,con);
              state._key2substate[ lookup ] = conState;
            }
            conKey = conState.id;
          } else {
            conKey = `${state.id}_${con.id}`;
          }
          if (con.foreach) {
            conKey = conKey + '_0';
          }
          conEl = key2el[ conKey ];
          if (!conEl) {
            conEl = document.createElement( conRecipe ? conRecipe.rootTag : con.tag );
            conEl.hidden = true;
            conEl.key = conKey;
            el.append( conEl );
          }

          if (con.foreach) {

          } else if (conRecipe) {
              conState.refresh( conEl, undefined, con );
              if (con.contents) {
                // more contents to hang inside a child of the internal component
                // though maybe in refresh?
                const intEl = findInternalContent( conEl );
                if (intEl) {
                  conState.refresh( intEl, undefined, con.contents );
                }
              }
          } else {
            state.refresh( conEl, conKey, con );
          }

        } );
    },

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

const instantiateRecipeContents = (contents,recipeInstance) => {
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
      childInstance.contents = instantiateRecipeContents( childInstance.contents, recipeInstance );

      return childInstance;
    } );
  }
  return [];
};

const instantiateRecipe = (recipe,args,state) => {

  state = newState( recipe, state, args );

  const instance = {
    args: args || {},
    desc: 'recipe instance',
    id: serial++,
    recipe,
    state,
    isRecipe: true,
  };

  // run the preLoad if any
  instance.preLoad = recipe.preLoad && recipe.preLoad( state, args );

  instance.contents = instantiateRecipeContents(recipe.contents, instance);
  state.instance = instance;

  // collect compo
  const handle = args && args.handle;
  handle && ( state.parent.comp[handle] = instance );

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

  // transforms the root's contents
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
