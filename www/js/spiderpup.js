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

// -------- LAUNCH ------

window.onload = ev => {
  init( filespaces, defaultFilename );
}



// --------  CODE  ------

const FN_2_NS = {};
let lastid = 0;

function nextid() {
  return lastid++;
}

function init( fileSpaces, defaultFilename ) {
  const pageNS = loadNamespace( defaultFilename );
  activateNamespaces();

  const bodyR = new BodyRecipe();
  bodyR.setup( pageNS );
  bodyR.installHead();

  const bodyInst = bodyR.createInstance(bodyR.rootBuilder);
  bodyInst.attachTo(document.body);
  bodyInst.refresh();
}


// calls the onLoad handlers for
// all the loaded namespaces
function activateNamespaces() {
  Object.values( FN_2_NS ).forEach( NS => NS.onLoad() );
}

function loadNamespace( filename ) {
  let NS = FN_2_NS[filename];
  if (NS) return NS;

  const NS_node = filespaces[filename];
  if (!NS_node) {
    return error (`unable to load namespace '${filename}'`);
  }

  NS = FN_2_NS[filename] = new Namespace();

  const alias_2_FN = NS_node.import_namespaces || {};
  const aliases = Object.keys( alias_2_FN );
  aliases.forEach( alias =>
    NS.aliasNamspace( alias, loadNamespace(alias_2_FN[alias]))
  );

  NS.setup( NS_node, filename );

  return NS;
}

class Node {
  get id() {
    this._id ||= nextid();
    return this._id;
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
  aliasNamespace( alias, NS ) {
    this.aliasedNS[alias] = NS;
  }
  error( msg ) {
    console.error( msg );
    throw new Error( `${msg} in file '${this.name}'` );
  }
  findRecipe( tag ) {
    const parts = tag.split(/[.]/);
    let recipe;
    if (parts.length === 1) {
      const recipeName = parts[0];
      recipe = this.recipes[recipeName];
      if (recipe) return recipe;
      const recipeData = this.recipeData[recipeName];
      if (recipeData) {
        recipe = this.recipes[recipeName] = new Recipe();
        recipe.setup( this, recipeData, recipeName );
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
  setup( node, filename ) {
    this.name = filename;
    this.recipeData = node.recipes || {};
    this.data = node.data || {};
    this.functios = node.functions || {};
    node.listen && (this.listen = node.listen);
    node.html && (this.html = node.html);
  }
  onLoad() {

  }
} //class NameSpace

class Recipe extends Node {

  setup( NS, recipeData, recipeName ) {
    this.name = recipeName;
    this.namespace = NS;

    [ 'data', 'functions' ]
      .forEach( k => (this[k] = recipeData[k] || {} ) );
    [ 'class', 'preLoad' ]
      .forEach( k => (recipeData[k] && (this[k] = recipeData[k] )) );
    this.namedFillBuilders = {};
    
    this.contents = recipeData.contents;
    this.prepRootBuilder();
    if (!this.fillBuilder) {
      this.fillBuilder = this.rootBuilder;
    }
  }
  
  error( msg ) {
    this.namespace.error( `${msg} in recipe '${this.name}'` );
  }

  // this is here for the case of a root component node
  // being an alias for an other component
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

  createInstance(builder, parentInstance) {
    const inst = new Instance();
    inst.setup( this, builder );
    inst.parentInstance = parentInstance;
    return inst;
  }

} //class Recipe


class BodyRecipe extends Recipe {
  setup(pageNS) {

    this.name = 'body';

    const html = pageNS.html || {};
    const body = html.body || {};

    const rootNode = { 
      contents: [
        {tag:'body',
         contents: body.contents || [],
         ...body}
      ]
    };

    super.setup(pageNS, rootNode);

    this.head = html.head || {};
  }
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

    // css files
    const css = this.head.css;
    const cssFiles = Array.isArray( css ) ? css : css ? [css] : [];
    cssFiles.forEach( file => {
      const link = document.createElement( 'link' );
      link.setAttribute( 'rel', 'stylesheet' );
      link.setAttribute( 'media', 'screen' );
      link.setAttribute( 'href', file );
      head.appendChild( link );
    } );

    // js files
    const js = this.head.javascript;
    const jsFiles = Array.isArray( js ) ? js : js ? [js] : [];
    jsFiles.forEach( file => {
      const scr = document.createElement( 'script' );
      scr.setAttribute( 'type', 'module' );
      scr.setAttribute( 'src', file );
      head.appendChild( scr );
    } );
    
  }
}  //class BodyRecipe

class Builder extends Node {

  setup( layerAbove, withinRecipe, instanceRecipe ) {
    this.tag = layerAbove.tag;
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

  layer( layerAbove, recipe ) {
    this.layerAbove = layerAbove;
    this.recipe = recipe;
    [ 'attrs', 'data', 'on', 'functions' ]
      .forEach ( htype => {
        if (htype in layerAbove) {
          const above = layerAbove[htype];
          const current = this[htype] ||= {};
          Object.keys (above)
            .forEach( fld => {
              if (htype === 'attrs' && fld === 'class') {
                current[fld] = [above[fld], current[fld]].join( " " );
              } else if (htype === 'functions') {
                const fun = layerAbove.functions[fld];
                console.warn( "should distinguish methods, functions, mixins" );
                current[fld] = function() { return fun(...arguments) };
              } else {
                current[fld] = above[fld];
              }
            } );
        }
      });
    [ 'listen', 'fill', 'if', 'elseif', 'else', 'foreach', 'forvar', 'handle' ]
      .forEach( fun => 
        layerAbove[fun] && (this[fun] = layerAbove[fun]) );

    this.contents ||= [];
    this.contents.push( ...(layerAbove.contents||[]) );
  } //layer

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
                    fill_B.setup( fill_con, R );
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
                    fill_B.setup( fill_con, R );
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

  buildElement( inst ) {
    const el = document.createElement( this.tag );
    el.dataset.SP_ID = this.id;

    if (this.handle) {
      inst.el[this.handle] = el;
    }

    // attach event listeners
    this.on && Object.keys( this.on )
      .forEach( evname => {
        const onfun = this.on[evname];
        const evfun = function() {
          const prom = onfun( inst, ...arguments );
          Promise.resolve( prom )
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
    this.childInstances = {}; // id -> instance
    this.builder_id2el = {};
    this.it            = {};
    this.idx           = {};
    this.el            = {};
    this.layer( recipe, builder );
  }

  check() {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  makeData() {
    const inst = this;
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
        return value;
      }
    } );
    
  }

  layer( recipe, builder ) {
    // we want za data
    const data = this.data ||= this.makeData();
    [ recipe, builder ]
      .forEach ( from => {
        from.data && Object.keys( from.data )
          .forEach( fld => {
            data[fld] = this.dataVal(from.data[fld]);
          } );
      } );
  }

  getFillEl(name) {
    const R = this.recipe;
    if (name) return this.build_id2el[R.namedFillBuilders[name].id];
    return this.builder_id2el[R.fillBuilder.id];
  }

  get instanceBuilder() {
    let B = this._instanceBuilder;
    if (!B) {
      B = this._instanceBuilder = new Builder();
      B.setup( this.recipe.rootBuilder, this.recipe, this.builder );
      B.instance = this;
      B.fillOut();
    }
    return B;
  }

  attachTo(el) {
    this.root_EL = el;
  }

  dataVal( v ) {
    return typeof v === 'function' ? v(this) : v;
  }

  refresh() {
    this._refresh( this.root_EL, this.recipe.rootBuilder );
  }

  _refresh( el, builder ) {

    // fill in elements attributes ---------------------------
    const attrs = builder.attrs;
    attrs && Object.keys(attrs)
      .forEach( attr => {

        const val = this.dataVal( attrs[attr] );

        if (attr.match( /^(textContent|innerHTML)$/)) {
          el[attr] = val;
        } else if (attr === 'class' ) {
          val.trim().split( /\s+/ ).forEach( cls => el.classList.add( cls ) );
        } else if (attr === 'style') {
          console.warn( 'could unify style styles in perl' );
          let styles = val;
          if (Array.isArray(val)) {
            styles = {};
            val.forEach( h => {
              Object.keys( h ).forEach( k => styles[k] = h[k] );
            } );
          }
          else if (typeof val !== 'object') {
            styles = {};
            val.split( /;/ )
              .forEach( kvp => kvp.split( /\*:\s*/ )
                        .forEach( p => styles[p[0]] = p[1] ) );
          }
          Object.keys( styles )
            .forEach( style => el.style[ style ] = styles[style] );
        } else {
          el.setAttribute( attr, val );
        }
      } );

    // catalog child elements ---------------------------
    const builderID2el = {};
    Array.from( el.children )
      .forEach( child_E => {
        if (child_E.dataset.SP_ID) {
          if (child_E.dataset.SP_FOR_IDX !== undefined) {
            builderID2el[`${child_E.dataset.SP_ID}_${child_E.dataset.SP_FOR_IDX}`] = child_E;
          } else {
            builderID2el[child_E.dataset.SP_ID] = child_E;
          }
        }
      } );

    // little function to remove extra forloop elements
    const forTrim = (startIdx,con_B,con_E) => {
      for (let i=startIdx; i<con_E.dataset.SP_LAST_LEN; i++) {
        const key = `${con_E.dataset.SP_ID}_${i}`
        const for_E = builderID2el[key];
        delete builderID2el[key];
        for_E && for_E.remove();
        // remove any child instance that went along with this forloop
        delete this.childInstances[`${con_B.id}_${i}`];
      }
    };

    // ensure child elements for builders (in branch to show or not) ----
    const showElementWithID = {};
    let lastWasConditional = false,
        conditionalDone = false,
        lastConditionalWasTrue = false;
    // hang on to for instances
    const forBuilderID2List = {};
    const forBuilderID2Instances = {};
    const forBuilderID2E = {};

    (builder.contentBuilders).forEach( con_B => {
      let con_E = builderID2el[con_B.id];
      const instance_R = con_B.instanceRecipe;  
      let inst_B, con_I;

      // create the element if need be
      if (!con_E) {
        if (instance_R) {
          con_I = this.childInstances[con_B.id]
            ||= instance_R.createInstance(con_B,this);

          inst_B = con_I.instanceBuilder;
          con_E = inst_B.buildElement(con_I);
          con_I.attachTo( con_E );
        }
        else { // element not instance
          con_E = con_B.buildElement(this);
        }
        builderID2el[con_B.id] = this.builder_id2el[con_B.id] = con_E;
        
        con_E.style.display = 'none';
        el.append( con_E );
      }

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
        showElementWithID[con_B.id] = true;
        con_E.style.display = null;
        
        // check if this is a loop. if so
        // create elements and maybe child instances for
        // each iteration of the loop
        if (con_B.foreach && con_B.forvar) {
          const forInstances = forBuilderID2Instances[con_B.id] = [con_I];
          const for_Es = forBuilderID2E[con_B.id] = [con_E];
          const list = forBuilderID2List[con_B.id] = con_B.foreach(this);
          if (con_E.dataset.SP_LAST_LIST_LEN > list.length) {
            forTrim( list.length - 1, con_B, con_E );
          }
          con_E.dataset.SP_LAST_LIST_LEN = list.length;
          let lastEl = con_E;
          for (let i=1; i<list.length; i++) {
            const key = `${con_B.id}_${i}`;
            let for_E = builderID2el[key];
            if (!for_E) {
              if (instance_R) {
                const forIDKey = `${con_B.id}_${i}`;
                const for_I = this.childInstances[forIDKey]
                      ||= instance_R.createInstance(con_B,this);
                forInstances.push( for_I );
                for_E = inst_B.buildElement(for_I);
                builderID2el[forIDKey] = for_E;
                con_I.attachTo( for_E );
              } else {
                for_E = con_B.buildElement(this);
              }
              for_E.dataset.SP_FOR_IDX = i;
            }
            for_Es.push( for_E );
            el.append( for_E );
          }
        } else if (con_B.foreach || con_B.forvar) {
          this.recipe.error( 'foreach and forvar must both be present' );
        }

      } else {
        con_E.style.display = 'none';
        // remove foreach beyond zero
        if (con_E.dataset.SP_LAST_LEN > 1) {
            forTrim( 1, con_B, con_E );
        }
        
      }
      
    } );

    // refresh seen builders

    (builder.contentBuilders)
      .filter( con_B => showElementWithID[con_B.id] )
      .forEach( con_B => {
        const con_E = builderID2el[con_B.id];
        const instance_R = con_B.instanceRecipe;

        const list = forBuilderID2List[con_B.id];
        if (list) { // foreach items

          const for_Es = forBuilderID2E[con_B.id];
          const forInstances = forBuilderID2Instances[con_B.id] = [];
          for (let i=0; i<list.length; i++ ) {
            this.it[ con_B.forvar ] = list[i];
            this.idx[ con_B.forvar ] = i;
            if (instance_R) {
              const for_I = forInstances[i];
              for_I.refresh();
              if (con_B.defaultFillContents && con_B.defaultFillContents.length) {
                const fill_E = for_I.getFillEl();
                con_B.defaultFillContents
                  .forEach( fill_con_B => this._refresh( fill_E, fill_con_B ));
              }

            } else {
              this._refresh( for_Es[i], con_B );
            }
          }
        }
        else { //single item
          if (instance_R) {
            // we didnt check if there is already an instance
            const con_I = this.childInstances[con_B.id];
            con_I.refresh();

            // check for fill and fill contents
            if (con_B.defaultFillContents && con_B.defaultFillContents.length) {
              const fill_E = con_I.getFillEl();
              con_B.defaultFillContents
                .forEach( fill_con_B => this._refresh( fill_E, fill_con_B ));
            }
          } 
          else { // element builder
            this._refresh( con_E, con_B );
          }
        }

      } );

  }
} // Class Instance

