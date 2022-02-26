const assert = require('assert');
require('../www/js/spiderpup.js');

const testsToDo = [
  'test instance.has',
  'node instance test for refresh',
  'data with functions refresh',
  'data with functions refresh for foreach',
  'test parent functions perculating down to instance',
  'test that element handles are set before possibly being used',
  'test that instance handles are set before possibly being used',
  'fails above all tests',
  'red/green text for pass fails on this page',
];
/**

 Tests.

   this tests client spiderpup javascript by
   writing data structures like the server would
   have in the page and executing them.

   it provies a path (from body) structure that returns
   an element. body must be the first thing in this.
   Path parts are delimited by pipe characters. The body
   stands alone, but each subsequent path item is a number
   followed by an html tag. the number is the index in the
   children list of the previous element.

   completed
     simple html structure
     include components
     include components function override
     nodes with internal content and a specified spot
     nodes with internal content and no specified spot
     namespace inclusions
     functions inherited from default namespace
     functions inherited from non-default namespace

     if/elseif/else with elements
     if/elseif/else with components
     nodes with internal content that has if/then
     if/elseif/elseif/elseif/else
     fail if elseif is given
     fail if else is given

     foreach with looping elements in looping elements
     foreach with looping components that have looping internal content and loops
       in their own content
     foreach with looping components in looping components
     foreach with looping components in looping elements
     foreach with looping elements in looping components 
     foreach'd component with internal content
     foreach with if/elseif/else elements
     foreach with if/elseif/else components
     foreaches with same looping var at same level
     foreach elements in foreach elements
     foreach components in foreach elements
     nodes with internal content that has foreach

     test title

     test component function
     test body/namespace function

     test preLoad
     test onLoad

     test handles for elements
     test handles for components
     test component handlers
     test element handlers
     test broadcast

     test handles for elements in loops 
     test handles for components in loops

     update list size, refresh and get correct number of items

   todo

     test css styles
     test less styles
     test javascript in seperate modules

     add more todo

     javascript YAML parser

     perl JSON writer (with fun)
*/

window.misc = 0;
let def;

function reset() {
  // empty and clear attributes
  document.body.innerHTML = '';
  document.body.hasInit = false;
  def = { TEST: { components: {}, 
                  html: { head: {}, body: {contents: [] } } } };
  
}

function debug() {
  debugger;
}

function elPath(string) {
  const pathParts = string.toLowerCase().split( '|' );

  if (pathParts.length === 0 || pathParts[0] !== 'body') {
    console.warn( "elPath path must start with body. that's just how it is" );
    return undefined;
  }

  let node = document.body;
  for (let i=1; i<pathParts.length; i++) {
    let [ pp, number, tag ] = pathParts[i].split( /^(\d+)[^a-z]*(.*)$/ );
    number = parseInt(number);
    const childel = node.children[number];
    if (childel && childel.tagName === tag.toUpperCase()) {
      node = childel;
    } else {
      return undefined;
    }
  }

  return node;
} //elPath

let ran = 0;
let passes = 0;
let fails = 0;

let messages = [];

function log( ...args ) {
  messages.push( ...args );
//  console.log( ...args );
}

function ok( bool, msg ) {
  if (bool) {
    pass( msg );
  } else {
    fail( msg );
  }
}

function like( actual, regex, msg ) {
  if (actual.match( regex )) {
    return pass( msg );
  } 
  return fail( `${msg}'. expected '${regex}' and got '${actual}` );
}

function is_deeply( actual, expected, msg ) {
  if (_is_deeply( actual, expected)) {
    return pass( msg );
  }
  log( actual, expected, 'FAIL' );
  return fail( msg );
}
function _is_deeply( actual, expected ) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      log( 'mismatch array vs non array' );
      return false;
    }
    if (actual.length !== expected.length) {
      log( 'mismatch array length' );
      return false;
    }
    for( let i=0; i<actual.length; i++ ) {
      if (! _is_deeply( actual[i], expected[i] )) {
        log( "B");
        return false;
      }
    }
    return true;
  } else if(typeof actual === 'object') {
    if (typeof expected !== 'object') {
      log( 'mismatch object vs non object' );
      return false;
    }
    const keys = Object.keys(actual);
    if (keys.length !== Object.keys(expected).length) {
      log( 'mismatch hash key length' );
      return false;
    }
    for ( let i=0; i<keys.length; i++ ) {
      if (! _is_deeply( actual[keys[i]], expected[keys[i]] )) {
        log( "A");
        return false;
      }
    }
    return true;
  } 
  return actual === expected;
}

function is( actual, expected, msg ) {
  if (actual === expected) {
    pass( msg );
    return true;
  } else {
    fail( `${msg}'. expected '${expected}' and got '${actual}` );
  }
}
function pass (msg) {
  ran++;
  passes++;
  log( `passed: test '${msg}'` );
  assert.ok( true, msg );
  return true;
}
function fail (msg) {
  const stack = new Error().stack.split( /[\n\r]+/ );
  const failline = stack.filter( l => l.match(/^\s*at test/) )[0];
  const lineNum = failline ? failline.replace( /.*:(\d+):\d+\)$/, '$1' ) : '?';
  ran++;
  fails++;
  log( `FAILED: test '${msg}' (line ${lineNum})` );
  assert.ok( false, msg );
  debug();
  return false;
}
function doneTesting() {
  if (ran === passes) {
    log( `PASSED ALL ${ran} TESTS` );
  } else {
    log( `FAILED ${fails} of ${ran} TESTS, passed ${passes}` );
  }
}
function confirmEl( testname, tag, arg1, arg2, el, path ) {

  let attrs = arg1 || {}, contents = arg2 || [];

  if (typeof arg1 === 'string') {
    attrs = { textContent: arg1 };
  } else if( Array.isArray( arg1 ) ) {
    contents = arg1;
    attrs = {};
  }

  if (! (attrs.style && 'display' in attrs.style) ) {
    attrs.style = attrs.style || {};
    attrs.style.display = '';
  }

  if (tag === 'body') {
    el = document.body;
  }

  path = (path || [tag]);

  const pathstr = path.join("|");

  if (el === undefined) {
    fail( `path "${pathstr}" not found for test "${testname}"` );
    return; 
  }

  const teststr = `in test ${testname} at path ) ${pathstr}`;

  is (el.tagName.toLowerCase(), tag.toLowerCase(), `tag ${teststr}`);

  // check the element attributes
  Object.keys( attrs ).forEach( attr => {
    const val = attrs[attr];
    if (typeof val === 'object' && val !== null) {
      const fld = Object.keys( val )[0];
      const eVal = attrs[attr][fld];
      const aVal = el[attr][fld];
      if (! is (aVal, eVal, `expected property '${attr}.${fld}' to be '${eVal}' and got '${aVal}'  ${teststr} in test ${testname} at path ) ${pathstr}`)) {
        debug();
      }
    } else if (attr === 'textContent') {
      const textNode = el.childNodes[0] && el.childNodes[0].textContent;
      if ( ! is (textNode, val, `expected text '${val}' and got '${textNode}' ${teststr}`) ) {
        debug();
      }
    } else if (attr === 'class') {
      const classes = val.split( ' ' );
      is (classes.length, el.classList.length, 'el has ${classes.length} classes' );
      classes.forEach( cls => ok( el.classList.contains( cls ), `el has classes '${val}'` ) );
    } else {
      if (! is (el.getAttribute( attr ), val, `expected for attribute ${attr} : '${val}' and got '${el.getAttribute(attr)}' ${teststr}` ) ) {
        debug();
      }
    }
  } );

  // check the contents

  // allow [ 'tag' .. ] so it doesnt have to be [ ['tag'...] ]
  if (contents.length > 0 && ! Array.isArray( contents[0] ) ) {
    contents = [contents];
  }
  if( ! is (el.childElementCount, contents.length, `content count ${teststr}` ) ) { debug(); }

  contents.forEach( (con,idx) => {
    const [ contag, conarg1, conarg2 ] = con;
    const conel = el.children[idx];
    confirmEl( testname, contag, conarg1, conarg2, conel, [...path,`${idx} ${contag}`] );
  } );

} //confirmEl


function checkNode( path, expected_attrs, msg ) {
  const actualEl = elPath( path );
  if (! actualEl) {
    fail( `${msg} : html element not found` );
    return;
  }
  let passes = true;
  let failmsg = '';
  // check the expected attrs
  Object.keys( expected_attrs ).forEach( attr => {
    const val = expected_attrs[attr];
    if (typeof val === 'object' && val !== null) {
      const fld = Object.keys( val )[0];
      const eVal = expected_attrs[attr][fld];
      const aVal = actualEl[attr][fld];
      passes = passes && aVal === eVal;
      if (!passes) {
        failmsg = `expected property '${attr}.${fld}' to be '${eVal}' and got '${aVal}'`;
        debug();
      }
    }
    else if (attr === 'textContent') {
      const textNode = actualEl.childNodes[0] && actualEl.childNodes[0].textContent;
      passes = passes && textNode === val;
      if (!passes) {
        failmsg = `expected text '${val}' and got '${textNode}'`;
        debug();
      }
    } else {
      passes = passes && actualEl.getAttribute( attr ) === val;
      if (!passes) {
        failmsg = `expected for attribute ${attr} : '${val}' and got '${actualEl.getAttribute(attr)}'`;
        debug();
      }
    }
  } );
  if (passes) {
    pass( msg );
  } else {
    fail( msg + ' ' + failmsg );
  }

  return passes;
} //checkNode

function el(tag, attrs, contents) {
  if (Array.isArray( attrs ) ) {
    contents = attrs;
    attrs = {};
  } else {
    if (typeof attrs !== 'object') {
      attrs = { textContent: attrs };
    }
  }
  contents = contents || [];

  const on = {};

  const attrNames = Object.keys( attrs );

  const elNode = { tag, attrs, contents, on };

  attrNames.forEach( attr => {
    const m = attr.match(/^on_(.*)/);
    if (m) {
      on[m[1]] = attrs[attr];
      delete attrs[attr];
    }
    else if (attr === 'fill' ) {
      elNode.fill = attrs[attr];
      delete attrs[attr];
    }
    else if (attr.match(/^(if|elseif|else|foreach|forval|data|handle|debug)$/)) {
      elNode[attr] = attrs[attr];
      delete attrs[attr];
    }
  } );
  return elNode;
} //el

function node(tag, args, contents) {
  if (Array.isArray(args)) {
    contents = args;
    args = undefined;
  }
  const n = { tag, attrs: {}, on:  {} };

  [ 'functions', 'data' ]
    .forEach( fld => ( n[fld] = (args && args[fld]) || {} ) );

  args && Object.keys( args ).forEach( fld => {
    const m = fld.match(/^on_(.*)/);
    if (m) {
      n.on[m[1]] = args[fld];
    }
    else if (fld.match(/^(if|elseif|else|foreach|forval|debug|handle)/)) {
      n[fld] = args[fld];
    }
    else if(fld.match( /^(fill_contents)$/)) {
      n[fld] = args[fld];
    }
    else if(fld.match( /^(functions|data)$/)) {
      // already covered
    }
    else {
      // attribute for the root element
      n.attrs[fld] = args[fld];
    }
  } );

  if (contents) {
    n.contents = contents;
  }
  return n;
} //node


function body( bodyContents ) {
  def.TEST.html.body.contents = bodyContents;
}
function def_namespace( args ) {
  Object.keys( args ).forEach( key => {
    if (key.match( /^(title|include)/ ) ) {
      def.TEST.html.head[key] = args[key];
    } else if (key.match( /^(listen|onLoad|preLoad)/ ) ) {
      def.TEST.html.body[key] = args[key];
    } else {
      def.TEST[key] = args[key];
    }
  } );
}
function other_namespaces( args ) {
  Object.keys( args ).forEach( key => {
    def[key] = args[key];
  } );
}

function go() {
  return window.init( def, 'TEST' );
}

function makeFilespace( bodyContents, args, otherFS ) {
  const fs = { ...(otherFS||{}) };
  fs.TEST = args || {};
  fs.TEST.html = { body: { contents: bodyContents } };
  fs.TEST.components = fs.TEST.components || {};
  
  def = fs;

  return fs;
} //makeFilespace

function test(...tests) {

  run( tests ).then( () => {
    doneTesting();
    reset();
    const result = messages.pop();
    body( [
      el( 'h1', result ),
      el( 'h2', { if: () => testsToDo.length > 0,
                  textContent: 'things to implement and/or test' }, [
          el ('ul', 
              testsToDo.map( msg => el( 'li', msg ) )
             ) ] ),
      el( 'h2', 'test results' ),
      el( 'ul',
          messages.map( msg => {
            const match = msg.match(/^(FAILED.*)\(line (\d+)\)$/);
            if (match) {
              msg = match[1];
              const line = match[2];
              return el( 'li', [ el( 'span', msg ), 
                                 el( 'span', { href: '#', textContent: `(line ${line})` } ) ] );
            }
            return el( 'li', msg );
          } ) )
    ] );
    go();
  } )
  .catch(err => {
      reset();
      body( [
        el( 'h1', 'unable to finish tests due to error' ),
        el( 'h2', err.message )
      ] );
      go();
  } );

}

function run(tests) {
  return new Promise( (res, rej) => {
    let cnt = tests.length;
    while( tests.length > 0 ) {
      const testfun = tests.shift();
      Promise.resolve( testfun() )
        .then( () => { if (0 == --cnt) {res()} } );
    }
  } );
}

// tests
//   general placement of els in document.
//   components
//   elements given to components
//   textContent from function
//   component function override
//   nodes with internal content and no specified spot
const testBasic = () => {
  reset();
  body( [ el( 'span', "FIRST" ), //0
          el( 'div', { textContent: "SECOND",   //1
                       style: 'background: blue; padding: 3px' },
              [
                node( 'foo' ), // div span
                node( 'foo', { functions: { bar: c => "BAR2" } } ),
                node( 'foo', { functions: { bar: c => "BAR3" } },
                      [ el( 'span', 'a span' ),
                        el( 'span', 'with stuff' ) ] ),
                node( 'foo', [ el( 'ul',
                                   [el( 'li', 'I am' ),
                                    el( 'li', { textContent: c => c.fun.groan() } ),
                                    el( 'li', 'in' ) ] ) ] ),
              ])
        ]),
    def_namespace({
      title: 'titlez',
      components: {
        foo: {
          attrs: { class: 'woot boot', 
                   style: 'cursor:pointer' },
          functions: {
            bar: c => "BAR",
          },
          contents: [
            el ( 'div', '', [
              el ('span', { textContent: c => c.fun.bar() } ),
            ] ),
          ],
        }, // foo component
        
      }, //components
      
      functions: {
        groan: c => "groan",
      } //functions
      
    } );
  
  go();

  is ( document.title, 'titlez', 'title was given and set' );
  confirmEl( 'test-basic',
             'body',
              [
                [ 'span', 'FIRST' ], // 0
                [ 'div', { style: { background: 'blue',
                                    padding: '3px' },
                           textContent: 'SECOND'
                         }, // 1
                  [
                    [ 'div', { class: 'woot boot', style: { cursor: 'pointer' } },
                      [ 'span', 'BAR' ]],  // 1, 0
                    [ 'div', { class: 'woot boot', style: { cursor: 'pointer' } }, [ 'span', 'BAR2' ]], // 1, 1
                    [ 'div', { class: 'woot boot', style: { cursor: 'pointer' } }, [ // 1, 2
                      [ 'span', 'BAR3' ],           // 1, 2, 0
                      [ 'span', 'a span' ],     // 1, 2, 1
                      [ 'span', 'with stuff' ], // 1, 2, 2
                    ]],
                    [ 'div', [
                      [ 'span', 'BAR' ],     // 1, 3, 0
                      [ 'ul',          // 1, 3,
                        [
                          [ 'li', 'I am' ],
                          [ 'li', 'groan' ],
                          [ 'li', 'in' ]
                        ]
                      ]
                    ]]]]]);

}; //testBasic

// tests
//   general placement of els in document.
//   components
//   elements given to components
//   textContent from function
//   component function override
//   nodes with internal content and no specified spot
const testIfs = () => {
  reset();
  body( 
    [
      node( 'iffy', { data : { number: 4 } }),
      node( 'iffy', { data : { number: 3 } }),
      node( 'iffy', { data : { number: 2 } }),
      node( 'iffy' ),
      el ('section', [ // if/elseif/elseif/elseif/else
        node( 'stuff', { if: c => c.get('number') == 20 } ),
        node( 'stuff', { elseif: c => c.get('number') == 51 } ),
        node( 'stuff', { elseif: c => c.get('number') == 50 } ),
        node( 'stuff', { elseif: c => c.get('number') == 12 } ),
        node( 'stuff', { else: true } ),
      ] ),
    ],
  );

  def_namespace( {
    data: { blat: 1, number: 50 },
    components: {
      iffy: {
        data: { number: 1 },
        contents: [
          el ('div', [
            el ('h1', { if: c => c.get('number') == 1, textContent: 'is one' } ),
            el ('h2', { elseif: c => c.get('number') < 3, textContent: 'is less than 3' } ),
            el ('h3', { elseif: c => c.get('number') == 4, textContent: 'is four' } ),
            el ('h4', { else: true, textContent: 'whuddeveh' } ),
          ] )
        ],
      }, //iffy

      stuff: {
        contents: [ el( 'span', 'stuff' ) ],
      },
    }
  } );

  go();
  confirmEl( 'test-ifs',
             'body',
             [ 
               [ 'div', 
                 [
                   [ 'h1', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h2', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h3', { textContent: 'is four', style: { display: '' } } ],
                   [ 'h4', { textContent: undefined, style: { display: 'none' } } ],
                 ]
               ],
               [ 'div', 
                 [
                   [ 'h1', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h2', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h3', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h4', { textContent: 'whuddeveh', style: { display: '' } } ],
                 ]
               ],
               [ 'div', 
                 [
                   [ 'h1', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h2', { textContent: 'is less than 3', style: { display: '' } } ],
                   [ 'h3', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h4', { textContent: undefined, style: { display: 'none' } } ],
                 ]
               ],
               [ 'div', 
                 [
                   [ 'h1', { textContent: 'is one', style: { display: '' } } ],
                   [ 'h2', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h3', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'h4', { textContent: undefined, style: { display: 'none' } } ],
                 ]
               ],
               [ 'section', 
                 [
                   [ 'span', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'span', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'span', { textContent: 'stuff', style: { display: '' } } ],
                   [ 'span', { textContent: undefined, style: { display: 'none' } } ],
                   [ 'span', { textContent: undefined, style: { display: 'none' } } ],
                 ],
               ]
             ]
           );
} //testIfs

const foo = () => {

  // now check for fails for wrong if/then/else combos
  reset();

  try {
    body( 
      [
        el ('section', [ // if/elseif/elseif/elseif/else
          node( 'stuff', { else: true } ),
          node( 'stuff', { if: () => 'no fun' } ),
          node( 'stuff', { elseif: () => false } ),
        ] ),
      ],
    );
    go();
    fail( 'started with else and did not error out' );
  } catch(e) {
    pass( 'errored out with incorrect else' );
    like ( e.message, /else and elseif must be preceeded by if or elseif/, 'error message for failed' );
  }


  // now check for fails for wrong if/then/else combos
  reset();

  try {
    body( 
      [
        el ('section', [ // if/elseif/elseif/elseif/else
          node( 'stuff', { elseif: true } ),
          node( 'stuff', { if: () => false } ),
          node( 'stuff', { elseif: () => true } ),
        ] ),
      ],
    );
    go();
    fail( 'started with else and did not error out' );
  } catch(e) {
    pass( 'errored out with incorrect else' );
    like ( e.message, /else and elseif must be preceeded by if or elseif/, 'error message for failed' );
  }


}; //foo


//
// tests
//     including components from other namespaces
//     nodes with internal content and a specified spot
//
const testNamespace = () => {

  reset();
  try {
    body( [
      node( 'ON.containery', 
            [
              el( 'div', {
                if: c => c.get('blat'),
                textContent: 'in o middle' } ),
              el( 'div', {
                else: true,
                textContent: 'nope nope im the else' } ),
            ]
          ),
    ] );
    def_namespace( {
      data: {
        blat: c => 'blat',
      },
    } );
    
    go();
    fail( 'used namespace that was not imported or declared' );
  } catch( e ) {
    pass( 'errored out when trying to import from a non declared, non imported namespace' );
    like ( e.message, /requested namespace that was not imported/, 'error message for trying to use a non imported non declared namespace' );
  }

  reset();
  try {
    body( [
      node( 'ON.containery', 
            [
              el( 'div', {
                if: c => c.get('blat'),
                textContent: 'in o middle' } ),
              el( 'div', {
                else: true,
                textContent: 'nope nope im the else' } ),
            ]
          ),
    ] );
    def_namespace( {
      namespaces: {
        ON: 'OTHERNAME',
      },
      data: {
        blat: c => 'blat',
      },
    } );
    
    go();
    fail( 'used namespace that was declared but not imported' );
  } catch( e ) {
    pass( 'errored out when trying to import from a declared but non imported namespace' );
    like ( e.message, /requested namespace that was not imported/, 'error message for trying to use a declared but non imported namespace' );
  }

  reset();
  try {
    body( [
      node( 'ON.containery', 
            [
              el( 'div', {
                if: c => c.get('blat'),
                textContent: 'in o middle' } ),
              el( 'div', {
                else: true,
                textContent: 'nope nope im the else' } ),
            ]
          ),
    ] );
    def_namespace( {
      data: {
        blat: c => 'blat',
      },
    } );
    other_namespaces(
      {
        OTHERNAME: {
          components: {
            containery: {
              contents: [
                el( 'div', [
                  el( 'header', 'head' ),
                  el( 'main', { textContent: 'main', fill: true } ),
                  el( 'footer', { textContent: c => c.fun.foot() } ),
                ] ),
              ],
            },
          },
          functions: {
            foot: c => "foot",
          },
        }, //OTHER (namespace)
      } );

    go();
    fail( 'used namespace that was imported but not declared' );
  } catch( e ) {
    pass( 'errored out when trying to import from a imported but not declared namespace' );
    like ( e.message, /requested namespace that was not imported/, 'error message for trying to use a imported but not declared namespace' );
  }

  reset();

  body( [
    node( 'ON.containery' ),   // body| 0 div | header | main (int) | footer
    node( 'ON.containery', [   // 1 div
      el( 'div', 'in the middle' ) // 2 div
    ] ),
    node( 'ON.containery', //3 div
          [
            el( 'div', { //4 div
              if: c => c.get('blat') == 1,
              textContent: 'in a middle' } ),
            el( 'div', {
              else: true,
              textContent: 'nop nope' } ),
          ] ),
    node( 'ON.containery', //5
          [
            el( 'div', {
              if: c => c.get('blat') != 1,
              textContent: 'in o middle' } ),
            el( 'div', {
              else: true,
              textContent: 'nope nope im the else' } ),
          ]
        ),
    
  ] );

  def_namespace( {
    namespaces: {
      ON: 'OTHERNAME',
    },
    data: {
      blat: c => 1,
    },
    functions: {
      groan: c => "groan",
    } //functions
  } );

  other_namespaces(
    {
      OTHERNAME: {
        components: {
          containery: {
            contents: [
              el( 'div', [
                el( 'header', 'head' ),
                el( 'main', { textContent: 'main', fill: true } ),
                el( 'footer', { textContent: c => c.fun.foot() } ),
              ] ),
            ],
          },
        },
        functions: {
          foot: c => "foot",
        },
      }, //OTHER (namespace)
    } );

  const inst = go();

  confirmEl( 'test-namespace',
             'body',
              [
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main'],
                    ['footer','foot']
                  ]],
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main',['div','in the middle']],
                    ['footer','foot']
                  ]],
                [ 'div', // body | 2 div
                  [
                    ['header','head'],
                    ['main','main',[
                      ['div','in a middle'],
                      ['div',{style: {display:'none'}}]
                    ]],
                    ['footer','foot']
                  ]],
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main',[
                      ['div',{style: {display:'none'}}],
                      ['div','nope nope im the else']]],
                    ['footer','foot']
                  ]],
              ] );

  inst.refresh();
  confirmEl( 'test-namespace',
             'body',
              [
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main'],
                    ['footer','foot']
                  ]],
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main',['div','in the middle']],
                    ['footer','foot']
                  ]],
                [ 'div', // body | 2 div
                  [
                    ['header','head'],
                    ['main','main',[
                      ['div','in a middle'],
                      ['div',{style: {display:'none'}}]
                    ]],
                    ['footer','foot']
                  ]],
                [ 'div',
                  [
                    ['header','head'],
                    ['main','main',[
                      ['div',{style: {display:'none'}}],
                      ['div','nope nope im the else']]],
                    ['footer','foot']
                  ]],
              ] );

}; //testNamespace

const testComponentHandles = () => {
  reset();
  body( [
    el( 'table', 
        [ el( 'tr', { foreach: c => [ "A", "B", "C" ], forval: 'row' },
              [ el( 'td', { forval: 'col', 
                            foreach: c => [ "D", "E" ],
                            textContent: c => `[row ${c.idx.row}/${c.it.row}, col ${c.idx.col}/${c.it.col}]`,
                          } ) ] ) ] ),
    el( 'main',
        [ el( 'section', { foreach: c => [ "A", "B", "C" ], forval: 'i', textContent: c => `[i ${c.idx.i}/${c.it.i}]` },
              [ el( 'div', { foreach: c => [ "D", "E" ], forval: 'j', textContent: c => `[j ${c.idx.j}/${c.it.j}]` },
                [ el( 'span', { foreach: c => [ 'F', 'G', 'H' ], forval: 'k', textContent: c => `[k ${c.idx.k}/${c.it.k}] / [j ${c.idx.j}/${c.it.j}] / [i ${c.idx.i}/${c.it.i}]` } ) ],
                  ) ] )] ),

    el ('section', [
      node( 'looper', { foreach: c => [ "A", "B", "C" ], 
                        forval: 'I', 
                        data: { number:  c => c.get('mult') * c.idx.I } } ),
    ] ),

    el ('section', [
      node( 'multilooper', { foreach: c => [ 'Z' ], forval: 'ML' }, 
            [
              el( 'span', { foreach: c => [ "D", "E" ], forval: 'IS', textContent: c => c.it.IS } ),
            ] ),
    ] ),

  ] ); //body

  def_namespace( {
    data: { blat: 1, number: 50 },

    components: {
      looper: {
        data: {
          mult: 3,
        },
        contents: [ 
          el ('div', { textContent: c => `NUM <${c.get("number")}>` } ),
        ],
      }, //looper component

      multilooper: {
        contents: [ 
          el ('div', [
            el ( 'span', 'upper' ),
            el ( 'div', { fill: true } ),
            el ( 'span', 'middle' ),
            node( 'looper', { foreach: c => [ "A", "B", "C" ], forval: 'I', data: { number: c => c.get('mult') * c.idx.I, } } ),
            el ( 'span', 'lower' ),
            el ( 'ul', [ el ( 'li', { textContent: c => `(${c.it.I}/${c.idx.I})`, foreach: c => [ "D", "E" ], forval: 'I' } ) ] ),
            el ( 'span', 'lowest' ),
          ] ),
        ],
      }, //multilooper component
    }
  } ); //def_namespace
  
  go();

  confirmEl( 'test-component-handles',
             'body',
             [
               [ 'table', 
                 [
                   [ 'tr', [
                     [ 'td', { textContent: '[row 0/A, col 0/D]' } ],
                     [ 'td', { textContent: '[row 0/A, col 1/E]' } ],
                   ] ],
                   [ 'tr', [
                     [ 'td', { textContent: '[row 1/B, col 0/D]' } ],
                     [ 'td', { textContent: '[row 1/B, col 1/E]' } ],
                   ] ],
                   [ 'tr', [
                     [ 'td', { textContent: '[row 2/C, col 0/D]' } ],
                     [ 'td', { textContent: '[row 2/C, col 1/E]' } ],
                   ] ],
                 ]
               ],

               [ 'main', 
                 [
                   [ 'section', { textContent: '[i 0/A]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 0/A]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 0/A]' } ],
                     ]],
                   ]],
                   [ 'section', { textContent: '[i 1/B]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 1/B]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 1/B]' } ],
                     ]],
                   ]],
                   [ 'section', { textContent: '[i 2/C]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 2/C]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 2/C]' } ],
                     ]],
                   ]],
                 ]
                 ], //main 
               
               [ 'section', [ //looper component
                 [ 'div', { textContent: 'NUM <0>' } ],
                 [ 'div', { textContent: 'NUM <3>' } ],
                 [ 'div', { textContent: 'NUM <6>' } ],
               ]],

               [ 'section', //multilooper component
                 [ 'div', [
                   [ 'span', 'upper' ],
                   [ 'div', [
                     [ 'span', 'D' ],
                     [ 'span', 'E' ],
                   ]],
                   [ 'span', 'middle' ],
                   [ 'div', { textContent: 'NUM <0>' } ],
                   [ 'div', { textContent: 'NUM <3>' } ],
                   [ 'div', { textContent: 'NUM <6>' } ],
                   [ 'span', 'lower' ],
                   [ 'ul', [
                     [ 'li', '(D/0)' ],
                     [ 'li', '(E/1)' ],
                   ] ],
                   [ 'span', 'lowest' ],
                   ] ],
                 ],
             ] //body
           );

}; //testComponentHandles() {

const testLoop = () => {
  reset();
  body( [
    el( 'table', 
        [ el( 'tr', { foreach: c => [ "A", "B", "C" ], forval: 'row' },
              [ el( 'td', { forval: 'col', 
                            foreach: () => [ "D", "E" ],
                            textContent: c => `[row ${c.idx.row}/${c.it.row}, col ${c.idx.col}/${c.it.col}]`,
                          } ) ] ) ] ),
    el( 'main',
        [ el( 'section', { foreach: c => [ "A", "B", "C" ], forval: 'i', textContent: c => `[i ${c.idx.i}/${c.it.i}]`, },
              [ el( 'div', { foreach: () => [ "D", "E" ], forval: 'j', textContent: c => `[j ${c.idx.j}/${c.it.j}]`, },
                [ el( 'span', { foreach: c => [ 'F', 'G', 'H' ], forval: 'k', textContent: c => `[k ${c.idx.k}/${c.it.k}] / [j ${c.idx.j}/${c.it.j}] / [i ${c.idx.i}/${c.it.i}]`, } ) ],
                  ) ] )] ),

    el ('section', [
      node( 'looper', { foreach: c => [ "A", "B", "C" ], 
                        forval: 'I', data: { number: c => c.get('mult') * c.idx.I, } } ),
    ] ),

    el ('section', [
      node( 'multilooper', { foreach: c => [ 'Z' ], forval: 'ML' }, 
            [ // loop with component with internal loop
              el( 'span', { foreach: c => [ "D", "E" ], forval: 'IS', textContent: c => c.it.IS } ),
            ] ),
    ] ),

  ] ); //body

  def_namespace( {
    data: { blat: 1, number: 50 },

    components: {
      looper: {
        data: {
          mult: 3,
        },
        contents: [ 
          el ('div', { textContent: c => `NUM <${c.get("number")}>`, } ),
        ],
      }, //looper component

      multilooper: {
        contents: [ 
          el ('div', [
            el ( 'span', 'upper' ),
            el ( 'div', { fill: true } ),
            el ( 'span', 'middle' ),
            node( 'looper', { foreach: [ "A", "B", "C" ], 
                              forval: 'I', 
                              data: { number: c => c.get('mult') * c.idx.I, } } ),
            el ( 'span', 'lower' ),
            el ( 'ul', [ el ( 'li', { textContent: c => `(${c.it.I}/${c.idx.I})`, 
                                      foreach: [ "D", "E" ], forval: 'I' } ) ] ),
            el ( 'span', 'lowest' ),
          ] ),
        ],
      }, //multilooper component
    }
  } ); //def_namespace

  go();

  confirmEl( 'test-loop',
             'body',
             [
               [ 'table', 
                 [
                   [ 'tr', [
                     [ 'td', { textContent: '[row 0/A, col 0/D]' } ],
                     [ 'td', { textContent: '[row 0/A, col 1/E]' } ],
                   ] ],
                   [ 'tr', [
                     [ 'td', { textContent: '[row 1/B, col 0/D]' } ],
                     [ 'td', { textContent: '[row 1/B, col 1/E]' } ],
                   ] ],
                   [ 'tr', [
                     [ 'td', { textContent: '[row 2/C, col 0/D]' } ],
                     [ 'td', { textContent: '[row 2/C, col 1/E]' } ],
                   ] ],
                 ]
               ],

               [ 'main', 
                 [
                   [ 'section', { textContent: '[i 0/A]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 0/A]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 0/A]' } ],
                     ]],
                   ]],
                   [ 'section', { textContent: '[i 1/B]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 1/B]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 1/B]' } ],
                     ]],
                   ]],
                   [ 'section', { textContent: '[i 2/C]' }, [
                     [ 'div', { textContent: '[j 0/D]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 0/D] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 0/D] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 0/D] / [i 2/C]' } ],
                     ]],
                     [ 'div', { textContent: '[j 1/E]' }, [
                       [ 'span', { textContent: '[k 0/F] / [j 1/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/G] / [j 1/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/H] / [j 1/E] / [i 2/C]' } ],
                     ]],
                   ]],
                 ]
                 ], //main 
               
               [ 'section', [ //looper component
                 [ 'div', { textContent: 'NUM <0>' } ],
                 [ 'div', { textContent: 'NUM <3>' } ],
                 [ 'div', { textContent: 'NUM <6>' } ],
               ]],

               [ 'section', //multilooper component
                 [ 'div', [
                   [ 'span', 'upper' ],
                   [ 'div', [
                     [ 'span', 'D' ],
                     [ 'span', 'E' ],
                   ]],
                   [ 'span', 'middle' ],
                   [ 'div', { textContent: 'NUM <0>' } ],
                   [ 'div', { textContent: 'NUM <3>' } ],
                   [ 'div', { textContent: 'NUM <6>' } ],
                   [ 'span', 'lower' ],
                   [ 'ul', [
                     [ 'li', '(D/0)' ],
                     [ 'li', '(E/1)' ],
                   ] ],
                   [ 'span', 'lowest' ],
                   ] ],
                 ],
             ] //body
           );
             
}; //testLoop


const testHandles = () => {
  const calls = [];

  reset();
  body( 
    [
      el( 'button', { handle: 'button', 
                      on_click: c => c.comp.stuff.fun.shout(),
                      textContent: 'click me' } ),
      node( 'stuff', { handle: 'stuff', 
                       on_stuffEvent: (c,evt) => { 
                         calls.push( c.name + " got event from stuff" );
                       },
                     } ),
      //handles in loops
      el( 'section', { foreach: c => ["A","B","C"], forval: 'i' },
          [
            el( 'div', { foreach: c => ["D","E"], forval: 'j' },
                [
                  node( 'fluff', { handle: 'loopyFluff', data: { name: c => `FLUFF ${c.it.i} / ${c.it.j}` } } ),
                  el( 'span', { handle: 'loopySpan', textContent: c => `${c.it.i}${c.it.j}` } ),
                ] )
          ] ),

      // handles in if els
      el ( 'div', {
        textContent: 'woof',
        handle: 'switchy',
        id: 'switchy',
        if: c => c.get( 'show' ), //check_toggle 
      } ),

      node ( 'fluff', {
        id: 'tempfluff',
        handle: 'fluff',
        if: c => c.get( 'show' ), //check_toggle
      } ),

    ],
  );

  def_namespace( {
    listen: (c,type,msg) => { 
      if (type !== 'body') {
        c.fun.bodyDo( msg );
        c.broadcast( 'body', msg );
      }
    },
    
    preLoad: (c,evt) => { 
      return new Promise( (res,rej) => {
        setTimeout( () => {
          calls.push( "PRELOAD" );
          res(); }, 100 );
      } );
    },
    onLoad: c => {  
      c.comp.stuff;
      calls.push( c.el.button.tagName );
      
      c.el.button.click();
    },

    functions: {
      bodyDo: (c,msg) => { 
        calls.push( msg + ` (from ${c.name})` );
      },
      toggle: c => c.set( 'show', ! c.get('show') ),
    },

    data: {
      show: true,
    },
    
    components: {

      stuff: {
        listen: (c,type,msg) => { 
          if (type !== 'stuff' ) {
            // tests that bodydo is inherited 
            c.fun.bodyDo( msg );
            c.event( 'stuffEvent', "MYEV" );
          }
        },
        functions: {
          shout: c => c.broadcast( 'stuff', 'hi there' ),
        },
        contents: [ el( 'span', 'stuff' ) ],
      },

      fluff: {
        data : { name: 'fluff' },
        contents: [ el( 'span', { textContent: c => `FLUFF ${c.it.i} / ${c.it.j}` } ) ],
      },

    },
  } );
  
  // onload happens, which
  //   * pushes ['BUTTON']
  // and clicks the button which calls shout that
  // makes a broadcast which is
  // heard by the body which registers the message with bodydo
  //   * pushes ['hi there (from instance of recipe html)']
  // which broadcasts the message which is heard
  // by the stuff which uses inherited bodydo to record
  //   * pushes ['hi there (from instance of recipe stuff in instance of recipe html)']
  // which sends a stuffEvent which is picked up
  // by the its instance, which has the handler to push
  //   * pushes ['instance of recipe stuff in instance of recipe html got event from stuff']

  let bodyInstance = go();

  confirmEl('test-handles',
            'body',
            [
              [ 'button', 'click me' ],
              [ 'span', 'stuff' ],
              [ 'section', 
                [
                  [ 'div', [ [ 'span', 'FLUFF A / D' ], [ 'span', 'AD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF A / E' ], [ 'span', 'AE' ] ] ], ] ],
              [ 'section', 
                [
                  
                  [ 'div', [ [ 'span', 'FLUFF B / D' ], [ 'span', 'BD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF B / E' ], [ 'span', 'BE' ] ] ],
                ] ],
              [ 'section', 
                [
                  
                  [ 'div', [ [ 'span', 'FLUFF C / D' ], [ 'span', 'CD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF C / E' ], [ 'span', 'CE' ] ] ],
                ] ],
              [ 'div', 'woof' ],
              [ 'span', { textContent: 'FLUFF undefined / undefined', id: 'tempfluff' } ],
            ],
           );
  // test the multihandles
  is ( bodyInstance.comp.loopyFluff.length, 6, '6 loopy fluffs' ) ;
  is ( bodyInstance.el.loopySpan.length, 6, '6 loopy spans' ) ;  
  is_deeply ( bodyInstance.comp.loopyFluff.map( bi => bi.name ), bodyInstance.comp.loopyFluff.map( () => 'instance of recipe fluff in instance of recipe html' ), 'loopyFluff is componentns' );
  is_deeply ( bodyInstance.el.loopySpan.map( span => span.dataset.key )
                                      .map( key => key.replace (/^[^:]+:/, '' ) ),
             [ 'i=0,j=0', 'i=0,j=1', 'i=1,j=0', 'i=1,j=1', 'i=2,j=0', 'i=2,j=1' ], 'loopsSpan right keys' );

  is ( bodyInstance.el.switchy, document.getElementById( 'switchy' ), 'element handle works' );
  
  let fluffInst = document.getElementById( 'tempfluff' ).instance;
  is (fluffInst.name, 'instance of recipe fluff in instance of recipe html', 'fluff instance' );
  is ( bodyInstance.comp.fluff, fluffInst , 'component handle works' );

  bodyInstance.fun.toggle();

  bodyInstance.refresh();

  is ( bodyInstance.el.switchy, undefined, 'el handle is gone when ifd out' );
//  is ( bodyInstance.comp.fluff, undefined, 'component handle is gone when ifd out' );

  confirmEl('test-handles',
            'body',
            [
              [ 'button', 'click me' ],
              [ 'span', 'stuff' ],
              [ 'section', 
                [
                  [ 'div', [ [ 'span', 'FLUFF A / D' ], [ 'span', 'AD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF A / E' ], [ 'span', 'AE' ] ] ], ] ],
              [ 'section', 
                [
                  
                  [ 'div', [ [ 'span', 'FLUFF B / D' ], [ 'span', 'BD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF B / E' ], [ 'span', 'BE' ] ] ],
                ] ],
              [ 'section', 
                [
                  
                  [ 'div', [ [ 'span', 'FLUFF C / D' ], [ 'span', 'CD' ] ] ],
                  [ 'div', [ [ 'span', 'FLUFF C / E' ], [ 'span', 'CE' ] ] ],
                ] ],
              [ 'div', { textContent: 'woof', style: { display: 'none' }} ],
              [ 'span', { textContent: 'FLUFF undefined / undefined', style: { display: 'none' }} ],
            ],
           );

  return Promise.resolve( bodyInstance.loadPromise )
    .then( () => { 
      is_deeply( calls, [ 'PRELOAD',
                          'BUTTON', 
                          'hi there (from instance of recipe html)',
                          'hi there (from instance of recipe stuff in instance of recipe html)',
                          'instance of recipe stuff in instance of recipe html got event from stuff',
                        ], 'correct calls' );
    } );

}; //testHandles

const testMoreLoop = () => {
  // set up a loop who's function returns data. confirm. change the data, refresh
  // confirm that the loop has changed. give it less, then more
  reset();
  body(
    [
      el( 'section', { foreach: c => c.get( 'a1' ), forval: 'i' }, 
          [
            el( 'div', { foreach: c => c.get( 'a2' ), forval: 'j' },
                [
                  el( 'span', { foreach: c => c.get( 'a3' ), forval: 'k', textContent: c => `[k ${c.idx.k}/${c.it.k}] / [j ${c.idx.j}/${c.it.j}] / [i ${c.idx.i}/${c.it.i}]`, } ),
                ] ) 
          ] )
    ]
  );
  def_namespace( {
    data: {
      a1: ["A","B","C","D"],
      a2: ["E","F"],
      a3: ["G","H","I"],
    },
  } );

  let bodyInstance = go();

  confirmEl( 'test-more-loop',
             'body',
             [
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 0/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 0/E] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 0/E] / [i 0/A]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 1/F] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 1/F] / [i 0/A]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 1/F] / [i 0/A]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 0/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 0/E] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 0/E] / [i 1/B]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 1/F] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 1/F] / [i 1/B]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 1/F] / [i 1/B]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 0/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 0/E] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 0/E] / [i 2/C]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 1/F] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 1/F] / [i 2/C]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 1/F] / [i 2/C]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 0/E] / [i 3/D]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 0/E] / [i 3/D]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 0/E] / [i 3/D]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/G] / [j 1/F] / [i 3/D]' } ],
                       [ 'span', { textContent: '[k 1/H] / [j 1/F] / [i 3/D]' } ],
                       [ 'span', { textContent: '[k 2/I] / [j 1/F] / [i 3/D]' } ],
                     ]
                   ],
                 ] ],
             ], // body
  );

  bodyInstance.set( 'a3', ["J"] );
  bodyInstance.set( 'a1', ["K","L","M","N","O"] );
  bodyInstance.refresh();

  confirmEl( 'test-more-loop',
             'body',
             [
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 0/E] / [i 0/K]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 1/F] / [i 0/K]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 0/E] / [i 1/L]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 1/F] / [i 1/L]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 0/E] / [i 2/M]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 1/F] / [i 2/M]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 0/E] / [i 3/N]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 1/F] / [i 3/N]' } ],
                     ]
                   ],
                 ] ],
               [ 'section', 
                 [
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 0/E] / [i 4/O]' } ],
                     ]
                   ],
                   [ 'div', 
                     [
                       [ 'span', { textContent: '[k 0/J] / [j 1/F] / [i 4/O]' } ],
                     ]
                   ],
                 ] ],
             ], // body
  );  
}; //testMoreLoop

const testIfLoop = () => {
  // set up a loop who's function returns data. confirm. change the data, refresh
  // confirm that the loop has changed. give it less, then more
  reset();
  body(
    [
      el( 'span', { foreach: c => ["E","F"], 
                    forval: 'i', 
                    textContent: c => `[i ${c.idx.i}/${c.it.i}]`, 
                    if: c => c.get('doita') } ), 
      el( 'div', { foreach: c => ["E","F"], 
                   forval: 'i', 
                   textContent: c => `[i ${c.idx.i}/${c.it.i}]`,
                   if: c => c.get('doitb') } ), 
      node( 'fluff', { foreach: c => ["E","F"], 
                      forval: 'j', 
                      if: c => c.get('doita') } ), 
      node( 'fluff', { foreach: c => ["E","F"], 
                      forval: 'j', 
                      if: c => c.get('doitb') } ), 
    ]
  );
  def_namespace( {

    data: {
      doita: true,
      doitb: false,
    },
    
    functions: {
      flip: c => {  
        c.set('doita',!c.get('doita'));
        c.set('doitb',!c.get('doitb'));
      },
    },

    components: {

      fluff: {
        contents: [ el( 'section', { textContent: c => `[j ${c.idx.j}/${c.it.j}]` } ) ],
      },
      
    }
  } );

  let bodyInstance = go();

  confirmEl( 'test-if-loop',
             'body',
             [
               [ 'span', { style: {display:''}, textContent: '[i 0/E]' } ],
               [ 'span', { style: {display:''}, textContent: '[i 1/F]' } ],
               [ 'div',  { style: {display:'none'}, textContent: undefined } ],
               [ 'section', { style: {display:''}, textContent: '[j 0/E]' } ],
               [ 'section', { style: {display:''}, textContent: '[j 1/F]' } ],
               [ 'section',  { style: {display:'none'}, textContent: undefined } ],
               
             ], // body
  );

  bodyInstance.fun.flip();
  bodyInstance.refresh();

  confirmEl( 'test-if-loop',
             'body',
             [
               [ 'span',  { style: {display:'none'}, textContent: '[i 0/E]' } ],
               [ 'div', { style: {display:''}, textContent: '[i 0/E]' } ],
               [ 'div', { style: {display:''}, textContent: '[i 1/F]' } ],
               [ 'section',  { style: {display:'none'}, textContent: '[j 0/E]' } ],
               [ 'section', { style: {display:''}, textContent: '[j 0/E]' } ],
               [ 'section', { style: {display:''}, textContent: '[j 1/F]' } ],
               
             ], // body
  );


}; //testIfLoop

const testInternals = () => {
  reset();
  body(
    [
      node( 'containy',
        [
          el( 'div', { handle: 'adiv', 
                       id: 'guess', 
                       textContent: 'wunda' } ),
        ] ),
    ]
  );
    
  def_namespace( {
    
    data: {
      intro: "hi there",
    },
    
    components: {
      containy: {
        contents: [ el( 'section', { id : 'containy' },
            [
              el( 'h1', { textContent: c => "containy", }  ),
              el( 'div', { fill: true } ),
            ] ) ],
      },
    },
  } );
  
  let bodyInstance = go();


  confirmEl( 'test-internals',
             'body',
             [
               [ 'section', 
                 [
                   [ 'h1', 'containy' ],
                   [ 'div', [ 'div', 'wunda' ] ],
                 ]
               ],
             ],  //body
           );

  is (document.body.instance, bodyInstance, 'body instance attached to body' );
  let internalEl = document.getElementById( 'guess' );
  let containyInstanceEl = document.getElementById( 'containy' );
  let containyInstance = containyInstanceEl.instance;
  is (containyInstance.name, 'instance of recipe containy in instance of recipe html', 'instance attached in the internals' );

  is (bodyInstance.get( 'intro' ), 'hi there', 'data in bodyInstance' );
  is (bodyInstance.el.adiv, internalEl, 'handle to internal el in bodyinstance' );

  ok ( ! ('adiv' in containyInstance.el), 'container doesnt have the handle to the internal thing' );
  
  ok ( containyInstance.get( 'intro' ), 'intro did copy from enclosing instance' );
  
}; //testInternals

const testAliasedRecipes = () => {
  reset();
  body(
    [
      node( 't2.foo',
            [
              el( 'span', 'Hello There' ),
              el( 'span', 'Ima thing' ),
            ] ), 
      node( 'zoo',
            { data: { defdata: 13 }},
            [
              el ('div', 'INSTANCY' ),
            ] ),
      node ('boo',
            [ el( 'button', { textContent: 'refresh', on_click: c => c.refresh() } ) ] ),
    ]
  );
    
  def_namespace( {
    
    namespaces: {
      t2: 'T2'
    },

    data: {
      defdata: 12,
    },
    
    components: {
      boo: {
        contents: [ el( 'div', 'boo' ) ],
      },
      zoo: {
        data: {bardata: 11}, 
        contents: [
          node( 't2.foo', [ el('span','this is ZOO') ] ),
        ]
      },
    },
  } );

  other_namespaces( {
    T2: {
      components: {
        foo: {
          data: { foodata: 'true' },
          contents: [ node( 'bar', { fill: true }, [
            el( 'span', { textContent: c => `[${c.get('coldata')}/${c.get('bardata')}/${c.get('foodata')}/${c.get('defdata')}]` } ),
            ] ) ],
        },
        bar: {
          data: { bardata: 'true' },
          contents: [ node( 'col', { class: 'additive now' },
                            [ el( 'section', 'BARBAR' ) ] ) ],
        },
        col: {
          data: { coldata: 'true' },
          contents: [ el( 'div', { class: 'col', 'data-thing': 'that' },
                          [ el( 'span', 'COLCOL' ) ] ) ],
        },
      }
    }
  } );

  go();

  confirmEl( 'test-aliased-recipes',
             'body',
             [
               [ 'div', { class: 'additive col now', 'data-thing': 'that' }, [
                 [ 'span', 'COLCOL' ],
                 [ 'section', 'BARBAR' ],
                 [ 'span', 'Hello There' ],
                 [ 'span', 'Ima thing' ],
                 [ 'span', '[true/true/true/12]' ],
               ] ],
               [ 'div', { class: 'col additive now', 'data-thing': 'that' }, [
                 [ 'span', 'COLCOL' ],
                 [ 'section', 'BARBAR' ],
                 [ 'span', '[true/11/true/13]' ],
                 [ 'div', 'INSTANCY' ],
                 [ 'span', 'this is ZOO' ],
               ] ],
               [ 'div', 'boo', [
                 'button', { textContent: 'refresh' }, 
               ] ],
             ] 
           );
}; //testAliasedRecipes



const testInstanceRefresh = () => {
  reset();
  body(
    [
      node( 'holder', 
            { 
              handle: 'refresher',
            },
          ),
    ]
  );
    
  def_namespace( {
    data: {
      seen: 0,
    },

    components: {
      holder: {
        contents: [
          el( 'div', { textContent : c => {c.set('seen',1+c.get('seen')); return `seen ${c.get('seen')}`;} } )
        ]
      },
    },
  } );

  const inst = go();

  confirmEl( 'test-instance-refresh',
             'body',
             [ 'div', 'seen 1' ]
           );

  inst.comp.refresher.refresh();

  confirmEl( 'test-instance-refresh',
             'body',
             [ 'div', 'seen 2' ]
           );

  
} //testInstancetRefresh

const testFills = () => {
  reset();
  body(
    [
      node( 'holder', 
            { 
              fill_contents: {
                left: [ 
                  el( 'span', 'left bar' ),
                ],
                right: [
                  el( 'span', 'right bar' ),
                ],
              }
            },
            [
              el( 'span', 'Hello There' ),
              el( 'span', 'Ima thing' ),
            ] ),
    ]
  );
    
  def_namespace( {
    data: {
      showLeft: true,
      showRight: true,
    },

    functions: {
      toggleLeft: c => c.set('showLeft', !c.get('showLeft') ),
      toggleRight: c => c.set('showRight', !c.get('showRight') ),
    },

    components: {
      holder: {
        contents: [
          el( 'main', { style: 'display:flex; flex-direction: row' },
              [
                el( 'div', { fill: 'left', if: c => c.get('showLeft') } ),
                el( 'section', { fill: true } ),
                el( 'div', { fill: 'right', if: c => c.get('showRight') } ),
              ] )
        ]
      },
    },
  } );

  const inst = go();

  confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', [ 'span', 'right bar' ] ],
               ]
             ],
           );

  inst.fun.toggleLeft();
  inst.refresh();
  
  confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', { style: { display: 'none' } }, [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', [ 'span', 'right bar' ] ],
               ]
             ],
           );

  inst.fun.toggleRight();
  inst.refresh();
  
  confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', { style: { display: 'none' } }, [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', { style: { display: 'none' } }, [ 'span', 'right bar' ] ],
               ]
             ],
           );

  inst.fun.toggleRight();
  inst.refresh();
  
  confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', { style: { display: 'none' } }, [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', [ 'span', 'right bar' ] ],
               ]
             ],
           );

  inst.fun.toggleLeft();
  inst.refresh();
  
  confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', [ 'span', 'right bar' ] ],
               ]
             ],
           );


}; //testFills


const testFillEvents = () => {
  reset();
  body(
    [
      node( 'holder', 
            { 
              fill_contents: {
                left: [ 
                  el( 'span', 'left bar' ),
                ],
                right: [
                  el( 'span', 'right bar' ),
                ],
              },
              on_innerLoad: (c,key,ev) => {
                  c.fun.log( "INNER LOAD" );
                  return false;
              },
              on_bubbleCaught: (c,key,ev) => {
                c.fun.log( "BUBBLE UP" );
                return true;
              },
            },
            [
              el( 'span', 'Hello There' ),
              el( 'span', 'Ima thing' ),
              node( 'inner', {
                class: 'A',
                on_innerLoad: (c,key,ev) => {
                  c.fun.log( "INNER LOAD" );
                  return false;
                },
                on_bubbleCaught: (c,key,ev) => {
                  c.fun.log( "BUBBLE UP" );
                  return true;
                },
              } )
            ] ),

      node( 'inner', {
        class: 'B',
        on_innerLoad: (c,key,ev) => {
          c.fun.log( "INNER LOAD" );
        },
        on_bubbleCaught: (c,key,ev) => {
          c.fun.log( "BUBBLE UP" );
          return true;
        },
      }),

    ]
  );
    
  def_namespace( {
    data: {
      showLeft: true,
      showRight: true,
      logs: [],
    },

    functions: {
      toggleLeft: c => c.set('showLeft', !c.get('showLeft') ),
      toggleRight: c => c.set('showRight', !c.get('showRight') ),
      log: (c,msg) => {
        c.get('logs').push( msg + `  (for ${c.name})` );
      },
    },

    components: {
      inner: {
        contents: [ el( 'span', 'INNY' ) ],
        onLoad: c => { c.fun.log( "START ONLOAD" ); c.event( 'innerLoad', 'Loaded' ); c.event( 'bubbleCaught', 'bubbling' ); },
      },

      holder: {
        contents: [
          el( 'main', { style: 'display:flex; flex-direction: row' },
              [
                el( 'div', { fill: 'left', if: c => c.get('showLeft') } ),
                el( 'section', { fill: true } ),
                el( 'div', { fill: 'right', if: c => c.get('showRight') } ),
              ] )
        ]
      },
    },
  } );

  const inst = go();

  console.log( inst.id, inst.get( 'logs' ), "LOGS" );

  0&&confirmEl( 'test-fill',
             'body',
             [ 'main', { style: { display: 'flex', 'flex-direction': 'row' } },
               [
                 [ 'div', [ 'span', 'left bar' ] ],
                 [ 'section', [ ['span', 'Hello There' ], ['span','Ima thing'] ]],
                 [ 'div', [ 'span', 'right bar' ] ],
               ]
             ],
           );



}; //testFillEvents

describe('spiderpup', () => {
  [ testAliasedRecipes,
    testBasic,
    testHandles,
    testIfLoop,
    testIfs,
    testInstanceRefresh,
    testInternals,
    testLoop,
    testMoreLoop,
    testNamespace,
    testFills,
    testFillEvents ].
    forEach( tst => {
      it(tst.name, tst )
    } )
} );

