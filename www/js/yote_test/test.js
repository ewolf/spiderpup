
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

   todo

     test handles for components
     test handles for elements

     test component handlers
     test element handlers

     test broadcast


     foreach with if/elseif/else elements
     foreach with if/elseif/else components
     foreach'd component with internal content
     foreach elements in foreach elements
     foreach components in foreach elements
     foreach components in foreach components in foreach components

     nodes with internal content that has foreach

     test components in elements in loops

     update list size, refresh and get correct number of items


     test handles for elements in loops
     test handles for components in loops

     test css styles
     test less styles
     test javascript in seperate modules


     add more todo

*/

window.misc = 0;
let def, funs;

function reset() {
  // empty and clear attributes
  document.body.innerHTML = '';
  funs = [];
  def = { TEST: { components: {}, 
                  html: { body: {contents: [] } } } };
  
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

function ok( bool, msg ) {
  if (bool) {
    pass( msg );
  } else {
    fail( msg );
  }
}

function like( actual, regex, msg ) {
  if (actual.match( regex )) {
    pass( msg );
    return true;
  } else {
    fail( `${msg}'. expected '${regex}' and got '${actual}` );
  }
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
  console.log( `passed: test '${msg}'` );
}
function fail (msg) {
  ran++;
  fails++;
  console.log( `FAILED: test '${msg}'` );
}
function doneTesting() {
  if (ran === passes) {
    console.log( `PASSED ALL ${ran} TESTS` );
  } else {
    console.log( `FAILED ${fails} of ${ran} TESTS, passed ${passes}` );
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

  const teststr = `in test ${testname} at path ) ${pathstr}`;

  is (el.tagName.toLowerCase(), tag.toLowerCase(), `tag ${teststr}`);

  // check the element attributes
  Object.keys( attrs ).forEach( attr => {
    const val = attrs[attr];
    if (typeof val === 'object' && val !== null) {
      const fld = Object.keys( val )[0];
      const eVal = attrs[attr][fld];
      const aVal = el[attr][fld];
      if (! is (aVal, eVal, `expected property '${attr}.${fld}' to be '${eVal}' and got '${aVal}'  ${teststr}`)) {
        debugger;
      }
    }
    else if (attr === 'textContent') {
      const textNode = el.childNodes[0] && el.childNodes[0].textContent;
      if ( ! is (textNode, val, `expected text '${val}' and got '${textNode}' ${teststr}`) ) {
        debugger;
      }
    } else {
      if (! is(el.getAttribute( attr ), val, `expected for attribute ${attr} : '${val}' and got '${el.getAttribute(attr)}' ${teststr}` ) ) {
        debugger;
      }
    }
  } );

  // check the contents

  // allow [ 'tag' .. ] so it doesnt have to be [ ['tag'...] ]
  if (contents.length > 0 && ! Array.isArray( contents[0] ) ) {
    contents = [contents];
  }

  if( ! is (el.childElementCount, contents.length, `content count ${teststr}` ) ) { debugger; }

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
        debugger;
        failmsg = `expected property '${attr}.${fld}' to be '${eVal}' and got '${aVal}'`;
      }
    }
    else if (attr === 'textContent') {
      const textNode = actualEl.childNodes[0] && actualEl.childNodes[0].textContent;
      passes = passes && textNode === val;
      if (!passes) {
        debugger;
        failmsg = `expected text '${val}' and got '${textNode}'`;
      }
    } else {
      passes = passes && actualEl.getAttribute( attr ) === val;
      if (!passes) {
        debugger;
        failmsg = `expected for attribute ${attr} : '${val}' and got '${actualEl.getAttribute(attr)}'`;
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
  const calculate = {};
  const on = {};
  // check for calculations. if the attr is a number
  const attrNames = Object.keys( attrs );

  const elNode = { tag, attrs, contents, calculate, on };

  attrNames.forEach( attr => {
    if (attr.match(/^(if|elseif|else|foreach|forval|data|handle|debug)$/)) {
      elNode[attr] = attrs[attr];
      delete attrs[attr];
    }
    const m = attr.match(/^on_(.*)/);
    if (m) {
      on[m[1]] = attrs[attr];
    }
    else if ( Number.isInteger( attrs[attr] ) ) {
      calculate[attr] = attrs[attr];
      delete attrs[attr];
    }
    else if (attr === 'internalContent' ) {
      elNode.internalContent = true;
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
    // else if(fld.match(/^(functions|data)$/)) {
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
    def.TEST[key] = args[key];
  } );
}
function other_namespaces( args ) {
  Object.keys( args ).forEach( key => {
    def[key] = args[key];
  } );
}
function def_funs( funcs ) {
  funs = funcs;
}

function go() {
  init( def, funs, 'TEST' );
}

function makeFilespace( bodyContents, args, otherFS ) {
  const fs = { ...(otherFS||{}) };
  fs.TEST = args || {};
  fs.TEST.html = { body: { contents: bodyContents } };
  fs.TEST.components = fs.TEST.components || {};
  
  def = fs;

  return fs;
} //makeFilespace

function run() {
  
}

// tests
//   general placement of els in document.
//   components
//   elements given to components
//   textContent from function
//   component function override
//   nodes with internal content and no specified spot
function testBasic() {
  reset();
  body( [ el( 'span', "FIRST" ), //0
          el( 'div', "SECOND", //1
              [
                node( 'foo' ), // div span
                node( 'foo', { functions: { bar: 1 } } ),
                node( 'foo', { functions: { bar: 3 } },
                      [ el( 'span', 'a span' ),
                        el( 'span', 'with stuff' ) ] ),
                node( 'foo', [ el( 'ul',
                                   [el( 'li', 'I am' ),
                                    el( 'li', { textContent: 5 } ),
                                    el( 'li', 'in' ) ] ) ] ),
              ])
        ]),
    def_namespace({
      components: {
        foo: {
          functions: {
            bar: 0
          },
          contents: [
            el ( 'div', '', [
              el ('span', { textContent: 2 } ),
            ] ),
          ],
        }, // foo component
        
      }, //components
      
      functions: {
        groan: 4,
      } //functions
      
    } );

  def_funs( [ c => "BAR",         // 0
              c => "BAR2",        // 1
              c => c.fun.bar(),   // 2
              c => "BAR3",        // 3
              c => "groan",       // 4
              c => c.fun.groan(), // 5
            ] );
  
  go();

  confirmEl( 'test-basic',
             'body',
              [
                [ 'span', 'FIRST' ], // 0
                [ 'div',             // 1
                  'SECOND',
                  [
                    [ 'div', [ 'span', 'BAR' ]],  // 1, 0
                    [ 'div', [ 'span', 'BAR2' ]], // 1, 1
                    [ 'div', [                    // 1, 2
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

} //testBasic

// tests
//   general placement of els in document.
//   components
//   elements given to components
//   textContent from function
//   component function override
//   nodes with internal content and no specified spot
function testIfs() {
  reset();
  body( 
    [
      node( 'iffy', { data : { number: 'i4' } }),
      node( 'iffy', { data : { number: 'i3' } }),
      node( 'iffy', { data : { number: 'i2' } }),
      node( 'iffy' ),
      el ('section', [ // if/elseif/elseif/elseif/else
        node( 'stuff', { if: 3 } ),
        node( 'stuff', { elseif: 4 } ),
        node( 'stuff', { elseif: 5 } ),
        node( 'stuff', { elseif: 6 } ),
        node( 'stuff', { else: true } ),
      ] ),
    ],
  );

  def_namespace( {
    data: { blat: 'i1', number: 'i50' },
    components: {
      iffy: {
        data: { number: 'i1' },
        contents: [
          el ('div', [
            el ('h1', { if: 0, textContent: 'is one' } ),
            el ('h2', { elseif: 1, textContent: 'is less than 3' } ),
            el ('h3', { elseif: 2, textContent: 'is four' } ),
            el ('h4', { else: true, textContent: 'whuddeveh' } ),
          ] )
        ],
      }, //iffy

      stuff: {
        contents: [ el( 'span', 'stuff' ) ],
      },
    }
  } );

  def_funs( [
    c => c.get('number') == 1, // 0
    c => c.get('number') < 3,  // 1
    c => c.get('number') == 4, // 2
    c => c.get('number') == 20, // 3
    c => c.get('number') == 51, // 4
    c => c.get('number') == 50, // 5
    c => c.get('number') == 12, // 6
  ] );

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

  // now check for fails for wrong if/then/else combos
  reset();

  try {
    body( 
      [
        el ('section', [ // if/elseif/elseif/elseif/else
          node( 'stuff', { else: true } ),
          node( 'stuff', { if: 3 } ),
          node( 'stuff', { elseif: 4 } ),
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
          node( 'stuff', { if: 3 } ),
          node( 'stuff', { elseif: 4 } ),
        ] ),
      ],
    );
    go();
    fail( 'started with else and did not error out' );
  } catch(e) {
    pass( 'errored out with incorrect else' );
    like ( e.message, /else and elseif must be preceeded by if or elseif/, 'error message for failed' );
  }


} //testIfs


//
// tests
//     including components from other namespaces
//     nodes with internal content and a specified spot
//
function testNamespace() {
  reset();
  body( [
    node( 'ON.containery' ),   // body| 0 div | header | main (int) | footer
    node( 'ON.containery', [   // 1
      el( 'div', 'in the middle' )
    ] ),
    node( 'ON.containery', //4
          [
            el( 'div', {
              if: 0,
              textContent: 'in a middle' } ),
            el( 'div', {
              else: true,
              textContent: 'nop nope' } ),
          ] ),
    node( 'ON.containery', //5
          { data: { blat: 'i2' } },
          [
            el( 'div', {
              if: 0,
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
      blat: 'i1',
    },
    functions: {
      groan: 4,
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
                el( 'main', { textContent: 'main', internalContent: true } ),
                el( 'footer', { textContent: 1 } ),
              ] ),
            ],
          },
        },
        functions: {
          foot: 2,
        },
      }, //OTHER (namespace)
    } );

  def_funs( [
    c => c.get('blat') == 1, // 0
    c => c.fun.foot(),       // 1
    c => "foot",             // 2
  ] );

  go();

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

} //testNamespace

function testComponentHandles() {
  reset();
  body( [
    el( 'table', 
        [ el( 'tr', { foreach: 0, forval: 'row' },
              [ el( 'td', { forval: 'col', 
                            foreach: 1,
                            textContent: 2,
                          } ) ] ) ] ),
    el( 'main',
        [ el( 'section', { foreach: 0, forval: 'i', textContent: 4 },
              [ el( 'div', { foreach: 1, forval: 'j', textContent: 5 },
                [ el( 'span', { foreach: 3, forval: 'k', textContent: 6 } ) ],
                  ) ] )] ),

    el ('section', [
      node( 'looper', { foreach: 0, forval: 'I', data: { number: 'c9' } } ),
    ] ),

    el ('section', [
      node( 'multilooper', { foreach: 10, forval: 'ML' }, 
            [
              el( 'span', { foreach: 1, forval: 'IS', textContent: 11 } ),
            ] ),
    ] ),

  ] ); //body

  def_namespace( {
    data: { blat: 'i1', number: 'i50' },

    components: {
      looper: {
        data: {
          mult: 'i3',
        },
        contents: [ 
          el ('div', { textContent: 8 } ),
        ],
      }, //looper component

      multilooper: {
        contents: [ 
          el ('div', [
            el ( 'span', 'upper' ),
            el ( 'div', { internalContent: true } ),
            el ( 'span', 'middle' ),
            node( 'looper', { foreach: 0, forval: 'I', data: { number: 'c9' } } ),
            el ( 'span', 'lower' ),
            el ( 'ul', [ el ( 'li', { textContent: 7, foreach: 1, forval: 'I' } ) ] ),
            el ( 'span', 'lowest' ),
          ] ),
        ],
      }, //multilooper component
    }
  } ); //def_namespace
  
  def_funs( [
    c => [ "A", "B", "C" ], //0
    c => [ "D", "E" ],      //1
    c => `[row ${c.idx.row}/${c.it.row}, col ${c.idx.col}/${c.it.col}]`, // 2
    c => [ 'F', 'G', 'H' ], //3
    c => `[i ${c.idx.i}/${c.it.i}]`, //4
    c => `[j ${c.idx.j}/${c.it.j}]`, //5
    c => `[k ${c.idx.k}/${c.it.k}] / [j ${c.idx.j}/${c.it.j}] / [i ${c.idx.i}/${c.it.i}]`, //6
    c => `(${c.it.I}/${c.idx.I})`, //7
    c => `NUM <${c.get("number")}>`, //8
    c => c.get('mult') * c.idx.I, //9
    c => [ 'Z' ],                 //10
    c => c.it.IS,                 //11
  ] );

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

} //testComponentHandles() {

function testLoop() {
  reset();
  body( [
    el( 'table', 
        [ el( 'tr', { foreach: 0, forval: 'row' },
              [ el( 'td', { forval: 'col', 
                            foreach: 1,
                            textContent: 2,
                          } ) ] ) ] ),
    el( 'main',
        [ el( 'section', { foreach: 0, forval: 'i', textContent: 4 },
              [ el( 'div', { foreach: 1, forval: 'j', textContent: 5 },
                [ el( 'span', { foreach: 3, forval: 'k', textContent: 6 } ) ],
                  ) ] )] ),

    el ('section', [
      node( 'looper', { foreach: 0, forval: 'I', data: { number: 'c9' } } ),
    ] ),

    el ('section', [
      node( 'multilooper', { foreach: 10, forval: 'ML' }, 
            [ // loop with component with internal loop
              el( 'span', { foreach: 1, forval: 'IS', textContent: 11 } ),
            ] ),
    ] ),

  ] ); //body

  def_namespace( {
    data: { blat: 'i1', number: 'i50' },

    components: {
      looper: {
        data: {
          mult: 'i3',
        },
        contents: [ 
          el ('div', { textContent: 8 } ),
        ],
      }, //looper component

      multilooper: {
        contents: [ 
          el ('div', [
            el ( 'span', 'upper' ),
            el ( 'div', { internalContent: true } ),
            el ( 'span', 'middle' ),
            node( 'looper', { foreach: 0, forval: 'I', data: { number: 'c9' } } ),
            el ( 'span', 'lower' ),
            el ( 'ul', [ el ( 'li', { textContent: 7, foreach: 1, forval: 'I' } ) ] ),
            el ( 'span', 'lowest' ),
          ] ),
        ],
      }, //multilooper component
    }
  } ); //def_namespace
  
  def_funs( [
    c => [ "A", "B", "C" ], //0
    c => [ "D", "E" ],      //1
    c => `[row ${c.idx.row}/${c.it.row}, col ${c.idx.col}/${c.it.col}]`, // 2
    c => [ 'F', 'G', 'H' ], //3
    c => `[i ${c.idx.i}/${c.it.i}]`, //4
    c => `[j ${c.idx.j}/${c.it.j}]`, //5
    c => `[k ${c.idx.k}/${c.it.k}] / [j ${c.idx.j}/${c.it.j}] / [i ${c.idx.i}/${c.it.i}]`, //6
    c => `(${c.it.I}/${c.idx.I})`, //7
    c => `NUM <${c.get("number")}>`, //8
    c => c.get('mult') * c.idx.I, //9
    c => [ 'Z' ],                 //10
    c => c.it.IS,                 //11
  ] );

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
             
} //testLoop

//testIfs();
//testBasic();
//testNamespace();
testLoop();

doneTesting();
