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

  const bodyR = createBodyRecipe( pageNS );
  bodyR.installTitle();

  const bodyInst = bodyR.createInstance();
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

function createBodyRecipe( pageNS ) {

  const html = pageNS.node.html || {};
  const body = html.body;

  debugger;

  const bodyNode = {
    tag: 'body',
    contents: (body && body.contents) || [], 
  };

  const bodyR = new BodyRecipe();
  bodyR.setup( pageNS, bodyNode, html.head );
  return bodyR;
}

class Namespace {
  // is gonna have
  //    recipes
  //    data
  //    functions
  constructor( args ) {
    this.id = nextid();
    this.aliasedNS = {};
  }
  aliasNamespace( alias, NS ) {
    this.aliasedNS[alias] = NS;
  }
  setup( node ) {
    Object.keys( node )
      .forEach( k => this[k] = node[k] );
  }
  onLoad() {
    
  }
}

class Recipe {
  constructor( args ) {
    this.id = nextid();
  }
  setup( NS, node ) {
    this.namespace = NS;

    Object.keys( node )
      .forEach( k => (this[k] = node[k]) );
  }
  createInstance() {
    const inst = new Instance();
    inst.setup( this );
    return inst;
  }
}


class BodyRecipe extends Recipe {
  setup(NS, node, head) {
    super.setup(NS,node);
    this.head = head || {};
  }
  installTitle() { 
    this.head.title && (document.title = this.head.title);
  }
}


class Instance {
  constructor( args ) {
    this.id = nextid();
  }
  setup( recipe, node ) {
    this.recipe = recipe;
    this.node = node;
  }
  attachTo(el) {
    this.root_EL = el;
  }
  refresh() {
    this.node;
    debugger;
    // start with the root el
    
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
}

