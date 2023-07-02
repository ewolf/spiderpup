// -------- LAUNCH ------

window.onload = ev => {
  init( filespaces, defaultFilename );
}



// --------  CODE  ------

const FN_2_NS = {};
let lastid = 0;

function error( msg ) {
  console.error( msg );
}

function nextid() {
  return lastid++;
}

function init( fileSpaces, defaultFilename ) {
  const pageNS = loadNamespace( defaultFilename );
  activateNamespaces();

  const bodyR = new BodyRecipe();
  bodyR.setup( pageNS );
  bodyR.installTitle();

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

  NS.setup( NS_node );

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
        recipe.setup( this, recipeData );
        return recipe;
      }
    } 
    else if (parts.length === 2) {
      const NS = this.aliasedNS[parts[0]];
      recipe = NS && NS.findRecipe( parts[1] );
      if (recipe) return recipe;
      throw new Error( `recipe '${tag}' not found` );
    } else {
      throw new Error( `recipe '${tag}' not found` );
    }
  }
  setup( node ) {
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

  setup( NS, recipeData ) {
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

  createInstance(builder) {
    const inst = new Instance();
    inst.setup( this, builder );
    return inst;
  }

} //class Recipe


class BodyRecipe extends Recipe {
  setup(pageNS) {

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
  installTitle() {
    this.head.title && (document.title = this.head.title);
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
    [ 'listen', 'fill' ]
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
    el.dataset.SPID = this.id;

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
    builder.instance = this;
    this.childInstances = {}; // id -> instance
    this.builder_id2el = {};
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
            data[fld] = from.data[fld];
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
    // both el and node exist here

    // first fill in the attributes as neeed
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

    const builderID2el = {};
    Array.from( el.children )
      .forEach( el => el.dataset.SPID && ( builderID2el[el.dataset.SPID] = el ) );
    
    (builder.contentBuilders).forEach( con_B => {
      let con_E = builderID2el[con_B.id];

      const instance_R = con_B.instanceRecipe;

      if (instance_R) {
        // we didnt check if there is already an instance
        const con_I = builder.instance.childInstances[con_B.id]
            ||= instance_R.createInstance(con_B);

        const inst_B = con_I.instanceBuilder;

        if (!con_E) {
          con_E = inst_B.buildElement(con_I);
          this.builder_id2el[con_B.id] = con_E;
          con_I.attachTo( con_E );
          el.append( con_E );
        }
        
        con_I._refresh( con_E, inst_B );

        // check for fill and fill contents
        if (con_B.defaultFillContents && con_B.defaultFillContents.length) {
          const fill_E = con_I.getFillEl();
          con_B.defaultFillContents
            .forEach( fill_con_B =>
              this._refresh( fill_E, fill_con_B )
            )
        }

      } 
      else { // element builder
        if (!con_E) {
          con_E = con_B.buildElement(this);
          this.builder_id2el[con_B.id] = con_E;
          el.append( con_E );
        }
        this._refresh( con_E, con_B );
      }
    } );


    // start with the root el
    //    this.rootNode.refresh( this.root_EL );
    

    // if its an element, is easy, refresh the element node

    // if its a component and that recipes head is also
    // a component, that is where it gets interesting

    // make 'builder nodes'

    // innermost recipe has a element root
    //  create a builder on that
    // if a recipe has its root an other recipe
    //  take that other root builder and copy it
    //  then overlay methods and data on top of it
    //  overriding and adding.
    //  add listeners in addition

  }
} // Class Instance

