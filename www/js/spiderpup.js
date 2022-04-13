/*

  body has a definition that corresponds to a body entry without any arguments

  onload

     * html.head title, load css & js

     * find html.body recipe & all recipes in all filespaces
         - assign id to each recipe
         - consistency check for if/then/else
         - map name -> recipe (namespace.recipes map)

     * build top instance node for document.body from recipe + body 'request' without args
         - create state (instance builder may take a parent state)
         - has body tag for top instance
         - assign id, state, recipe to instance
         - assign insertion request tag 'args' ( {} in this case ) to instance (as args)
         - assign instance to state

         ~ run preLoad (only for top)

         - create instance node tree (contents)
             * iterate over recipe contents
                 - assign id to instance node
                 - assign top instance node to instance node
                 - attach to contents

     * add instance top node to attach point (document.body)
        - call update node with body recipe, args

     * update node( node/recipe, args )
         - use seen i think
         - find all properties/attributes in args (override) calculate, 
                                                  node calculate, 
                                                  args attrs,
                                                  node attrs
           
         - id of attach point is the id of the instance node or id_0 if the node
           is a foreach node

         - map child element array into element key -> element
         - iterate over node contents / idx
            - check if/then/else ( if 'if', check if value.
                                               if true, proceed with installing node
                                              and set lastif=true,lastifvalue=true
                                              otherwise lastifvalue=false
                                   if 'elseif', check if lastifvalue=false && elseif true
                                               if true, proceed with installing node
                                               and set lastif=true,lastifvalue=true
                                              otherwise lastifvalue=false
                                   if 'else', check if lastifvalue=false
                                               if true, proceed with installing node
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
        const recipes = namespace.recipes = {};
        if (namespace.components) {
          Object.keys(namespace.components)
            .forEach( name => (recipeNames[name] = [namespace.components[name], filename, name] ));
        }
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
    
    // make state
    const state = newState( defaultNamespace );

    // make instance
    const instance = newRecipeInstance( bodyRecipe, {}, state );
    
    // update body with this instance
    hang( instance, document.body );

    instance.rootel = document.body;

    // onLoad called after everything attached
  Promise.resolve( instance.recipe.onLoad && instance.recipe.onLoad( instance.state ) );
  } else {
    console.warn( `no body defined in '${defaultFilename}'` );
  }
};

// refresh the element with the instance node
const hang = (node, el) => {
  const state = node.state;

  // attach the attributes/properties and calculations
  //  (id may not be updated here)
  const seen = { id: 1 };

  // set the attributes from most to least specific for this node
  [node.args.calculate, node.isRecipe && node.recipe.calculate, node.calculate]
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
  [node.args.attrs,node.attrs, node.isRecipe && node.recipe.attrs]
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
  node.textContent && (el.textContent = node.textContent);

  // fill in hidden child elements if there are none.
  if (el.childElementCount === 0 && node.contents.length > 0) {
    node.contents
      .forEach( (childnode,idx) => {
        // check if it is a recipe. if so, the tag is the tag of the recipe root node
        const tag = childnode.isRecipe ? childnode.recipe.rootTag : childnode.tag;

        // now create and attach the element
        const nodeel = document.createElement( tag );
        nodeel.hidden = true;
        nodeel.node = childnode;

        // collect el and compo
        const handle = childnode['attach-el'];
        handle && ( state.el[handle] = nodeel );

        if (childnode.isRecipe) {
          childnode.rootel = nodeel;
        }

        let childkey = childnode.id;
        if (childnode.foreach) {
          childkey = childkey + '_0'; //always have an element zero for tag arrays
        }
        nodeel.id = childkey;

        node.el = nodeel;
        el.append( nodeel );

        // attach event handlers
        childnode.on && Object.keys( childnode.on ).forEach( evname => {
          const evfun = function() {
            const prom = childnode.on[evname]( state, ...arguments );
            Promise.resolve( prom )
              .then( () => {
                if ( state.data._check() ) state.refresh();
              } );
          };
          nodeel.addEventListener( evname, evfun );
        } );

        // also attach on_<foo> stuff
        Object.keys( childnode ).forEach( attr => {
          const l = attr.match( /^on_(.*)/ );
          const evfun = function() {
            const prom = childnode[attr]( state, ...arguments );
            Promise.resolve( prom )
              .then( () => {
                if ( state.data._check() ) state.refresh();
              } );
          }
          if (l) {
            nodeel.addEventListener( l[1], evfun );
          }
        } );
      } );
  }
  
  // now find the children
  let lastWasConditional = false,
      lastConditionalWasTrue = false;

  node.contents
    .forEach( (childNode,idx) => {
      const tagOrComponentName = childNode.tag;

      let childKey = childNode.id;

      if (childNode.if) {
        lastConditionalWasTrue = childNode.if( state );
        lastWasConditional = true;
      } else if (childNode.elseif) {
        if (!lastConditionalWasTrue) {
          lastConditionalWasTrue = childNode.elseif( state );
        }
      } else if (childNode.else) {
        if (!lastConditionalWasTrue) {
          lastConditionalWasTrue = true;
        }
      } else {
        lastWasConditional = false;
      }

      if (childNode.forEach) {
        childKey = childKey + '_0';
      }

      const childEl = document.getElementById(childKey);

      if (lastWasConditional === false || lastConditionalWasTrue) {
        childEl.hidden = false;
        hang( childNode, childEl );
      } else {
        childEl.hidden = true;
      }
    } );
  
  if (node.isRecipe && ! node.didLoad) {
    Promise.resolve( node.recipe.onLoad && node.recipe.onLoad( state ) );
    node.didLoad = true;
  }
  
}; //hang

let serial = 1;
const newState = (recipe,parent) => {
  return {
    id     : serial++,
    desc : 'state',
    parent,

    data   : {
      parent,
      _data: recipe.data || {},
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
    fun    : recipe.functions || {},
    idx    : {}, // iterator name -> iterator index
    it     : {}, // iterator name -> iterator value
    recipe,
    refresh: function() { hang( this.instance, this.instance.rootel ) },
  };
};

const newNodeInstances = (contents,recipeInstance) => {
  if (contents) {
    const recipe = recipeInstance.recipe;
    return contents.map( child => {

      const childrecipe = lookupRecipe( child.tag, recipe.namespace );
      if (child.recipeNode) {
        return newRecipeInstance(child.recipeNode,child,recipeInstance.state);
      }

      const childInstance = {...child};

      childInstance.id = serial++;
      childInstance.desc = 'child instance',
      childInstance.state = recipeInstance.state;
      childInstance.recipe = recipe;
      childInstance.args = {};
      childInstance.contents = newNodeInstances( childInstance.contents, recipeInstance );

      return childInstance;
    } );
  }
  return [];
};

const newRecipeInstance = (recipe,args,state) => {
  state = newState( recipe, state );

  recipe.data && Object.keys( recipe.data )
    .forEach( fld => state.data._data[fld] = recipe.data[fld] );
  
  const id = serial++;
  const instance = {
    args: args || {},
    desc: 'recipe instance',
    id,
    recipe,
    state,
    isRecipe: true,
  };
  instance.contents = newNodeInstances(recipe.contents, instance);
  state.instance = instance;

  // collect compo
  const handle = instance['attach-comp'];
  handle && ( state.parent.comp[handle] = instance );

  // run the preLoad if any
  Promise.resolve( recipe.preLoad && recipe.preLoad( state, args ) );

  return instance;
};

const compileRecipe = (recipe, filename, recipeName, isBody) => {

  try {
    // if the node is just an array, then it is a list of
    // contents without functions or stuff
    if (Array.isArray(recipe)) {
      recipe = { contents: recipe };
    }
    if (!isBody && !( recipe.contents && recipe.contents.length == 1)) {
      throw new Error( "recipe '" + recipeName + "' must contain exactly one root element" );
    }

    recipe.id = serial++;
    recipe.namespace = filespaces[filename];

    prepFunctions( recipe, filename, recipeName );
    compileNodes( recipe, recipe, filename, recipeName, recipe.namespace, [] );

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
      recipe = namespace.namespaces[parts[0]] && namespace.namespaces[parts[0]][parts[1]];
    }
  }
  return recipe;
}

const bigattr = new RegExp( 'class|href|placeholder|required|style|title|type' );

// transform node from {"tag":{...data...}} into { tag, ...data }
// make sure if/then/else blocks are aligned properly.
// if the node is a component, store its data in args
// also toss up an error if there is a circular reference 
const compileNodes = (rootnode, recipe, filename, recipeName, namespace, recipesEncountered) => {

  let lastWasConditional = false;

  rootnode.contents = rootnode.contents
    .map( (nodedata,idx) => {
      const tag = Object.keys( nodedata )[0];

      const recipeNode = lookupRecipe( tag, namespace );
      let node;
      if (recipeNode) {
        if (recipesEncountered[recipeNode.id]++) {
          throw new Error( "circular reference detected" );
        }
        node = {
          recipeNode,
          args: {...nodedata},
        };
      } else {
        node = (nodedata[ tag ] === undefined||nodedata[tag] === null) ? [] : nodedata[ tag ];
        if (Array.isArray(node)) {
          node = { contents: node };
        } else if ( typeof node !== 'object' ) {
          node = { textContent: node === undefined ? '' : node };
        }
      }

      const attrs = node.attrs = node.attrs || {};
      Object.keys( node ).forEach( key => {
        if (key.match( bigattr )) {
          attrs[key] = node[key];
        }
      } );

      node.id = serial++;
      node.desc = 'compiled node';
      node.contents = node.contents || [];
      node.args = node.args || [];
      node.recipe = recipe;
      node.tag = tag;
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
      prepFunctions( node, filename, recipeName );
      compileNodes( node, recipe, filename, recipeName, namespace, recipesEncountered );
      return node;
    } );
};

const prepFunctions = (node, filename, recipeName) => {
  node.preLoad = funs[node.preLoad];
  node.onLoad = funs[node.onLoad];

  // transform function from function indexes to function references
  [ 'calculate', 'on', 'functions' ].forEach( funhash =>
    node[funhash] && Object.keys(node[funhash]).forEach( fun =>
      node[funhash][fun] = funs[node[funhash][fun]] ) );
  if (node.calculate && node.calculate.id) {
    console.warn( `trying to set id for recipe '${recipeName}' in file '${filename}', ignoring` );
  }

  [ 'if', 'elseif', 'foreach' ].forEach( fun => node[fun] && (node[fun] = funs[node[fun]]) );

  Object.keys( node )
    .forEach( fld => {
      if (fld.match( /^on_(.*)/ ) ) {
        node[fld] = funs[node[fld]];
      }
    } );

  return node;
};

/*
EXAMPLE FILES

const funs = [
	s => `welcome ${s.data.get('login').handle}`,
	s => s.data.get( 'login' ),
	s => s.data.get( 'create-account' ),
	(s,ev) => alert('1'),
	(s,ev) => s.fun.checkCreate(ev),
	(s,ev) => s.fun.checkCreate(ev),
	(s,ev) => s.fun.checkCreate(ev),
	(s,ev) => s.fun.login( s, ev ),
	(s,ev) => s.fun.check(ev),
	(s,ev) => s.fun.check(ev),
	(s,ev) => s.data.set('create-account','1'),
	(s,ev) => {
  if (!s.el.login.value) {
     s.el.login.style['background-color'] = 'pink';
  } else {
     delete s.el.login.style['background-color'];
     // s.el.login.style['background-color'] = 'green';
  }
  if (!s.el.password.value) {
     s.el.password.style['background-color'] = 'pink';
  } else {
     delete s.el.password.style['background-color'];
     // s.el.password.style['background-color'] = 'green';
  }
},
	(s,ev) => {
  if (!s.el.handle.value) {
     s.el.handle.style['background-color'] = 'pink';
  } else {
     delete s.el.handle.style['background-color'];
     // s.el.handle.style['background-color'] = 'green';
  }
  if (!s.el.email.value) {
     s.el.email.style['background-color'] = 'pink';
  } else {
     delete s.el.email.style['background-color'];
     // s.el.email.style['background-color'] = 'green';
  }
  if (!s.el.createpassword.value) {
     s.el.createpassword.style['background-color'] = 'pink';
  } else {
     delete s.el.createpassword.style['background-color'];
     // s.el.createpassword.style['background-color'] = 'green';
  }
},
	(s,ev) => s.data.get('app')
                .login( { login: s.el.login.value,
                          password: s.el.password.value } )
                .then( acct => { debugger; acct; } )
                .catch( err => { debugger; err; } ),
	(s,ev) => s.data.get('app')
                .create_account( { handle: s.el.handle.value,
                                   email: s.el.email.value,
                                   password: s.el.createpassword.value } )
                .then( acct => { debugger; acct; } )
                .catch( err => { debugger; err; } ),
	(s,ev) => {
  s.data.set( 'app', yote.apps[s.data.get('app')] );
  debugger;
},
	() => yote.fetchApp( 'test' ).then( testapp => { yote.apps = yote.apps || {}; yote.apps.test = testapp } ),
	(s,ev) => {
   yote.apps.test.echo( "TWA" ).then( r => alert( 'hello world ' + r ) );
},
];
const filespaces = {"../instance/spiderpup/www/recipes/yote_test/hello.yaml":{"html":{"body":{"contents":[{"h1":"yote test"},{"button":{"on":{"click":"funs[17]"},"textContent":"click me"}},{"div":"hi there"},{"loginControl":{"data":{"app":"test"}}}]},"head":{"title":"yote test"},"preLoad":"funs[16]"},"namespaces":{},"components":{"loginControl":{"functions":{"check":"funs[11]","checkCreate":"funs[12]","login":"funs[13]","createAccount":"funs[14]"},"contents":[{"div":[{"div":{"if":"funs[1]","calculate":{"textContent":"funs[0]"}}},{"div":{"contents":[{"form":{"contents":[{"div":{"contents":[{"input":{"on":{"keyup":"funs[4]"},"placeholder":"handle","required":"true","style":"margin: 3px auto","attach-el":"handle","type":"text"}},{"input":{"style":"margin: 3px auto","attach-el":"email","type":"text","on":{"keyup":"funs[5]"},"placeholder":"email","required":"true"}},{"input":{"on":{"keyup":"funs[6]"},"placeholder":"password","required":"true","attach-el":"createpassword","style":"margin: 3px auto","type":"password"}},{"button":{"type":"submit","style":"margin: 3px auto","textContent":"Create Account"}}],"style":"display:flex; flex-direction: column"}}],"style":"display: inline-block; border: solid 3px black; padding: .5em;","on":{"submit":"funs[3]"}}}],"elseif":"funs[2]"}},{"div":{"contents":[{"form":{"style":"display: inline-block; border: solid 3px black; padding: .5em;","contents":[{"div":{"style":"display:flex; flex-direction: column","contents":[{"input":{"style":"margin: 3px auto","attach-el":"login","type":"text","on":{"keyup":"funs[8]"},"placeholder":"login or email","required":"true"}},{"input":{"style":"margin: 3px auto","attach-el":"password","type":"password","on":{"keyup":"funs[9]"},"required":"true","placeholder":"password"}},{"button":{"textContent":"Log In","style":"margin: 3px auto","type":"submit"}},{"a":{"on":{"click":"funs[10]"},"textContent":"create account","href":"#"}}]}}],"on":{"submit":"funs[7]"}}}],"else":null}}]}],"onLoad":"funs[15]"}}}};
const defaultNamespace = ["../instance/spiderpup/www/recipes/yote_test/hello.yaml"][0];

*/

/*
  Including this attaches an 'onload' event to 'window' that activates it
  upon load.

  For a description of how this works, see the end of this file.

let loadEvent;

const parseInstructions = (defaultNamespace,filespaces,funs) => {

  // check if there is an html section defined
  const namespaceRecipe = filespaces[defaultNamespace];

  namespaceRecipe.functions && Object.keys(namespaceRecipe.functions).forEach( fun =>
    namespaceRecipe.functions[fun] = funs[namespaceRecipe.functions[fun]] );

  const html = namespaceRecipe.html;
  if (html) {
    html.preLoad = funs[html.preLoad];
    if (html.preLoad) {
      return Promise.resolve( html.preLoad() )
        .then( () => {
          if (html.head) {
            const head = document.head;

            // documnt title
            if (html.head.title) document.title = html.head.title;

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

            const js = html.head.javascript;
            const jsFiles = Array.isArray( js ) ? js : js ? [js] : [];
            jsFiles.forEach( file => {
              const scr = document.createElement( 'script' );
              scr.setAttribute( 'type', 'module' );
              scr.setAttribute( 'src', file );
              head.appendChild( scr );
            } );
          } //head defined

          Object.keys( filespaces )
            .filter( fsname => fsname !== defaultNamespace )
            .forEach( fsname => buildNamespace( filespaces[fsname], filespaces, funs ) );

          const state = buildNamespace( namespaceRecipe, filespaces, funs ); 
          state && state.refresh();
        } );
    }
  } //if there was html section

} //parseInstructions

const buildNamespace = (namespaceRecipe,filespaces,funs) => {
  const recipeNodes = {}; // name to recipe definiton node

  namespaceRecipe.recipeNodes = recipeNodes;

  // bigAttrs are attributes that work even if they are not
  // under the attribute section
  const bigAttrs = 'href|placeholder|required|style|textContent|title|type'.split( /\|/ );
  const bigAttr = {};
  bigAttrs.forEach( attr => bigAttr[attr] = true );

  let serial = 1;

  const makeKey = ( state, node, forIdx ) => {
    return [ state.instanceID,
             node.id,
             recipeNodes[node.name] ? node.name : '*',
             forIdx === undefined ? '*' : forIdx ].join('_');
  }

  const makeState = (parentState, recipeNode, instanceNode) => {
    let data, instanceFuns = {};


    const state = {
      instanceID  : serial++,

      data        : undefined, // state object 
      comp        : {}, // handle -> component state
      create      : undefined, // function ( args )
      el          : {}, // handle -> element
      fun         : instanceFuns,
      glob        : parentState && parentState.glob,
      idx         : {}, // iterator name -> iterator index
      it          : {}, // iterator name -> iterator value
      parent      : parentState,
      refresh     : undefined, // function to refresh this node
      vars        : {}, // name -> value
    };

    if (instanceNode) {
      state.create = (recipeName,nodeArgs) => { // { recipeName, attach(To|Before|After) : attachElement }
        const newnode = makeRecipeNode( recipeName, nodeArgs );
        
        // insert the node into the matching content
        if (nodeArgs.attachTo) {
          const oldnode = state.el[nodeArgs.attachTo].instanceNode;
          oldnode.contents.push( newnode );
        }
        else if(nodeArgs.attachBefore) {
          const beforeAfter = nodeArgs.attachBefore || nodeArgs.attachAfter;
          if (beforeAfter) {
            const con = nodeArgs.attachBefore ? nodeArgs.attachBefore.parent.contents : nodeArgs.attachAfter.parent.contents;
          }
        }
        state.data._changed = true;
      };
    }

    
    // if it wasn't assigned a glob, it is the glob
    // states is going to have a gotcha
    state.glob || ( state.glob = state );

    if (recipeNode) {
      if (parentState) {
        Object.keys( parentState.fun )
          .forEach( fn => instanceFuns[fn] = parentState.fun[fn] );
      }

      data = {...recipeNode.data};

      recipeNode.functions && Object.keys( recipeNode.functions )
        .forEach( fn => instanceFuns[fn] = function() { recipeNode.functions[fn]( state, ...arguments ) } );

      if (instanceNode && instanceNode !== recipeNode) {
        instanceNode.data && Object.keys( instanceNode.data )
          .forEach( fld => data[fld] = instanceNode.data[fld] );
        instanceNode.functions &&
          Object.keys( instanceNode.functions )
          .forEach( funname =>
            instanceFuns[funname] = function() { instanceNode.functions[funname]( state, ...arguments ) } );
      }
    }

    state.fun = instanceFuns;

    state.data = {
      _data : data || {},
      _check : function() { const changed = this._changed; this._changed = false; return changed; },
      _changed : false,
      get : function(k,defval) { if (this._data[k] === undefined) this._data[k] = defval; return this._data[k] },
      set : function(k,v) { this._changed = v !== this._data[k];
                            this._data[k] = v; },
    };
    return state;
  } //makeState

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

  const makeRecipeNode = (name,rawNode,isRecipeRoot) => {
    if (!rawNode) {
      throw new Error( "unable to make recipe, no content for '" + name + "' defined" );
    }
    const node = Array.isArray(rawNode) ?
          { contents: rawNode } :
          typeof rawNode === 'object' ?
          rawNode : 
          { textContent: rawNode };

    node.namespaceRecipe = namespaceRecipe;
    node.id = serial++;
    node.name = name;

    const hashes = [ 'on', 'calculate', 'attributes' ];
    if (isRecipeRoot) {
      if (node.contents.length !== 1) {
        console.error( "recipe '" + name + "' must contain exactly one root element" );
        return;
      }
      if (recipeNodes[node.contents[0].name]) {
        console.error( "recipe '" + name + "' root element must not be other recipe" );
        return;
      }
      hashes.push( 'data','functions' );
      node.onLoad !== undefined && ( node.onLoad = funs[node.onLoad] );
    }
    hashes.forEach( hash => node[hash] || ( node[hash] = {} ) );

    node.contents || ( node.contents = [] );

    // transform function from function indexes to function references
    [ 'calculate', 'on', 'functions' ].forEach( funhash =>
      node[funhash] && Object.keys(node[funhash]).forEach( fun =>
        node[funhash][fun] = funs[node[funhash][fun]] ) );

    [ 'if', 'elseif', 'foreach' ].forEach( fun => node[fun] && (node[fun] = funs[node[fun]]) );

    node.contents = node.contents.map( con => {
      let newnode;
      if ( typeof con === 'object' ) {
        const conname = Object.keys( con )[0];
        const connode = con[conname] || {};
        newnode = makeRecipeNode( conname, connode );
      } else {
        newnode = makeRecipeNode( con, {} );
      }
      newnode.parent = node;
      return newnode;
    } );

    return node;

  }; //makeRecipeNode

  const build = (args) => {
    let buildNode   = args.buildNode;
    let state       = args.state;
    let nsr         = args.namespaceRecipe || buildNode.namespaceRecipe || namespaceRecipe;
    let recipeNodes = nsr.recipeNodes;

    const key = args.key || makeKey( state, buildNode, args.forIdx);

    const key2el = args.key2el || (args.attachTo && makeKey2el( args.attachTo ) ) || {};

    let el = buildNode.name === 'body' ? document.body : key2el[key];

    let instanceNode = buildNode;

    const nodeNames = instanceNode.name.split( /\./ );
    let recipeNode;
    if (nodeNames.length === 2) {
      const filespace = nsr.namespaces[nodeNames[0]];
      if (!filespace) {
        console.error( "namespace '${ns}' not found" );
        return;
      }
      recipeNode = filespaces[filespace].recipeNodes[nodeNames[1]];
    } else if (nodeNames.length === 1) {
      recipeNode = recipeNodes[nodeNames[0]];
    } else {
      console.error( 'recipe name has something other than one or two parts' );
      return;
    }
    if (!el) {
      if (recipeNode) {
        // rather than an html element tag, a recipe is indicated at this spot

        // the job of the recipe node is to
        // create a state for an instance and also to handle the onLoad event
        const subCompoState = makeState( state, recipeNode, buildNode );

        // the rootNode is the definition of the top level container
        const rootNode = recipeNode.contents[0];
        const rootArgs = {...args};
        rootArgs.state = subCompoState;
        rootArgs.buildNode = rootNode;
        rootArgs.namespaceRecipe = recipeNode.namespaceRecipe,
        el = build( rootArgs );

        recipeNode.onLoad !== undefined && Promise.resolve(recipeNode.onLoad( state )).then( () => { if ( state.data._check() ) state.refresh() } );

        const handle = instanceNode['attach-comp'];
        handle && ( state.comp[handle] = subCompoState );

        el.key = key;
        el.state = subCompoState;
        el.instanceNode = rootNode;
        el.recipeAttachNode = instanceNode;

        const refreshArgs = {...args};
        delete refreshArgs.key2el;
        subCompoState.refresh = () => build( { buildNode,
                                               state,
                                               namespaceRecipe : recipeNode.namespaceRecipe,
                                               ...refreshArgs } );
        state = subCompoState;
      }
      else {
        // this spot has an html element not yet created

        el = document.createElement( instanceNode.name );

        if ('internalContent' in instanceNode) {
          el.internalContent = true;
        }

        el.key = key;
        el.instanceNode = buildNode;
        el.state = state;
        if (args.attachAfter) {
          args.attachAfter.after( el );
        } else if (args.attachBefore) {
          args.attachBefore.after( el );
        } else {
          args.attachTo.append( el );
        }

        const handle = instanceNode['attach-el'];
        handle && ( state.el[handle] = el );

      }

      // attach new element attributes (text/class/attributes)
      bigAttrs.forEach( attr => instanceNode[attr] !== undefined && (el[attr] = instanceNode[attr]) );
      instanceNode.class && instanceNode.class.split( / +/ ).forEach( cls => el.classList.add( cls ) );

      Object.keys( instanceNode.attributes ).forEach( attr => el.setAttribute( attr, instanceNode.attributes[attr] ) );

      // attach event handlers
      Object.keys( instanceNode.on ).forEach( evname => {
        const evfun = function() {
          const prom = instanceNode.on[evname]( state, ...arguments );
          Promise.resolve( prom )
            .then( () => {
              if ( state.data._check() ) state.refresh();
            } );
        };
        el.addEventListener( evname, evfun );
      } );

      // yote updates should also cause refreshes? can call state.refresh i guess
      
    }
    else if(buildNode.name !== 'body')  {
      instanceNode = el.instanceNode;
      state = el.state;
    }


    // now fill in the contents of the node to the existing or newly created element
    let attachEl = recipeNode ? findInternalContent(el) : el;

    const k2e = makeKey2el( attachEl );

    // place children
    let attachAfter;
    let lastWasIf = false;
    let lastSucceeded = false;

    // connode -> content node
    instanceNode.contents.forEach( connode => {

      const conkey = makeKey( state, connode );
      const conel = k2e[conkey];

      // if check to make sure a) the branch is valid and b) the branch should be tested
      let proceed = true;
      if ('elseif' in connode || 'else' in connode) {
        if (! lastWasIf) {
          console.error( 'have else or elseif without if' );
          return;
        }
        if (lastSucceeded) {
          proceed = false;
        }
      }

      if (proceed) {
        let test = connode.if || connode.elseif;
        if (test) {
          lastWasIf = true;
          if (test( state )) {
            if (conel) {
              delete conel.hide;
            }
          } else {
            // remove the old node and return
            if (conel) {
              conel.hide = true;
              attachEl.removeChild( conel );
              const handle = connode['attach-comp'];
              handle && ( delete state.comp[handle] );
            }
            lastSucceeded = false;
            return;
          }
          lastSucceeded = true;
        }
      } else {
        // remove any unvisited branch elements and return
        if (conel) {
          attachEl.removeChild( conel );
        }
        return;
      }

      // at this point, its either not in a branch or is in a branch that passed

      if ('foreach' in connode && 'forval' in connode) {
        const list = connode.foreach( state );
        const fv = connode.forval;
        list.forEach( (li,idx) => {
          state.it[fv] = li;
          state.idx[fv] = idx;
          attachAfter = build( {
            buildNode: connode,
            state,
            attachTo: attachEl,
            key2el: k2e,
            forIdx: idx,
            attachAfter,
          } );
        } );
      } else {
        attachAfter = build( { buildNode: connode,
                               state,
                               attachTo: attachEl,
                               key2el: k2e,
                               attachAfter } );
      }
    } );

    // new element attribute calculations (AFTER children are placed)
    // since they may depend on states adding el or con
    const recipeAttachNode = el.recipeAttachNode;
    instanceNode = el.instanceNode;

    recipeAttachNode && Object.keys( recipeAttachNode.calculate ).forEach( attr => {
      const val = recipeAttachNode.calculate[attr]( el.state );
      if (attr === 'class') {
        el.removeAttribute( 'class' );
        val.split( / +/ ).forEach( cls => el.classList.add( cls ) );
      } else if (bigAttr[attr]) {
        el[attr] = val;
      } else {
        el.setAttribute( attr, el.attributes[attr] );
      }
    } );

    instanceNode && Object.keys( instanceNode.calculate ).forEach( attr => {
      const val = instanceNode.calculate[attr]( el.state );
      if (attr === 'class') {
        el.removeAttribute( 'class' );
        val.split( / +/ ).forEach( cls => el.classList.add( cls ) );
      } else if (bigAttr[attr]) {
        el[attr] = val;
      } else {
        el.setAttribute( attr, el.attributes[attr] );
      }
    } );

    return el;

  }; //build

  const makeKey2el = el => {
    const key2children = {};
    Array.from(el.children)
      .forEach( chld => key2children[chld.key] = chld );
    return key2children;
  };

  // const contentInfo = con => {
  //     const conname = Object.keys( con )[0];
  //     const connode = con[conname] || {};
  //     return [conname, connode];
  // }


  // build recipes outlined in the 'components' section of the yaml
  const components = namespaceRecipe.components;
  components && Object.keys( components ).forEach( name => (
    recipeNodes[name] = makeRecipeNode( name, components[name], true )
  ) );

  const html = namespaceRecipe.html;

  if (html.body) {
    // creates the function that generates the body
    // and stores it in builders['body'] = fun
    // it takes a special yaml node so there is always one
    // root for the body recipe
    const bodyNode = makeRecipeNode( 'body', html.body );
    bodyNode.namespaceRecipe = namespaceRecipe;

    const state = makeState(undefined, namespaceRecipe, bodyNode);
    state.refresh = () => build( { buildNode: bodyNode, state } );
    const headfun = html.head && html.head.functions;
    headfun && Object.keys(headfun)
      .forEach( fun => {
        headfun[fun] = funs[headfun[fun]];
        state.fun[fun] = headfun[fun];
      } );

    // check onload event for html
    html.onLoad = funs[html.onLoad];
    if (html.onLoad) {
      loadEvent = ev => Promise.resolve(html.onLoad(state,ev)).then( () => {
        if ( state.data._check() ) state.refresh() } ); 
    }
    
    return state;
  } //if there was a body

} //buildNamespace

window.onload = ev => {
  parseInstructions( defaultNamespace, filespaces, funs )
    .then( () => loadEvent && loadEvent(ev) );
}
*/

/*
  This is complicated. How does it do what it does?

  *onload*

  It installs an 'onload' event to the 'window', and runs
  parseInstructions on it, using 3 global variabled defined
  by Yote::SpiderPup when it generates the page specific javascript

  defaultNamespace, filespaces and funs

  These are created by the Yote::SpiderPup server process and defined
  in the page's YAML file.
  funs - an array of javascript functions
  filespaces - a hash of filename --> yaml data structure from that file
  defaultNameSpace - the filename corresponding to the default namespace
  
  funs is used as a workaround because functions can't be crammed into JSON.
  where data structures should have functions, they have an index to a function
  in the funs array. the parser replaces those indexes with the actual functions.

  filespaces is filled by the original yaml file and any files it imports and
  any files those import (and deeper, etc)

  *parseInstructions*

  parseInstructions is called with those 3 arguments. It only does something if
  an html body is defined in the defaultNameSpace file.

  buildNamespace is called on all the filespaces. the last time it is called is
  on the default namespace. it returns a state object and the page is finally built
  by calling the 'refresh' method on that state.

  *buildNamespace*

  a namespace in this case is the data structure defined by yaml in a single file.
  it returns a state object if an html body is defined in the yaml.

  it treats the 'components' of the namespace each as a recipe node. each recipe node
  gets a serialized id. when a component is instantiated (placed in either the body 
  or in an instance of an other component), a state object an instance node object 
  is created for that.

  each state object gets a serialized id. each instance node gets an id that is composed
  of its recipe node's id and its state's id.

*/
