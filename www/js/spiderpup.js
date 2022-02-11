const parseInstructions = (instrs,funs) => {
    const recipeNodes = {};

    let serial = 1;

    const makeKey = ( state, node, forIdx ) => {
        return [ state.instanceID,
                 node.id,
                 recipeNodes[node.name] ? node.name : '*',
                 forIdx === undefined ? '*' : forIdx ].join('_');
    }

    const makeState = (parentState, recipeNode, instanceNode) => {
        let data, instanceFuns;
        if (recipeNode) {
            data = {...recipeNode.data};
            instanceFuns = {...recipeNode.functions};
            instanceNode.data && Object.keys( instanceNode.data ).forEach( fld => data[fld] = instanceNode.data[fld] );
            instanceNode.functions && Object.keys( instanceNode.functions ).forEach( funname => instanceFuns[funname] = instanceNode.functions[funname] );
        }

        const state = {
            instanceID  : serial++,
            parent      : parentState,
            fun         : instanceFuns,
            comp        : {}, // handle -> component
            idx         : {}, // iterator name -> iterator index
            it          : {}, // iterator name -> iterator value
            el          : {}, // handle -> element
        };

        state.data = {
            _data : data || {},
            get : function(k) { return this._data[k] },
            set : function(k,v) { const changed = v !== this._data[k];
                                  this._data[k] = v;
                                  if (changed) { state.refresh() } }
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
        const node = Array.isArray(rawNode)
              ? { contents: rawNode }
              : typeof rawNode === 'object'
              ? rawNode
              : { textContent: rawNode };
        node.id = serial++;
        node.name = name;

        const hashes = [ 'events', 'calculate', 'attributes' ];
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
        [ 'calculate', 'events', 'functions' ].forEach( funhash =>
            node[funhash] && Object.keys(node[funhash]).forEach( fun =>
                node[funhash][fun] = funs[node[funhash][fun]] ) );

        [ 'if', 'elseif', 'foreach' ].forEach( fun => node[fun] && (node[fun] = funs[node[fun]]) );

        node.contents = node.contents.map( con => {
            const conname = Object.keys( con )[0];
            const connode = con[conname] || {};
            return makeRecipeNode( conname, connode );
        } );

        return node;

    }; //makeRecipeNode

    const build = (args) => {
        let buildNode = args.buildNode;
        let state     = args.state;

        const key = args.key || makeKey( state, buildNode, args.forIdx);

        const key2el = args.key2el || (args.attachTo && makeKey2el( args.attachTo ) ) || {};

        let el = buildNode.name === 'body' ? document.body : key2el[key];

        let instanceNode = buildNode;
        let recipeNode = recipeNodes[instanceNode.name];
        if (!el) {

            if (recipeNode) {
                // the job of the recipe node is to 
                // create a state for an instance and also to handle the onLoad event

                const subCompoState = makeState( state, recipeNode, buildNode );
                const rootNode = recipeNode.contents[0];
                const rootArgs = {...args};
                rootArgs.state = subCompoState;
                rootArgs.buildNode = rootNode;
                el = build( rootArgs );

                recipeNode.onLoad && recipeNode.onLoad( state );

                const handle = instanceNode.handle;
                handle && ( state.comp[handle] = subCompoState );

                el.key = key;
                el.state = subCompoState;
                el.instanceNode = rootNode;
                el.recipeAttachNode = instanceNode;

                const refreshArgs = {...args};
                delete refreshArgs.key2el;
                subCompoState.refresh = () => build( { buildNode,
                                                       state,
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
                } else {
                    args.attachTo.append( el );
                }

                const handle = instanceNode.handle;
                handle && ( state.el[handle] = el );

            }

            // attach new element attributes (text/class/attributes)
            instanceNode.textContent && (el.textContent = instanceNode.textContent);
            instanceNode.class && instanceNode.class.split( / +/ ).forEach( cls => el.classList.add( cls ) );
            Object.keys( instanceNode.attributes ).forEach( attr => el.setAttribute( attr, el.attributes[attr] ) );

            // attach event handlers
            Object.keys( instanceNode.events ).forEach( evname => {
                const evfun = function() { instanceNode.events[evname]( state, arguments ) };
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
                            const handle = connode.handle;
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
        recipeAttachNode = el.recipeAttachNode;
        instanceNode = el.instanceNode;

        recipeAttachNode && Object.keys( recipeAttachNode.calculate ).forEach( attr => {
            const val = recipeAttachNode.calculate[attr]( el.state );
            if (attr === 'class') {
                el.removeAttribute( 'class' );
                val.split( / +/ ).forEach( cls => el.classList.add( cls ) );
            } else if (attr === 'textContent') {
                el.textContent = val;
            } else {
                el.setAttribute( attr, el.attributes[attr] );
            }
        } );

        instanceNode && Object.keys( instanceNode.calculate ).forEach( attr => {
            const val = instanceNode.calculate[attr]( el.state );
            if (attr === 'class') {
                el.removeAttribute( 'class' );
                val.split( / +/ ).forEach( cls => el.classList.add( cls ) );
            } else if (attr === 'textContent') {
                el.textContent = val;
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

    const contentInfo = con => {
        const conname = Object.keys( con )[0];
        const connode = con[conname] || {};
        return [conname, connode];
    }


    // build recipes outlined in the 'components' section of the yaml
    instrs.components && Object.keys( instrs.components ).forEach( name => {
        recipeNodes[name] = makeRecipeNode( name, instrs.components[name], true );
    } );


    // check if there is an html section defined

    const html = instrs.html;
    if (html) {
        document.title = (html.head && html.head.title) || '';
        if (html.head) {
        }

        if (html.body) {
            // creates the function that generates the body
            // and stores it in builders['body'] = fun
            // it takes a special yaml node so there is always one
            // root for the body recipe
            const bodyNode = makeRecipeNode( 'body', html.body );
            console.log( recipeNodes, bodyNode, "NODEZ" );

            const state = makeState();
            state.refresh = () => build( { buildNode: bodyNode, state } );
            state.refresh();
        } //if there was a body
    } //if there was html section

} //parseInstructions

window.onload = () => {
    parseInstructions( instructions, funs );
}
