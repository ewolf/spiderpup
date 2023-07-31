/*
   TODO:
     instance node attrs to root element?
     import_into_namespace (and test)
     test listen
     test events
     test component looping
     test component looping with named contents and contents

 */


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

 Init
   * updates the namespace and recipes attached to it
   * converts any page body into a contents node
   * attaches styles, css links and script tags to the head
   * instantiates a body instance object
   * calls refresh on the body instance object

 NAMESPACE DATA STRUCTURE --------------------------

   a namespace has fields:

     about                 -> "text talking about this namespace"
     recipes               -> { name  -> recipe }
     alias_namespaces      -> { alias -> namespace filename }
     import_into_namespace -> [ list of namespace filenames ]
     functions  -> { name  -> function }
     data       -> { field -> value } <specific to namespace>
     html       -> {
         head -> {
           script -> javascript text
           title  -> string
           style  -> css text
           css -> single or list of filenames
           javascript -> single or list of filenames
         }
         body -> {
           postLoad -> function
           preLoad  -> function
           when     -> { eventname -> function }
           contents -> [ element|component instance nodes...]
           listen   -> function
         }
        }
     // the following are calculated and added
       id -> serialized number
       name -> "[namespace foo]"
       filename   -> "filename"
       content -> { tag: 'body',
                    listen: function (from body node if present)
                    preLoad: function (from body node if present)
                    postLoad: function (from body node if present)
                    when: function (from body node if present)
                    contents: [ body node (if body present) ] }

       // alias_namespaces values are updated from filename to namespace node
       alias_namespaces      -> { alias -> namespace node }

       fun -> { name -> function (with namespace as first arg) }

       // methods
       -> error( msg ) throws an error and errors to console
       -> recipeForTag( tag ) -> returns recipe node (if any matches tag)

 RECIPE DATA STRUCTURE -----------------------

  a component (recipe) node has fields
    functions  -> { name -> function }
    data       -> { field -> value }
    when       -> { component event -> function }
    listen     -> function
    postLoad   -> function
    preLoad    -> function
    contents   -> [single element or component node]
    fill_contents -> { name -> [element or component nodes] }

    // the following are calculated and added to recipe
       id -> serialized number
       name -> "[namespace foo]"
       defaultFillNode -> element node
       namedFillNode -> { name -> element node }

    Recipe Object fields/methods
       rootBuilder -> Component Builder for this recipe
       namedFillBuilders -> { name -> Builder to add named fill content to }
       fillBuilder -> Builder where to put default fill content to

 ELEMENT DATA STRUCTURE -----------------------

 an element node has the following fields:
   tag              -> element tagname
   contents         -> [element or component instance, element or component instance, ... ]
   handle           -> handle name for instance.el hash
   if|elsif|foreach -> function
   else             -> true
   forvar           -> looping variable name
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
   forvar           -> looping variable name
   on               -> { component event name -> event function }
   attrs            -> { attributename -> value or function }
   fill_contents    -> { filltargetname -> [ element or component instances ] }

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
   top -> the body instance this instance is ultimetly contained in
   id -> serialized id
   data -> { fieldname -> value } * inherited from parent if the fieldname is not defined in the component instance node
   _check      -> function
   rootEl      -> html element that is the top container for this component instance

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

   if this is the first time the instance was refreshed, postLoad is called
   as the last part of the rfresh

 */

// -------- LAUNCH ------
const SP = window.SP ||= {};
{
  console.warn( "class handling should be rewritten to additive classes and calculated classes" );
  console.warn( "need to put fill contents in for looped instances" );

  let sp_filespaces;

  window.onload = ev => {
    console.log( filespaces, 'filespaces' );
    init( filespaces, defaultFilename );
  }

  // --------  CODE  ------

  const ID_2_N = [];
  const FN_2_NS = {};

  let useTest = false;

  const defaultBodyRecipe = {
    contents: [ { tag: 'body' } ],
  };

  /** slap an id onto a node, that id is its index in ID_2_N */
  function id(node) {
    node.id = ID_2_N.length;
    ID_2_N.push( node);
  }

  /** return node for id */
  SP.lookup = id => ID_2_N[id];

  /** return node for query selector  */
  SP.lookup_node = sel => {
    const el = document.querySelector( sel );
    return el && ID_2_N[el.dataset.spid];
  };

  /** copy the component or element node. if the node has a fill, update
      the recipe to that fill */
  function copyNode( node, recipe ) {
    // copy style node, it is 2 deep so would be
    // shallow in copy operation
    const newStyle = node.attrs && node.attrs.style && copyNode(node.attrs.style||{});

    const nodeFields = ['tag', 'fill', 'key', 'handle', 'comp', 'if', 'elseif', 'else',
                        'foreach', 'forvar', 'on', 'when', 'attrs'];

    const newnode = copy( node, nodeFields );

    newStyle && (newnode.attrs.style = newStyle);

    newnode.contents = (node.contents||[]).map( c => copyNode( c, recipe ) );

    id(newnode);

    if (newnode.fill === true) {
      recipe.defaultFillNode = newnode;
    } else if (newnode.fill) {
      recipe.namedFillNode[newnode.fill] = newnode;
    }

    return newnode;
  } // copyNode function

  /** return shallow copy of object made from passed in fields */
  function copy( obj, fields ) {
    if (typeof obj === 'object') {
      const newo = {};
      (fields || Object.keys(obj))
        .forEach( fld => (newo[fld] = copy(obj[fld])) );
      return newo;
    }
    return obj;
  }

  /** place key value pairs on dest if the key is new  */
  function overlayFromTo( source, dest ) {
    Object.keys( source || {} )
      .forEach( fld => ((fld in dest) || (dest[fld] = source[fld]) ));
  }

  /** return value or function result */
  function dataVal( inst, valOrFun ) {
    return typeof valOrFun === 'function' ? valOrFun(inst) : valOrFun;
  }

  /** return instance object, prepped */
  function createInstance( conNode, parentInstance, key ) {
    console.warn( 'chccck on rootNode here...is it quite right? only body has no key' );
    const inst = {
      recipe: conNode.recipe,
      namespace: conNode.recipe.namespace,
      rootNode: (key && conNode.recipe.contents[0]) || conNode,
      instNode: conNode,
      it: {},
      idx: {},
      el: {},
      comp: {},
      fun: {},
      childInstances: {},
      namedFillElement: {},
    };
    id (inst);

    inst.attachEl = function(el) {
      this.rootEl = this.defaultFillElement = el;
    }

    inst.broadcastListener = conNode && conNode.listen;

    inst.top = parentInstance ? parentInstance.top : inst;

    inst._propagateBroadcast = function(act, msg) {
      let needsRefresh = false;
      this.broadcastListener && this.broadcastListener(this,act, msg ) && (needsRefresh = true);
      // propagates here and each child with the given message
      Object.values( this._key2instance ).forEach( c => c._propagateBroadcast(act,msg) && (needsRefresh=true) );
      return needsRefresh;
    }

    inst.broadcast = function( key, message ) {
      this.top._propagateBroadcast(act,msg) && this.top.refresh();
    }


    inst.data = makeData( inst );

    if (conNode.recipe) {
      overlayFromTo( conNode.data, inst.data );
      overlayFromTo( conNode.recipe.data, inst.data );

      // copy over functions
      [ conNode.functions, conNode.recipe.functions ]
        .filter ( from => from !== undefined )
        .forEach( from => {
          Object.keys( from )
          .filter( funName => !inst.fun[funName] )
          .forEach( funName => {
            inst.fun[funName] = function() {
              const prom = from[funName]( inst, ...arguments );
              return Promise.resolve( prom )
                .then( () => {
                  if ( check(inst) ) refresh(inst);
                } );
            };
          } );
        } );
    }

    if (parentInstance) {
      inst.parent = parentInstance;
      parentInstance.childInstances[key] = inst;
    }
    return inst;
  } // createInstance function

  /** return data object that updates changed state of inst when data is chaged */
  function makeData(inst) {
      return new Proxy( {}, {
        get(target, name, receiver) {
          return Reflect.get(target, name, receiver);
        },
        set(target, name, value, receiver) {
          const original = Reflect.get(target, name, receiver);
          if (value !== original) {
            inst.changed = true;
            return Reflect.set(target, name, value, receiver);
          }
          return true;
        }
      } );
  } // makeData function

  /** create document element based on the node */
  function createElement( inst, conNode ) {
    const rootNode = conNode.isComponent ? conNode.recipe.contents[0] : conNode;
    const el = document.createElement( rootNode.tag );
    el.dataset.spid = conNode.id;

    // attach event listeners
    rootNode.on && Object.keys( rootNode.on )
      .forEach( evname => {
        const onfun = rootNode.on[evname];
        const evfun = function() {
          const prom = onfun( inst, ...arguments );
          return Promise.resolve( prom )
            .then( () => {
              if ( check(inst) ) refresh(inst);
            } );
        };
        el.addEventListener( evname, evfun );
      } );

    return el;
  } // createElement function

  /** return true if instance has changed since last check */
  function check( inst ) {
    const changed = inst.changed;
    inst.changed = false;
    return changed;
  }

  /** refresh recipe component bound to instance. */
  function refresh( inst ) {
    const el = inst.rootEl;
    _refresh_el( inst, el, inst.rootNode, inst.instNode );
  }

  function _refresh_el( inst, el, elNode, instNode ) {
    _refresh_el_attrs( inst, el, elNode, instNode );
    _refresh_el_children( inst, el, elNode.contents );
  }

  function _refresh_el_children( inst, el, contents ) {
    if (contents === undefined || contents.length === 0)
      return;

    // catalog  element children
    const key2el = {};
    Array.from( el.children )
      .forEach( child_E => {
        if (child_E.dataset.spid) { //matches the node its on
          if (child_E.dataset.spforidx !== undefined) { //its a for element
            key2el[`${child_E.dataset.spid}_${child_E.dataset.spforidx}`] = child_E;
          } else {
            key2el[child_E.dataset.spid] = child_E;
          }
        }
      } );

    // little function to remove extra forloop elements
    const forTrim = (startIdx,con_B,con_E) => {
      for (let i=startIdx; i<Number(con_E.dataset.splastlistlen); i++) {
        const key = `${con_E.dataset.spid}_${i}`
        const for_E = key2el[key];
        delete key2el[key];
        for_E && for_E.remove();
        // remove any child instance that went along with this forloop
        delete inst.childInstances[`${con_B.id}_${i}`];
      }
    };

    const showElementWithID = {};
    let lastWasConditional = false,
        conditionalDone = false,
        lastConditionalWasTrue = false;

    // hang on to for instances
    const forKey2List = {};
    const forKey2I = {};
    const forKey2E = {};

    // first loop make sure each builder has an element associated with it
    // that element may be hidden. instance builders also will have an instance
    // associated with them; looped instance builders will have an instance
    // for one loop wether or not there are zero or more than one in the loop
    //
    // this loop also figures out if/elseif/else branching and which builders
    // need to be shown or hidden.
    // for hidden branches - the element is hidden
    // for hidden looped branches - the first element in the loop is hidden
    //           and the rest are removed. the first instance is retained
    //           and the rest destroyed
    // for shown branches - element is unhidden
    // for shown looped branches - first element in loop is unhidden
    //           and loop instances and elements beyond the first are created
    //           and loop instances and elements that go beyond the current list
    //           are destroyed
    contents
      .forEach( con_B => {
        const key = con_B.key;

        let con_E = key2el[key];
        const compo_R = con_B.recipe;
        const instance_R = inst.recipe;
        let inst_B;

        let con_I = inst.childInstances[key];

        // create the element if need be
        if (!con_E) {
          if (con_B.isComponent) {
            con_I ||= createInstance(con_B, inst, key);

            // if this node has a handle, it means
            // that the component instance has a
            // handle attached to this instance
            if (con_B.handle) {
              inst.comp[con_B.handle] = con_I;
            }

            // now make the element
            con_E = createElement( con_I, con_B );

            con_I.defaultFillElement ||= con_E;

            if (con_B.forvar) {
              con_E.dataset.spforidx = '0';
            }

            con_I.attachEl( con_E );
          }
          else { // element not instance
            con_E = createElement( inst, con_B );

            // check if this is a named or default fill node
            // (no R for body inst)
            if (instance_R) {
              if ( con_B === instance_R.defaultFillNode) {
                inst.defaultFillElement = con_E;
              }
              if ( con_B === instance_R.namedFillNode[con_B.fill] ) {
                inst.namedFillElement[con_B.fill] = con_E;
              }
            }

            // if this node has a handle, it means
            // that the elementhas a
            // handle attached to this instance
            if (con_B.handle) {
              inst.el[con_B.handle] = con_E;
            }

          }
          key2el[key] = con_E;

          con_E.style.display = 'none';
          el.append( con_E );
        };

        // check conditionals if it should be displayed
        let showThis = false;
        if (con_B.if) {
          lastConditionalWasTrue = conditionalDone = con_B.if(inst);
          lastWasConditional = true;
          showThis = lastConditionalWasTrue;
          con_E.dataset.if = !!conditionalDone; //for debugging
        }
        else if (con_B.elseif) {
          if (!lastWasConditional) {
            inst.recipe.error( 'elseif must be preceeded by if or elseif' );
          }
          if (conditionalDone) {
            lastConditionalWasTrue = false;
            con_E.dataset.elseIf = 'n/a'; //for debugging
          } else {
            lastConditionalWasTrue = conditionalDone = con_B.elseif(inst);
            con_E.dataset.elseIf = !!conditionalDone; //for debugging
            showThis = lastConditionalWasTrue;
          }
        }
        else if (con_B.else) {
          if (! lastWasConditional ) {
            inst.recipe.error( 'else must be preceeded by if or elseif' );
          }
          if (conditionalDone) {
            lastConditionalWasTrue = false;
            con_E.dataset.else = false;
          } else {
            lastConditionalWasTrue = true;
            con_E.dataset.else = true;
            showThis = true;
          }
        }
        else { // no conditional
          showThis = true;
        }

        if (showThis) {
          showElementWithID[key] = true;

          con_E.style.display = null; // unhide

          // check if this is a loop. if so
          // create elements and maybe child instances for
          // each iteration of the loop
          if (con_B.foreach && con_B.forvar) {
            const forInstances = forKey2I[key] = [con_I];
            const for_Es = forKey2E[key] = [con_E];
            const list = forKey2List[key] = con_B.foreach(inst);

            if (list.length === 0) {
              con_E.style.display = 'none'; // hide the first
              forTrim( 1, con_B, con_E );   // remove all but the first
            }
            else {
              if (Number(con_E.dataset.splastlistlen) > list.length) {
                forTrim( list.length, con_B, con_E );
              }
              con_E.dataset.splastlistlen = list.length;

              for (let i=1; i<list.length; i++) {
                const forIDKey = `${con_B.id}_${i}`;
                let for_E = key2el[forIDKey];
                if (for_E) {
                  if (con_B.isComponent) {
                    const for_I = inst.childInstances[forIDKey];
                    forInstances.push( for_I );
                  }
                }
                else {
                  if (con_B.isComponent) {
                    const for_I = inst.childInstances[forIDKey]
                          ||= createInstance(con_B,inst,con_B.key);
                    forInstances.push( for_I );
                    for_E = createElement( for_I, con_B );
                    key2el[forIDKey] = for_E;
                    for_I.attachEl(for_E);
                  } else {
                    for_E = createElement( inst, con_B );
                  }
                  for_E.dataset.spforidx = i;
                  el.append( for_E );
                }
                for_Es.push( for_E );
              }
            }
          } else if (con_B.foreach || con_B.forvar) {
            inst.recipe.error( 'foreach and forvar must both be present' );
          }

        } else {
          con_E.style.display = 'none';
          // remove foreach beyond zero
          if (Number(con_E.dataset.splastlistlen) > 1) {
            forTrim( 1, con_B, con_E );
          }
        }

      } );

    // this element is complete except for child elements.
    // refresh the child elements and any fill content
    const instances = [];
    contents
      .filter( con_B => showElementWithID[con_B.key] )
      .forEach( con_B => {
        const key = con_B.key;
        const con_E = key2el[key];
        const instance_R = con_B.isComponent && con_B.recipe;

        const list = forKey2List[key];
        if (list) { // foreach items

          const for_Es = forKey2E[key];
          const forInstances = forKey2I[key];
          for (let i=0; i<list.length; i++ ) {
            if (instance_R) {
              const for_I = forInstances[i];
              for_I.it[ con_B.forvar ] = list[i];
              for_I.idx[ con_B.forvar ] = i;
              refresh( for_I );

              // put fill contents in
              if (con_B.contents && con_B.contents.length) {
                const fill_E = for_I.defaultFillElement;
                _refresh_el_children( inst, fill_E, con_B.contents );
              }

              if (con_B.fill_contents) {
                Object.keys( con_B.fill_contents)
                  .forEach( fillName => {
                    const fill_E = for_I.namedFillElement[fillName];
                    fill_E && _refresh_el_children( inst, fill_E, con_B.fill_contents[fillName] );
                  } );
              }

              // Check for named fill contents
              console.warn( "CHECK FOR NAMED FILL" );

            } else {
              inst.it[ con_B.forvar ] = list[i];
              inst.idx[ con_B.forvar ] = i;
              _refresh_el( inst, for_Es[i], con_B );
            }
          }
        }
        else { //single item

          if (con_B.isComponent) {
            const con_I = inst.childInstances[key];
            refresh( con_I );


            // check for fill and fill contents
            if (con_B.contents && con_B.contents.length) {
              const fill_E = con_I.defaultFillElement;
              _refresh_el_children( inst, fill_E, con_B.contents );
            }
            if (con_B.fill_contents) {
              Object.keys( con_B.fill_contents)
                .forEach( fillName => {
                  const fill_E = con_I.namedFillElement[fillName];
                  fill_E && _refresh_el_children( inst, fill_E, con_B.fill_contents[fillName] );
                } );
            }
          }
          else {
            _refresh_el( inst, con_E, con_B );
          }
        }
      } );
  } // _refresh_el_children function

  function _refresh_el_attrs( inst, el, elNode, instNode ) {
    instNode ||= elNode;
    const attrs = elNode.attrs;

console.warn( 'need to make sure instNode has all the attrs from elNode overlayered in' );

    attrs && Object.keys(attrs)
      .forEach( attr => {
        const val = dataVal( inst, attrs[attr] );

        if (attr.match( /^(textContent|innerHTML)$/)) {
          el[attr] = val;
        } else if (attr === 'class' ) {
          el.className = '';
          val.trim().split( /\s+/ ).forEach( cls => el.classList.add( cls ) );
        } else if (attr === 'style') {
          Object.keys( val )
            .forEach( style => el.style[ style ] = val[style] );
        } else if (attr === 'disabled' || attr === 'checked' || attr === 'selected') {
          val ? el.setAttribute( attr, attr ) : el.removeAttribute( attr );
        } else {
          el.setAttribute( attr, val );
        }
      } );
    } // _refresh_el_attrs function


  /**
      prepare the data structrues, then make an
      instance for the page and refresh the page.
   */
  function init( fileSpaces, defaultFilename, attachPoint ) {

    sp_filespaces = fileSpaces;

    const pageNS = loadNamespace( defaultFilename );

    prepNamespaces();

    // special case, treat body element as a recipe root
    const bodyC = pageNS.contents[0];
    bodyC.recipe = pageNS.contents[0];
    bodyC.namedFillNode = {};

    useTest = pageNS.test;

    console.warn( 'can there be anything in the javascript in the head that would impact creating an instace here?' );
    pageNS.defaultFillNode = pageNS.contents[0];
    const bodyInst = createInstance( pageNS.contents[0] );
 
    bodyInst.attachEl( attachPoint || document.body );
    bodyInst.defaultFillElement = pageNS.contents[0];
    bodyInst.namespace = pageNS;

    Promise.resolve(pageNS.installHead())
      .then( () => {
        refresh( bodyInst );
        if (useTest) {
          pageNS.test();
        }
      } );
  } // init

  SP.init = init;

  /** serialize the node and determine if it is
      a component or element node
   */
  const prepNode = (node,namespace,recipe) => {
    if (node.isPrepped) return node;

    node.isPrepped = true;

    id( node );

    const compoRecipe = namespace.recipeForTag( node.tag );
    if (compoRecipe) {
      node.recipe = compoRecipe;
      node.namespace = compoRecipe.namespace;
      node.isComponent = true;
      node.name = `[C ${node.tag}#${node.id}]`;
      // the  fill_contents for a compoRecipe
      // belong to the recipe that the compoRecipe is embedded in
      // so the recipe and namespace here are fine
      node.fill_contents && Object.values( node.fill_contents )
        .forEach( cons => cons.forEach( con => prepNode(con,namespace,recipe)));

      let root_N = node.recipe.contents[0];
      if (root_N.isComponent) {
        const root_R = root_N.recipe;

        // this line sometimes fails due to out of orderness
        root_N = prepNode(root_N, root_R.namespace,root_R);
      } else {
        root_N = prepNode(root_N, node.recipe.namespace, node.recipe);
      }
      node.key = node.forvar ? `${node.id}_0` : node.id;

    } else { // is Element
      node.name = `[E ${node.tag}#${node.id}]`;
      node.recipe = recipe;
      node.namespace = namespace;
      node.isElement = true;
      if (node.fill === true) {
        node.contents ||= [];
        recipe.defaultFillNode = node;
      } else if (node.fill) {
        recipe.namedFillNode[node.fill] = node;
      }
      node.key = node.forvar ? `${node.id}_0` : node.id;
    }

    // the contents for a compoRecipe belong to the recipe
    //  that the compoRecipe is embedded in
    // so the recipe and namespace here are fine
    node.contents && node.contents
        .forEach( con => prepNode(con,namespace,recipe));

    return node;

  }; // prepNode function


  /**   */
  function loadNamespace( filename ) {
    let NS = FN_2_NS[filename];
    if (NS) return NS;

    NS = sp_filespaces[filename];
    if (!NS) {
      throw new Error(`unable to load namespace '${filename}'`);
    }

    FN_2_NS[filename] = NS;

    NS.filename = filename;
    NS.name = `[N ${filename}]`;

    // method reports and throws error
    NS.error = function(msg) {
      console.error( msg );
      throw new Error( `${msg} in file ${this.name}` );
    }

    // method returns a matching recipe (if any) for the tag
    NS.recipeForTag = function(tag) {
      const parts = tag.split(/[.]/);
      let recipe;
      if (parts.length === 1) {
        return this.recipes[parts[0]];
        // not an error if it was not found. means it is
        // probably an html tag rather than recipe name
      }
      else if (parts.length === 2) {
        const aliasedNS = this.alias_namespaces[parts[0]];
        recipe = aliasedNS && aliasedNS.recipeForTag( parts[1] );
        if (recipe) return recipe;
        error( `recipe '${tag}' not found` );
      } else {
        error( `recipe '${tag}' not found` );
      }
    }; // recipeForTag method

    // stores aliases of an other namespace in this one
    const alias_2_FN = NS.alias_namespace || {};
    const aliases = Object.keys( alias_2_FN );
    aliases.forEach( alias =>
      (alias_2_FN[alias] = loadNamespace(alias_2_FN[alias]))
    );

    // load refereced namespaces for import
    (NS.import_into_namespace || [])
      .forEach( file => loadNamespace( file) );

    // serialize this namespace
    id (NS);

    NS.contents = [];

    // method that looks at the head and
    NS.installHead = function() {
      const headNode = this.html.head;
      if (! headNode) return;

      headNode.title && (document.title = headNode.title);

      const headEl = document.head;

      // explicit style
      let style = headNode.style
      if (style) {
        const stylel = document.createElement( 'style' );
        stylel.setAttribute( 'type', 'text/css' );
        if (stylel.styleSheet) { // IE
          stylel.styleSheet.cssText = style;
        } else {
          stylel.appendChild(document.createTextNode(style));
        }
        headEl.appendChild( stylel );
      }

      // explicit javascript
      let script = headNode.script
      if (script) {
        const scriptel = document.createElement( 'script' );
        scriptel.setAttribute( 'type', 'text/javascript' );
        scriptel.appendChild(document.createTextNode(script));
        headEl.appendChild( scriptel );
      }

      return new Promise( (res,rej) => {
        let files = 0;
        let ready = false;

        const promCheck = () => {
          if (ready && files === 0) {
            res();
          }
        }

        const loadList = file => {
          files++;
          file.onload = function() {
            files--;
            promCheck();
          }
        };

        // css files
        const css = headNode.css;
        const cssFiles = Array.isArray( css ) ? css : css ? [css] : [];
        cssFiles.forEach( file => {
          const link = document.createElement( 'link' );
          link.setAttribute( 'rel', 'stylesheet' );
          link.setAttribute( 'media', 'screen' );
          headEl.appendChild( link );
          link.setAttribute( 'href', file );
        } );

        // js files
        const js = headNode.javascript;
        const jsFiles = Array.isArray( js ) ? js : js ? [js] : [];
        jsFiles.forEach( file => {
          const scr = document.createElement( 'script' );
          headEl.appendChild( scr );
          loadList( scr );
          scr.setAttribute( 'src', file );
        } );

        // js modules files
        const mods = headNode['javascript-module'];
        const modFiles = Array.isArray( mods ) ? mods : mods ? [mods] : [];
        modFiles.forEach( file => {
          const scr = document.createElement( 'script' );
          scr.setAttribute( 'type', 'module' );
          headEl.appendChild( scr );
          loadList( scr );
          scr.setAttribute( 'src', file );
        } );

        ready = true;
        promCheck();
      } );
    }; // installHead method

    // if there is html/body here, make a root node
    if (NS.html) {

      const body = NS.html.body || {};

      const rootNode = {
          tag:'body',
          contents: body.contents || [],
      };

      NS.contents.push( rootNode );

      [ 'listen', 'postLoad', 'preLoad', 'when' ]
        .forEach( fld => ( rootNode[fld] = body[fld] ) );

    } // if the namespace has html

    return NS;
  } // loadNamespace

  SP.loadNamespace = loadNamespace;

  /**   */
  function prepNamespaces() {

    const NSs = Object.values( FN_2_NS );

    // traverse the recipes to make sure there is no cyclic use of them
    const rid2rids = {};
    function traverse( rec, root ) {
      root = root || rec.contents[0];
      const refd_rec = rec.namespace.recipeForTag( root.tag );
      if (refd_rec) {
        rid2rids[rec.id] ||= {};
        rid2rids[rec.id][refd_rec.id] = 1;
        if (rid2rids[refd_rec.id] && rid2rids[rec.id]) {
          throw new Error(`circular reference detected between recipes '${rec.name}' and '${refd_rec.name}'` );
        }
      }
    }


    // first prep all the recipes
    // and build a list of all recipes
    let recipes = [];
    NSs.forEach( NS => {
      Object.keys( NS.recipes || {} )
        .forEach( recipeName => {
          const recipe = NS.recipes[recipeName];
          id (recipe);
          recipe.name = `[R ${recipeName}#${recipe.id}]`;
          recipe.namespace = NS;
          recipe.namedFillNode = {};
          recipe.attrs ||= {};
          recipe.isRecipe = true;
          recipes.push( recipe );
          traverse( recipe );
        } );
    } );

    recipes.forEach( rec => prepNode( rec.contents[0], rec.namespace, rec ) );

    // check if recipe overlays an other
    recipes.forEach( rec => {
      const rootNode = rec.contents[0];
      const overlaidRecipe = rec.namespace.recipeForTag(rootNode.tag);
      if (overlaidRecipe) {
        rec.overlaysRecipe = overlaidRecipe;
      }
    } );

    //
    const id2done = {};
    while (Object.keys(id2done).length < recipes.length) {
      recipes
        .filter( rec => ! id2done[rec.id] )
        .forEach( rec =>
          {
            // see if this recipe is overlaying an other
            // if so, and what it is overlaying is done, do
            // the overlay
            const overlay = rec.overlaysRecipe;
            if (overlay) {
              const rootNode = rec.contents[0];
              const overlayRootNode = overlay.contents[0];
              if (id2done[overlay.id]) { // make sure this one is done and ready
                overlayFromTo( overlay.functions, rec.functions );
                overlayFromTo( overlay.data, rec.data );
                overlayFromTo( overlay.when, rec.when );

                // style is a special attr that is a data structure
                const oldStyle = rec.attrs.style;

                overlayFromTo( overlay.attrs, rec.attrs );

                // the overlay just overlayed one layer depth so
                // would clobber style which has depth of two..so
                // restore
                if (oldStyle) {
                  rec.attrs.style = oldStyle;
                  overlayFromTo( overlay.attrs.style, oldStyle );
                }

                // build a replacement for contents

                // clear this; copyNode may find an other and if it does not, then new content root should be used
                const oldFillNode = rec.defaultFillNode;
                const oldNamedFillNode = rec.namedFillNode;
                rec.defaultFillNode = undefined;
                rec.namedFillNode = {};

                const overlayRootNodeCopy = copyNode(overlay.contents[0], rec);
                const tempFillNode = rec.defaultFillNode ||= overlayRootNodeCopy;

                tempFillNode.contents.push( ...rootNode.contents );
                rec.defaultFillNode = oldFillNode ? oldFillNode : tempFillNode;

                rec.contents = [overlayRootNodeCopy];

                if (rootNode.fill_contents) {
                  Object.keys( rootNode.fill_contents )
                    .forEach( fillName => {
                      const fillNode = rec.namedFillNode[fillName];
                      fillNode && fillNode.contents.push( ...rootNode.fill_contents[fillName] );
                    } );
                }

                // now update the root node of the contents with the attributes
                overlayFromTo( rootNode.attrs, rec.attrs );
                rec.contents[0].attrs = rec.attrs;

                id2done[ rec.id ] = rec;
              }
            } else {
              // attributes on the recipe take precendence
              // but then are attached to the root node
              overlayFromTo( rec.contents[0].attrs, rec.attrs );
              // the attributes are ultimately used from the root content node
              rec.contents[0].attrs = rec.attrs;

              id2done[ rec.id ] = rec;
            }

            // recipe has a root Node that is an element.
            // make sure it has a default fill node which
            // by default is the root node
            rec.defaultFillNode ||= rec.contents[0];

          } );
    } //recipes completed/linked together

    // imports the recipes from the namespace into this namespace
    NSs.forEach( NS => {
      const import_into_FN = NS.import_into_namespace || [];
      import_into_FN
        .forEach( file => {
          const importNS = loadNamespace(file);
          const recs = importNS.recipes || {};
          Object.keys( recs )
            .forEach( rname => (NS.recipes[rname] ||= recs[rname]));
        } );
    } );

    // now prep namespace (body) contents
    NSs.forEach( NS => {
      NS.name = `[N ${NS.filename}#${NS.id}]`;
      NS.contents && NS.contents.length && prepNode( NS.contents[0], NS );
    } );

  } //prepNamespaces

}
