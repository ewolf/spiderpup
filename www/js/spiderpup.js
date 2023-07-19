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

 Init builds an object version of the data strcture using
 the following object classes: Namespace, Recipe, BodyRecipe,
 Builder and Instance.

   * parses and adds to the data structure
   * attaches styles, css links and script tags to the head
   * instantiates a body instance object
   * calls refresh on the body instance object

 NAMESPACE DATA STRUCTURE --------------------------

   a namespace has the following fields:
     recipes    -> { name       -> recipe }
     namespaces -> { alias      -> namespace }
     functions  -> { name       -> function }
     data       -> { field      -> value or function }
     html       -> {
         head -> {
           script -> javascript text
           title  -> string
           style  -> css text
           css -> single or list of filenames
           javascript -> single or list of filenames
         }
         body -> {
           onLoad   -> function
           preLoad   -> function
           on       -> { eventname -> function }
           contents -> [ element|component instance node...]
           listen   -> function
         }
        }

 COMPONENT (RECIPE) DATA STRUCTURE -----------------------

  a component (recipe) node has the following fields:
    functions  -> { name -> function }
    data       -> { field -> value }
    onLoad     -> function
    on         -> { event -> function }
    listen     -> function
    contents   -> [content node] (may only have one content node)

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

   if this is the first time the instance was refreshed, onLoad is called
   as the last part of the rfresh

 */

// -------- LAUNCH ------

const SP = window.SP ||= {};
{
  window.onload = ev => {
    //console.log( filespaces );
    init( filespaces, defaultFilename );
  }

  // --------  CODE  ------

  const FN_2_NS = {};
  let lastid = 1;
  let bodyInst;
  let useTest = false;

  function nextid() {
    return lastid++;
  }

  function init( fileSpaces, defaultFilename, attachPoint ) {
    const pageNS = loadNamespace( defaultFilename );
    useTest = pageNS.test;

    const bodyR = new BodyRecipe();

    bodyR.setup( pageNS );

    Promise.resolve(bodyR.installHead())
      .then( () => {
        activateNamespaces();

        bodyInst = bodyR.createInstance(bodyR.rootBuilder);
        bodyInst.attachTo(attachPoint || document.body);
        bodyInst.refresh();

        if (useTest) {
          pageNS.test();
        }
      } );
  }

  SP.init = init;

  // calls the onLoad handlers for
  // all the loaded namespaces
  function activateNamespaces() {
    Object.values( FN_2_NS ).forEach( NS => NS.onLoad && NS.onLoad() );
  }

  function loadNamespace( filename ) {
    let NS = FN_2_NS[filename];
    if (NS) return NS;

    const NS_node = filespaces[filename];
    if (!NS_node) {
      throw new Error(`unable to load namespace '${filename}'`);
    }

    NS = FN_2_NS[filename] = new Namespace();

    const alias_2_FN = NS_node.import_namespaces || {};
    const aliases = Object.keys( alias_2_FN );
    aliases.forEach( alias =>
      NS.aliasNamspace( alias, loadNamespace(alias_2_FN[alias]))
    );

    NS.setup( NS_node, filename );
    if (NS_node.test) {
      NS.test = NS_node.test;
    }

    return NS;
  }

  class Node {
    constructor() {
      this.id = nextid();
    }
  }

  class Namespace extends Node {
    // is gonna have
    //    recipes
    //    data
    //    functions
    constructor() {
      super();
      this.aliasedNS = {};
      this.recipes = {};
    }
    namespace( alias ) {
      return this.aliasedNS[alias];
    }
    aliasNamespace( alias, NS ) {
      this.aliasedNS[alias] = NS;
    }
    error( msg ) {
      console.error( msg );
      throw new Error( `${msg} in file '${this.name}'` );
    }
    // class Namespace
    findRecipe( tag ) {
      const parts = tag.split(/[.]/);
      let recipe;
      if (parts.length === 1) {
        const recipeName = parts[0];
        recipe = this.recipes[recipeName];
        if (recipe) return recipe;
        const recipeData = this.recipeData[recipeName];
        if (recipeData) {
          recipe = this.recipes[recipeName];
          if (!recipe) {
            recipe = this.recipes[recipeName] = new Recipe();
            recipe.setup( this, recipeData, recipeName );
          }
          return recipe;
        }
      }
      else if (parts.length === 2) {
        const NS = this.aliasedNS[parts[0]];
        recipe = NS && NS.findRecipe( parts[1] );
        if (recipe) return recipe;
        this.error( `recipe '${tag}' not found` );
      } else {
        this.error( `recipe '${tag}' not found` );
      }
    }
    // class Namespace
    setup( node, filename ) {
      this.name = `namespace ${filename}`;
      this.recipeData = node.recipes || {};
      this.data = node.data || {};
      this.functions = node.functions || {};
      this.about = node.about;
      node.listen && (this.listen = node.listen);
      node.html && (this.html = node.html);
      node.onLoad && (this.onLoad = node.onLoad);
    }

  } //class NameSpace

  class Recipe extends Node {

    setup( NS, recipeData, recipeName ) {
      this.name = recipeName;
      this.namespace = NS;
      const recipe = this;

      [ recipeData, NS ]
        .forEach( src => {
          [ 'class', 'onLoad', 'preLoad' ]
            .forEach( k => (src[k] && (this[k] = src[k] )) );
          [ 'data', 'functions', 'on', 'attrs' ]
            .forEach( type => {
              const thisData = recipe[type] ||= {};
              const inData = src[type];
              if (inData) {
                Object.keys( inData )
                  .forEach( fld => {
                    if ( ! (fld in thisData) ) {
                      thisData[fld] = inData[fld];
                    }
                  } );
              }
            } );
        } );

      //console.log( this.functions, recipe.functions, recipeData.functions, "BURPH" );
      console.warn( "class should be additive here" );
      this.namedFillBuilders = {};
      this.contents = recipeData.contents;
      this.prepRootBuilder();
    }

    namespace( alias ) {
      return this.namespace.namespace( alias );
    }

    // class Recipe
    error( msg ) {
      this.namespace.error( `${msg} in recipe '${this.name}'` );
    }

    // this is here for the case of a root component node
    // being an alias for an other component
    // class Recipe
    prepRootBuilder() {
      const NS = this.namespace;

      console.warn (" be more clear with these names ");
      const recipeRoot = this.contents[0];
      const rootIsAlsoRecipe = NS.findRecipe( recipeRoot.tag );

      let rootBuilder;

      if (rootIsAlsoRecipe) {
        rootBuilder = rootIsAlsoRecipe.prepRootBuilder();
        rootBuilder.layer( recipeRoot, this );
      } else {
        rootBuilder = new Builder();
        rootBuilder.setup( recipeRoot, this );
      }

      rootBuilder.recipe = this;

      this.rootBuilder = rootBuilder;

      rootBuilder.fillOut();

      // if no child builder was specifically called 'fill'
      // give the root builder that honor
      this.fillBuilder ||= rootBuilder;

      return rootBuilder;
    }

    // class Recipe
    createInstance(builder, parentInstance) {
      const inst = new Instance();
      inst.setup( this, builder );
      inst.parent = parentInstance;
      if (parentInstance) {
        inst.top = parentInstance.top;
        // pull data from parentInstance but do not override
        Object.keys( parentInstance._data )
          .forEach( fld => {
            if (! (fld in inst._data)) {
              inst._data[fld] = parentInstance._data[fld];
            }
          } );
      } else {
        inst.top = inst;
      }
      if (builder.handle) {
        parentInstance.comp[builder.handle] = inst;
      }
      return inst;
    }

  } //class Recipe


  class BodyRecipe extends Recipe {
    setup(pageNS) {

      const html = pageNS.html || {};
      const body = html.body || {};

      const rootNode = {
        contents: [ {
          tag:'body',
          contents: body.contents || [],
        } ]
      };

      ['preLoad', 'onLoad', 'on', 'data', 'listen', 'functions']
        .forEach( fld => body[fld] && (rootNode[fld] = body[fld]) );

      super.setup(pageNS, rootNode, 'body');

      this.head = html.head || {};
    }

    // class BodyRecipe
    installHead() {
      this.head.title && (document.title = this.head.title);

      const head = document.head;

      // explicit style
      let style = this.head.style
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
      let script = this.head.script
      if (script) {
        const scriptel = document.createElement( 'script' );
        scriptel.setAttribute( 'type', 'text/javascript' );
        scriptel.appendChild(document.createTextNode(script));
        head.appendChild( scriptel );
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
        const css = this.head.css;
        const cssFiles = Array.isArray( css ) ? css : css ? [css] : [];
        cssFiles.forEach( file => {
          const link = document.createElement( 'link' );
          link.setAttribute( 'rel', 'stylesheet' );
          link.setAttribute( 'media', 'screen' );
          head.appendChild( link );
          link.setAttribute( 'href', file );
        } );
        
        // js files
        const js = this.head.javascript;
        const jsFiles = Array.isArray( js ) ? js : js ? [js] : [];
        jsFiles.forEach( file => {
          const scr = document.createElement( 'script' );
          head.appendChild( scr );
          loadList( scr );
          scr.setAttribute( 'src', file );
        } );
        
        // js modules files
        const mods = this.head['javascript-module'];
        const modFiles = Array.isArray( mods ) ? mods : mods ? [mods] : [];
        modFiles.forEach( file => {
          const scr = document.createElement( 'script' );
          scr.setAttribute( 'type', 'module' );
          head.appendChild( scr );
          loadList( scr );
          scr.setAttribute( 'src', file );
        } );
        
        ready = true;
        promCheck();
      } );
    }
  }  //class BodyRecipe

  class Builder extends Node {

    get key() {
      return this.forvar ? `${this.id}_0` : this.id;
    }

    // class Builder
    setup( layerAbove, withinRecipe, instanceRecipe ) {
      this.attrs = {};
      this.tag = layerAbove.tag;
      this.name = `${this.tag} in ${withinRecipe.name}`;
      if (instanceRecipe) {
        //console.log( `SETTING UP BUILDER using recipe '${instanceRecipe.name}' inside '${withinRecipe.name}' ${this.id} : ${this.tag}` );
      } else {
        //console.log( `SETTING UP BUILDER inside '${withinRecipe.name}' ${this.id} : ${this.tag}` );
      }
      this.instanceRecipe = instanceRecipe;
      this.layer( layerAbove, withinRecipe );
      this.contentBuilders = [];
      if (this.fill) {
        if (this.fill === true) {
          this.recipe.fillBuilder = this;
          //        this.isDefaultFillBuilder = true;
        } else {
          this.recipe.namedFillBuilders[this.fill] = this;
          //        this.fillBuilderName = this.fill;
        }
      }
    } //setup

    // class Builder
    layer( layerAbove, recipe ) {
      this.layerAbove = layerAbove;
      this.recipe = recipe;
      //  data only makes sence for instance builders, not element builders
      [ recipe, layerAbove ]
      .forEach ( source => {
        [ 'attrs', 'data', 'on', 'functions' ]
          .forEach ( htype => {
            if (htype in source) {
              const above = source[htype];
              const current = this[htype] ||= {};
              Object.keys (above)
                .forEach( fld => {
                  current[fld] = above[fld];
                } );
            }
          });
      } );
      [ 'listen', 'fill', 'if', 'elseif', 'else', 'foreach', 'forvar', 'handle' ]
        .forEach( fun =>
          layerAbove[fun] && (this[fun] = layerAbove[fun]) );

      this.contents ||= [];
      this.contents.push( ...(layerAbove.contents||[]) );
    } //layer

    // class Builder
    fillOut() {
      // this may be called multiple times for the same builder
      // during construction if a root node for a recipe refers
      // to an other recipe
      const R = this.recipe;
      const NS = R.namespace;

      this.contents
        .forEach( con => {
          const child_B = new Builder();
          const conRecipe = NS.findRecipe( con.tag );

          if (conRecipe) {
            // component node

            child_B.setup( con, R, conRecipe );

            const toFill = child_B.fillContents = {}; // name -> [ ... BuilderList ]
            if (con.fill_contents) {
              Object.keys(con.fill_contents)
                .forEach( fillName => {
                  const toFillBuilders = toFill[fillName] =
                        con.fill_contents[fillName]
                        .map( fill_con => {
                          const fill_B = new Builder();
                          const fill_R = NS.findRecipe( fill_con.tag );
                          fill_B.setup( fill_con, R, fill_R );
                          toFillBuilders.push(fill_B);
                          fill_B.fillOut();
                          return fill_B;
                        } );
                } );
            }

            if (con.contents && con.contents.length) {
              const toFillBuilders = child_B.defaultFillContents =
                    con.contents.map( fill_con => {
                      const fill_B = new Builder();
                      const fill_R = NS.findRecipe( fill_con.tag );
                      fill_B.setup( fill_con, R, fill_R );
                      fill_B.fillOut();
                      return fill_B;
                    } );
            }

            // do not fill out the child_B for the component node any more
            //  - the fill_contents filling out was what was needed

          } else {
            // element node
            child_B.setup( con, R );
            child_B.fillOut();
          }

          this.contentBuilders.push( child_B );
        } );
    } //fillOut

    // class Builder
    buildElement( inst, builderNode ) {
      const el = document.createElement( this.tag );
      el.dataset.spid = (builderNode||this).id;

      if (this.handle) {
        inst.el[this.handle] = el;
      }

      // attach event listeners
      this.on && Object.keys( this.on )
        .forEach( evname => {
          const onfun = this.on[evname];
          const evfun = function() {
            const prom = onfun( inst, ...arguments );
            return Promise.resolve( prom )
              .then( () => {
                if ( inst.check() ) inst.refresh();
              } );
          };
          el.addEventListener( evname, evfun );
        } );

      return el;
    }

  } // class Builder

  class Instance extends Node {

    setup( recipe, builder ) {
      this.recipe = recipe;
      this.builder = builder;
      this.name = `<inst#${this.id} of ${recipe.name}>`;
      this.childInstances = {}; // id -> instance
      this.builder_id2el = {};
      this.it            = {};
      this.idx           = {};
      this.el            = {}; // handle -> element
      this.comp          = {}; // handle -> component
      this.fun           = {}; // name   -> function
      this.layer( recipe, builder );
    }

    // class Instance
    check() {
      const changed = this.changed;
      this.changed = false;
      return changed;
    }

    // class Instance
    makeData() {
      const inst = this;
      return new Proxy( {}, {
        get(target, name, receiver) {
          if (! Reflect.has(target, name) ) {
            if ( (! inst.loaded) && name in inst._data) {
              // this field has not been loaded before, so load it now
              const val = inst.dataVal( inst._data[name] );
              this.set(target,name,val, receiver);
              return val;
            }
            return undefined;
          }
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

    }

    // class Instance
    layer( recipe, builder ) {
      // we want za data
      const inst = this;
      const _data = this._data = {};
      const data = this.data = this.makeData();
      const fun = this.fun;
      const onLoads = this.onLoads = [];
      const preLoads = this.preLoads = [];
      this.attrs = builder.attrs;
      [ builder, recipe ]
        .forEach ( from => {
          from.data && Object.keys( from.data )
            .forEach( fld => {
              if ( ! (fld in _data) ) {
                const valOrFun = from.data[fld];
                //console.log( `layering '${fld}' in inst.name from from.name` );
                _data[fld] = typeof valOrFun === 'function' ?
                  function() { //console.log(`calling function for ${fld} in ${inst.name}`);
                               return valOrFun( inst, ...arguments ); }
                : valOrFun;
              }
            } );
        } );

      [ recipe, builder ]
        .forEach ( from => {
          from.onLoad && onLoads.push( from.onLoad.bind(this) );
          from.preLoad && preLoads.push( from.preLoad.bind(this) );
          from.functions && Object.keys( from.functions )
            .forEach( funname => {
              if (!fun[funname]) {
                const fromfun = from.functions[funname];
                fun[funname] = function() {
                  return Promise.resolve( fromfun( inst, ...arguments ) );
                }
              }
            } );

        } );
    } //layer

    // class Instance
    getFillEl(name) {
      const R = this.recipe;
      if (name) return this.build_id2el[R.namedFillBuilders[name].id];
      return this.builder_id2el[R.fillBuilder.key];
    }

    // class Instance
    get instanceBuilder() {
      let B = this._instanceBuilder;
      if (!B) {
        //console.log( `INSTANCE BUILDER FOR ${this.recipe.name}` );
        B = this._instanceBuilder = new Builder();
        B.setup( this.recipe.rootBuilder, this.recipe, this.builder.recipe );
        B.instance = this;
        B.contentBuilders = this.recipe.rootBuilder.contentBuilders;

        // layer attributes
        Object.keys( this.attrs || {} )
          .forEach( attr => {
            B.attrs[attr] = this.attrs[attr];
          } );
      }
      return B;
    }


    // class Instance
    attachTo(el) {
      this.root_EL = el;
    }

    dataVal( v ) {
      return typeof v === 'function' ? v(this) : v;
    }

    namespace( alias ) {
      return this.recipe.namespace( alias );
    }

    // class Instance
    refresh() {
      //console.log( `REFRESHING builder ${this.builder.tag}/${this.builder.id}, recipe ${this.builder.recipe.name}` );

      if (! this.loaded) {
        // initial data settings
        Object.keys( this._data )
          .forEach( fld => {
            const val = this.dataVal( this._data[fld] );
            this.data[fld] = val;
          } );
        this.preLoads.forEach( pl => pl(this) );
      }

      this._refresh_root_el( this.root_EL, this.recipe.rootBuilder );

      if (! this.loaded) {
        this.onLoads.forEach( ol => ol(this) );
        this.loaded = true;
      }
    } //refresh

    // class Instance
    _refresh_root_el( el, rootBuilder ) {

      // calculate data from _data
      Object.keys( this._data )
        .forEach( fld => {
          // if the data is the result of a function
          // recalculate it on refresh
          if ( typeof this._data[fld] === 'function' ) {
            const val = this.dataVal( this._data[fld] );
            this.data[fld] = val;
          }
        } );
      
      this._refresh_el( el, rootBuilder );

      this._refresh_el_attrs( el, this.instanceBuilder );
      //console.log( this.instanceBuilder.attrs, rootBuilder.attrs, `${this.instanceBuilder.name} ${this.instanceBuilder.id} / ${rootBuilder.name} ${rootBuilder.id}` );

    } //_refresh_root_el

    _refresh_el_attrs( el, builder ) {
      // fill in elements attributes ---------------------------
      const attrs = builder.attrs;

      attrs && Object.keys(attrs)
        .forEach( attr => {

          const val = this.dataVal( attrs[attr] );

          if (attr.match( /^(textContent|innerHTML)$/)) {
            el[attr] = val;
            //console.log( el, `UPDATED textContent to ${val}` );
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
    }

    // class Instance
    _refresh_el( el, builder ) {
      this._refresh_el_attrs( el, builder );
      this._refresh_el_children( el, builder.contentBuilders );
    } //_refresh_el

    //class Instance
    _refresh_el_children( el, builders ) {

      if (builders.length === 0) return;
      
      // catalog child elements ---------------------------
      const builderID2el = {};
      Array.from( el.children )
        .forEach( child_E => {
          if (child_E.dataset.spid) {
            if (child_E.dataset.spforidx !== undefined) {
              builderID2el[`${child_E.dataset.spid}_${child_E.dataset.spforidx}`] = child_E;
            } else {
              builderID2el[child_E.dataset.spid] = child_E;
            }
          }
        } );

      // little function to remove extra forloop elements
      const forTrim = (startIdx,con_B,con_E) => {
        for (let i=startIdx; i<Number(con_E.dataset.splastlistlen); i++) {
          const key = `${con_E.dataset.spid}_${i}`
          const for_E = builderID2el[key];
          delete builderID2el[key];
          for_E && for_E.remove();
          // remove any child instance that went along with this forloop
          delete this.childInstances[`${con_B.id}_${i}`];
        }
      };


      const showElementWithID = {};
      let lastWasConditional = false,
          conditionalDone = false,
          lastConditionalWasTrue = false;

      // hang on to for instances
      const forBuilderID2List = {};
      const forBuilderID2Instances = {};
      const forBuilderID2E = {};

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
      builders
        .forEach( con_B => {
          const key = con_B.key;

          let con_E = builderID2el[key];
          const instance_R = con_B.instanceRecipe;
          let inst_B;

          let con_I = this.childInstances[key];

          // create the element if need be
          if (!con_E) {
            if (instance_R) {
              con_I ||= this.childInstances[key]
                ||= instance_R.createInstance(con_B,this);
              inst_B = con_I.instanceBuilder;

              con_E = inst_B.buildElement(con_I, con_B);
              if (con_B.forvar) {
                con_E.dataset.spforidx = '0';
              }
              con_I.attachTo( con_E );
              con_I.builder_id2el[instance_R.rootBuilder.key] = con_E;
            }
            else { // element not instance
              con_E = con_B.buildElement(this);
            }
            builderID2el[key] = this.builder_id2el[key] = con_E;

            con_E.style.display = 'none';
            el.append( con_E );
          }
          inst_B ||= con_I && con_I.instanceBuilder;

          // check conditionals if it should be displayed
          let showThis = false;
          if (con_B.if) {
            lastConditionalWasTrue = conditionalDone = con_B.if(this);
            lastWasConditional = true;
            showThis = lastConditionalWasTrue;
            con_E.dataset.ifCondition = conditionalDone; //for debugging
          }
          else if (con_B.elseif) {
            if (!lastWasConditional) {
              this.recipe.error( 'elseif must be preceeded by if or elseif' );
            }
            if (conditionalDone) {
              lastConditionalWasTrue = false;
              con_E.dataset.elseIfCondition = 'n/a'; //for debugging
            } else {
              lastConditionalWasTrue = conditionalDone = con_B.elseif(this);
              con_E.dataset.elseIfCondition = conditionalDone; //for debugging
              showThis = lastConditionalWasTrue;
            }
          }
          else if (con_B.else) {
            if (! lastWasConditional ) {
              this.recipe.error( 'else must be preceeded by if or elseif' );
            }
            if (conditionalDone) {
              lastConditionalWasTrue = false;
              con_E.dataset.else = false;
            } else {
              lastConditionalWasTrue = true;
              con_E.dataset.else = true;
              showThis = lastConditionalWasTrue;
            }
          }
          else { // no conditional
            showThis = true;
          }

          if (showThis) {
            showElementWithID[key] = true;
            con_E.style.display = null;

            // check if this is a loop. if so
            // create elements and maybe child instances for
            // each iteration of the loop
            if (con_B.foreach && con_B.forvar) {
              const forInstances = forBuilderID2Instances[key] = [con_I];
              const for_Es = forBuilderID2E[key] = [con_E];
              const list = forBuilderID2List[key] = con_B.foreach(this);

              if (list.length === 0) {
                con_E.style.display = 'none';
                forTrim( 1, con_B, con_E ); //remove all but the first
              }
              else {
                if (Number(con_E.dataset.splastlistlen) > list.length) {
                  forTrim( list.length, con_B, con_E );
                }
                con_E.dataset.splastlistlen = list.length;

                for (let i=1; i<list.length; i++) {
                  const forIDKey = `${con_B.id}_${i}`;
                  let for_E = builderID2el[forIDKey];
                  if (for_E) {
                    if (instance_R) {
                      const for_I = this.childInstances[forIDKey];
                      forInstances.push( for_I );
                    }
                  } 
                  else {
                    if (instance_R) {
                      const for_I = this.childInstances[forIDKey]
                            ||= instance_R.createInstance(con_B,this);
                      forInstances.push( for_I );
                      for_E = inst_B.buildElement(for_I,con_B);
                      builderID2el[forIDKey] = this.builder_id2el[forIDKey] = for_E;
                      builderID2el[instance_R.rootBuilder.key] = this.builder_id2el[instance_R.rootBuilder.key] = for_E;
                      for_I.attachTo( for_E );
                      for_I.builder_id2el[instance_R.rootBuilder.key] = for_E;
                    } else {
                      for_E = con_B.buildElement(this);
                    }
                    for_E.dataset.spforidx = i;
                    el.append( for_E );
                  }
                  for_Es.push( for_E );
                }
              }
            } else if (con_B.foreach || con_B.forvar) {
              this.recipe.error( 'foreach and forvar must both be present' );
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
      builders
        .filter( con_B => showElementWithID[con_B.key] )
        .forEach( con_B => {
          const key = con_B.key;
          const con_E = builderID2el[key];
          const instance_R = con_B.instanceRecipe;

          const list = forBuilderID2List[key];
          if (list) { // foreach items

            const for_Es = forBuilderID2E[key];
            const forInstances = forBuilderID2Instances[key];
            for (let i=0; i<list.length; i++ ) {
              this.it[ con_B.forvar ] = list[i];
              this.idx[ con_B.forvar ] = i;
              //console.log( `set ${this.id}/${this.builder.name} it[${con_B.forvar}] to ${i}` );
              if (instance_R) {
                const for_I = forInstances[i];
                for_I.it[ con_B.forvar ] = list[i];
                for_I.idx[ con_B.forvar ] = i;
                //console.log( `set ${for_I.id}/${for_I.builder.name} it[${con_B.forvar}] to ${i}` );
                for_I.refresh();

                // put fill contents in
                console.warn( "need to put named fill contents in for looped instances" );
                if (con_B.defaultFillContents && con_B.defaultFillContents.length) {
                  const fill_E = for_I.getFillEl();
                  this._refresh_el_children( fill_E, con_B.defaultFillContents );
                }
              } else {
                this._refresh_el( for_Es[i], con_B );
              }
            }
          }
          else { //single item

            if (instance_R) {
              const con_I = this.childInstances[key];
              con_I.refresh();

              // check for fill and fill contents
              console.warn( "need to put named fill contents in" );
              if (con_B.defaultFillContents && con_B.defaultFillContents.length) {
                const fill_E = con_I.getFillEl();
                this._refresh_el_children( fill_E, con_B.defaultFillContents );
              }
            }
            else { // element builder
              //console.log( `CALL REFRESH FOR ${con_B.id}` );
              this._refresh_el( con_E, con_B );
            }
          }
        } );
    } //_refresh_el_children
  } // Class Instance
}
