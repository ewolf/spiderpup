/*
  Including this attaches an 'onload' event to 'window' that activates it
  upon load.

  For a description of how this works, see the end of this file.
 */
let loadEvent;
const parseInstructions = (defaultNamespace,filespaces,funs) => {

    // check if there is an html section defined
    const namespaceRecipe = filespaces[defaultNamespace];

    namespaceRecipe.functions && Object.keys(namespaceRecipe.functions).forEach( fun =>
            namespaceRecipe.functions[fun] = funs[namespaceRecipe.functions[fun]] );

    const html = namespaceRecipe.html;
    if (html) {
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

    } //if there was html sectinon

} //parseInstructions

const buildNamespace = (namespaceRecipe,filespaces,funs) => {
    const recipeNodes = {}; // name to recipe definiton node

    namespaceRecipe.recipeNodes = recipeNodes;

    // bigAttrs are attributes that work even if they are not
    // under the attribute section
    const bigAttrs = 'textContent|style|type|title'.split( /\|/ );
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
            node.onLoad && ( node.onLoad = funs[node.onLoad] );
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

                recipeNode.onLoad && recipeNode.onLoad( state );

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

            Object.keys( instanceNode.attributes ).forEach( attr => el.setAttribute( attr, el.attributes[attr] ) );

            // attach event handlers
            Object.keys( instanceNode.on ).forEach( evname => {
                const evfun = function() {
                    instanceNode.on[evname]( state, ...arguments );
                    if ( state.data._check() ) state.refresh();
                };
                el.addEventListener( evname, evfun );
            } );
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
                    if (! test( state )) {
                        // remove the old node and return
                        if (conel) {
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
        html.onLoad && (loadEvent = ev => funs[html.onLoad](state,ev));
        
        return state;
    } //if there was a body

} //buildNamespace

window.onload = ev => {
    parseInstructions( defaultNamespace, filespaces, funs );
    loadEvent && loadEvent(ev);
}

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
