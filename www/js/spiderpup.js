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

    const bodyRecipe = compileRecipe( html.body, defaultFilename, 'body', true );
    
    // make state
    const state = newState( defaultNamespace );

    // make instance
    const instance = instantiateRecipe( bodyRecipe, {}, state );
    
    // update body with this instance
    hang( instance, document.body );

    instance.rootel = document.body;

    // onLoad called after everything attached
  Promise.resolve( instance.recipe.onLoad && instance.recipe.onLoad( instance.state ) );
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
      lastConditionalWasTrue = false;

  instance.contents
    .forEach( childInstance => {
      const tagOrComponentName = childInstance.tag;
      const key = childInstance.key;
      const childEl = key2el[key];

      if (childInstance.if) {
        lastConditionalWasTrue = childInstance.if( state );
        lastWasConditional = true;
      } else if (childInstance.elseif) {
        if (!lastConditionalWasTrue) {
          lastConditionalWasTrue = childInstance.elseif( state );
        }
      } else if (childInstance.else) {
        if (!lastConditionalWasTrue) {
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
    Promise.resolve( instance.recipe.onLoad && instance.recipe.onLoad( state ) );
    instance.didLoad = true;
  }
  
}; //hang

let serial = 1;
const newState = (recipe,parent,args) => {

  const data = {};
  [recipe,args]
    .forEach( level => level && level.data && Object.keys(level.data).forEach( arg => data[arg] = level.data[arg] ) );

  const funs = parent ? {...parent.fun} : {};
  [recipe,args]
    .forEach( level => level && level.functions && Object.keys(level.functions).forEach( fun => funs[fun] = level.functions[fun] ) );

  return {
    id     : serial++,
    desc : 'state',
    parent,

    data   : {
      parent,
      _data: data,
      _check: function() { const changed = this._changed; 
                           this._changed = false; return changed; },
      _changed: false,
      get: function(k) { if (k in this._data) return this._data[k]; 
                         return this.parent && this.parent.data.get( k ); },
      set: function(k,v) { this._changed = v !== this._data[k];
                           this._data[k] = v; },
    }, 
    calc   : {}, // attribute name -> calculation
    comp   : {}, // handle -> component state?
    el     : {}, // handle -> element
    fun    : funs,
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value
    lastcount: {}, // iterator name -> last list count
    recipe,
    refresh: function() { hang( this.instance, this.instance.rootel ) },
  };
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
  const handle = instance.handle;
  handle && ( state.parent.comp[handle] = instance );

  // run the preLoad if any
  Promise.resolve( recipe.preLoad && recipe.preLoad( state, args ) );

  return instance;
};

const compileRecipe = (recipe, filename, recipeName, isBody) => {

  try {
    if (!isBody && !( recipe.contents && recipe.contents.length == 1)) {
      throw new Error( "recipe '" + recipeName + "' must contain exactly one root element" );
    }

    recipe.id = serial++;
    recipe.namespace = filespaces[filename];

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

const prepFunctions = (node, filename, recipeName) => {
  const attrs = node.attrs = node.attrs || {};
  const on = node.on = node.on || {};
  const calcs = node.calculate = node.calculate || {};
  Object.keys( node ).forEach( key => {
    const val = node[key];
    const m = key.match( /^on_(.*)/ );
    if (m) {
      on[ m[1] ] = funs[ val ];
    } else if (key.match( /^((pre|on)Load|if|elseif|else|foreach)$/ ) ) {
      node[key] = funs[ val ];
    } else if (key.match( /^(calculate|on|functions)$/ ) ) {
      Object.keys( val ).forEach( fld => val[fld] = funs[val[fld]]);
    }
  } );
};
