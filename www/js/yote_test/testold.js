
// so we want to grab some json and compile it and stuff as a namespace, then attach it to the body
function testUpdate() {
  reset();
  const def =
        {
          TEST: {
            namespaces: {
              ON: 'OTHERNAME',
            },
            data: {
              blat: 'i1',
            },
            html: {
              body: {
                contents: [ el( 'span', "FIRST" ), //0
                            el( 'div', "SECOND", //1
                                [
                                  node( 'foo' ),
                                  node( 'foo', { functions: { bar: 1 } } ),
                                  node( 'foo', { functions: { bar: 3 } },
                                        [ el( 'span', 'a span' ),
                                          el( 'span', 'with stuff' ) ] ),
                                  node( 'foo', [ el( 'ul',
                                                     [el( 'li', 'I am' ),
                                                      el( 'li', { textContent: 5 } ),
                                                      el( 'li', 'in' ) ] ) ] ),
                                ] ),
                            node( 'ON.containery' ), //2
                            node( 'ON.containery', [   //3
                              el( 'div', 'in the middle' )
                            ] ),
                            node( 'ON.containery', //4
                                  [
                                    el( 'div', {
                                      if: 10,
                                      textContent: 'in a middle' } ),
                                    el( 'div', {
                                      else: true,
                                      textContent: 'nop nope' } ),
                                  ] ),
                            node( 'ON.containery', //5
                                  { data: { blat: 'i2' } },
                                  [
                                    el( 'div', {
                                      if: 10,
                                      textContent: 'in o middle' } ),
                                    el( 'div', {
                                      else: true,
                                      textContent: 'nope nope im the else' } ),
                                  ]
                                ),
                            el( 'div', [ //6
                              node( 'iffy', { data : { number: 'i3' } }),
                              node( 'iffy', { data : { number: 'i2' } }),
                              node( 'iffy' ),
                            ] ),

                            el( 'div', [ //7
                              node( 'foo',
                                    { data: { echo: 'nothing to say' } },
                                    [
                                      node( 'echo', { if: 13,     class: 'fail' } ),
                                      node( 'echo', { elseif: 12, class: 'default' } ),
                                      node( 'echo', { else: true, class: 'never' } ),
                                    ] ),

                              el ('div', [
                                node( 'echo', { if: 13,     class: 'fail' } ),
                                node( 'echo', { elseif: 12, class: 'default' } ),
                                node( 'echo', { else: true, class: 'never' } ),
                              ] ),

                            ] ),

                          ] }, //body
            }, //html


            components: {

              foo: {
                functions: {
                  bar: 0
                },
                contents: [
                  el ( 'div', '', [
                    el ('span', { textContent: 2 } ), // 2 references a function in the function list
                  ] ),
                ],
              }, // foo component

              echo: {
                contents: [ el( 'span', { textContent: 11} ) ],
              },


              iffy: {
                data: { number: 'i1' },
                contents: [
                  el ('div', [
                    el ('h1', { if: 8, textContent: 'is one' } ),
                    el ('h2', { elseif: 9, textContent: 'is two' } ),
                    el ('h3', { else: true, textContent: 'whuddeveh' } ),
                  ] )
                ],
              }, //  iffy component


              clicky: {
                data : { txt: 'sclickme' },
                contents: [
                  el( 'button', {
                    textContent: 30,
                    on_click: 28,
                  } )
                ],
              }, //clicky component

            }, //components

            functions: {
              groan: 4,
            } //functions

          }, //TEST (default)



          OTHERNAME: {
            components: {
              containery: {
                contents: [
                  el( 'div', [
                    el( 'header', 'head' ),
                    el( 'main', { textContent: 'main', internalContent: true } ),
                    el( 'footer', { textContent: 7 } ),
                  ] ),
                ],
              },
            },
            functions: {
              foot: 6,
            },
          }, //OTHER (namespace)

        }; // filespaces

  init( def,

        [ c => "BAR",         // 0
          c => "BAR2",        // 1
          c => c.fun.bar(),   // 2
          c => "BAR3",        // 3
          c => "groan",       // 4
          c => c.fun.groan(), // 5
          c => "foot",        // 6
          c => c.fun.foot(),  // 7
          c => c.get('number') == 1, // 8
          c => c.get('number') < 3,  // 9
          c => c.get('blat') == 1,   // 10
          c => c.get('echo'),  // 11
          c => c.get('echo') === 'nothing to say',  // 12
          c => false,          // 13
        ], // functions list

        'TEST' // default filespace (the one with the body)
      );

  checkNode( "body|0 span", { textContent: 'FIRST' }, 'first div text' );

  checkNode( "body|1 div", { textContent: 'SECOND' }, 'second div text' );
  checkNode( "body|1 div|0 div|0 span", { textContent: 'BAR' }, 'first bar' );
  checkNode( "body|1 div|1 div|0 span", { textContent: 'BAR2' }, 'bar override' );

  checkNode( "body|1 div|2 div|0 span", { textContent: 'BAR3' }, 'third bar' );
  checkNode( "body|1 div|2 div|1 span", { textContent: 'a span' }, 'third bar with listed contents 1' );
  checkNode( "body|1 div|2 div|2 span", { textContent: 'with stuff' }, 'third bar with listed contents 1' );

  checkNode( "body|1 div|3 div|0 span", { textContent: 'BAR' }, 'fourth bar' );
  checkNode( "body|1 div|3 div|1 ul|0 li", { textContent: 'I am' }, 'fourth bar with more content 1' );
  checkNode( "body|1 div|3 div|1 ul|1 li", { textContent: 'groan' }, 'fourth bar with more content 2' );
  checkNode( "body|1 div|3 div|1 ul|2 li", { textContent: 'in' }, 'fourth bar with more content 3' );

  checkNode( "body|2 div|0 header", { textContent: 'head' }, 'containery 1 head' );
  checkNode( "body|2 div|1 main", { textContent: 'main' }, 'containery 1 main' );
  checkNode( "body|2 div|2 footer", { textContent: 'foot' }, 'containery 1 footer' );

  checkNode( "body|3 div|0 header", { textContent: 'head' }, 'containery 2 head' );
  checkNode( "body|3 div|1 main", { textContent: 'main' }, 'containery 2 main' );
  checkNode( "body|3 div|1 main|0 div", { textContent: 'in the middle' }, 'containery 2 added content' );
  checkNode( "body|3 div|2 footer", { textContent: 'foot' }, 'containery 2 footer' );

  checkNode( "body|6 div|0 div|0 h1", { style: {display: 'none'}, textContent: undefined }, 'else test (hidden 1)' );
  checkNode( "body|6 div|0 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'else test (hidden 2)' );
  checkNode( "body|6 div|0 div|2 h3", { style: {display: ''}, textContent: 'whuddeveh' }, 'else test (not hidden)' );

  checkNode( "body|6 div|1 div|0 h1", { style: {display: 'none'}, textContent: undefined }, 'elseif test (hidden 1)' );
  checkNode( "body|6 div|1 div|1 h2", { style: {display: ''}, textContent: 'is two' }, 'elseif test (not hidden)' );
  checkNode( "body|6 div|1 div|2 h3", { style: {display: 'none'}, textContent: undefined }, 'elseif test (hidden 3)' );

  checkNode( "body|6 div|2 div|0 h1", { style: {display: ''}, textContent: 'is one' }, 'if test (not hidden)' );
  checkNode( "body|6 div|2 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'if test (hidden 3)' );
  checkNode( "body|6 div|2 div|2 h3", { style: {display: 'none'}, textContent: undefined }, 'if test (hidden 3)' );

  // check instance data
  let elseInst = elPath( "body|6 div|0 div" ).instance;
  is (elseInst.get('number'), 3, 'else instance correct data');

  let elseifInst = elPath( "body|6 div|1 div" ).instance;
  is (elseifInst.get('number'), 2, 'elseif instance correct data');

  let ifInst = elPath( "body|6 div|2 div" ).instance;
  is (ifInst.get('number'), 1, 'if instance correct data');

  // update the number and see what changes
  elseInst.set('number', 1);
  elseInst.refresh();
  checkNode( "body|6 div|0 div|0 h1", { style: {display: ''}, textContent: 'is one' }, 'else to if test (not hidden)' );
  checkNode( "body|6 div|0 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'else to if test (hidden 3)' );
  checkNode( "body|6 div|0 div|2 h3", { style: {display: 'none'}, textContent: 'whuddeveh' }, 'else to if test (hidden 3 but still has old text content)' );

  elseInst.set('number', 2);
  elseInst.refresh();
  checkNode( "body|6 div|0 div|0 h1", { style: {display: 'none'}, textContent: 'is one' }, 'else to if test (hidden, still has old text content)' );
  checkNode( "body|6 div|0 div|1 h2", { style: {display: ''}, textContent: 'is two' }, 'else to if test (hidden 3)' );
  checkNode( "body|6 div|0 div|2 h3", { style: {display: 'none'}, textContent: 'whuddeveh' }, 'else to if test (hidden 3 but still has old text content)' );

  checkNode( "body|4 div|1 main|0 div", { style: {display: ''}, textContent: 'in a middle' }, 'containery 3 added content if yes part' );
  checkNode( "body|4 div|1 main|1 div", { style: {display: 'none'}, textContent: undefined }, 'containery 3 added content if no part' );

  checkNode( "body|5 div|1 main|0 div",
             { style: {display: 'none'}, textContent: undefined },
             'containery 4 added content if no part' );
  checkNode( "body|5 div|1 main|1 div",
             { style: {display: ''}, textContent: 'nope nope im the else' },
             'containery 4 added content if yes part' );

  checkNode( "body|5 div|1 main|1 div",
             { style: {display: ''}, textContent: 'nope nope im the else' },
             'containery 4 added content if yes part' );

  checkNode( "body|7 div|0 div|1 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' foo echo first not showing, so no class for it either' );

  checkNode( "body|7 div|0 div|2 span",
             { style: {display: ''}, class: 'default', textContent: 'nothing to say' },
             ' foo echo second showing' );
  checkNode( "body|7 div|0 div|3 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' foo echo third not showing, class not yet set' );


  checkNode( "body|7 div|1 div|0 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' in body echo first not showing, so no class for it either' );
  checkNode( "body|7 div|1 div|1 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' in body echo second showing, class was removed because it is hidden' );
  checkNode( "body|7 div|1 div|2 span",
             { style: {display: ''}, class: 'never', textContent: undefined },
             ' in body echo third now showing and class is set, but no textContent to show since echo not set in that instance' );

  // update

  let elp = elPath( "body|7 div|0 div" );
  let instance = elp.instance;

  instance.set("echo","NUBU");
  instance.refresh();

  checkNode( "body|7 div|0 div|1 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' foo echo first not showing, so no class for it either' );
  checkNode( "body|7 div|0 div|2 span",
             { style: {display: 'none'}, class: null, textContent: undefined },
             ' foo echo second showing, class was removed because it is hidden' );
  checkNode( "body|7 div|0 div|3 span",
             { style: {display: ''}, class: 'never', textContent: 'NUBU' },
             ' foo echo third now showing and class is set' );
} //testUpdate


function testLoops() {
  reset();
  const def = makeFilespace(
    [
      el( 'div', [ //0
        el( 'span', { foreach: 1, forval: 'numb', textContent: 2 } )
      ] ),

      el( 'div', [ //1
        node( 'echo', { foreach: 3, forval: 'numb', data:{ echo: 'c2'} } )
      ] ),

      el( 'div', [ //2
        node( 'echo', { foreach: 3,
                        forval: 'numb',
                        if: 4,
                        data:{ echo: 'c2'} } ),
      ] ),
      el( 'div', [ //3
        el( 'span', { foreach: 3,
                      forval: 'numb',
                      if: 5,
                      textContent: 2 } ),
      ] ),
      el( 'hr' ),  //4
      el( 'div', [ // 5 foreach with internal content
        node( 'echo', { foreach: 3,
                        forval: 'numb',
                        data: { echo: 'c2' },
                      }, [
                        el( 'span', { textContent: 6 } ),
                      ] ),
      ] ),
      el( 'div', [ //6 foreach els in foreach els
        el( 'div', { foreach: 3,
                     forval: 'numb',
                   }, [
                     el( 'span', { textContent: 7 } ),
                     el( 'span', {
                       forval: 'innie',
                       foreach: 9,
                       textContent: 8,
                     } ),
                   ] ),
      ] ),

      // foreach compos in foreach els
      el( 'div', [ //7 foreach els in foreach els
        el( 'div', { foreach: 3,
                     forval: 'numb',
                   }, [
                     el( 'span', { textContent: 7 } ),
                     node( 'echo', {
                       forval: 'innie',
                       foreach: 9,
                       data: { echo: 'c8' },
                     } ),
                   ] ),
      ] )
    ],
    {
      components: {

        echo: {
          contents: [ el( 'span', { textContent: 0} ) ],
        },
        
        clicky: {
          data : { txt: 'sclickme' },
          contents: [
            el( 'button', {
              textContent: 11,
              on_click: 10,
            } )
          ],
        }, //clicky component
        
      }, //components
      
      functions: {
        groan: 4,
      } //functions
    } );

  init( def,
        [
          c => c.get('echo'),  // 0
          c => [1,2,3,4],      // 1
          c => c.idx.numb + ") " + c.it.numb, //2
          c => [2,4,6,8,10],   // 3
          c => c.idx.numb == 0 || c.idx.numb == 3,   // 4
          c => true,           // 5
          c => '(' + c.idx.numb + ',' + c.it.numb + ')', //6
          c => 'start ' + c.idx.numb, // 7
          c => `innie(${c.idx.innie}/${c.it.innie}) outie(${c.idx.numb}/${c.it.numb})`, //8
          c => [1,2,4],      // 9
          c => c.event( 'gotclick' ), // 10
          c => c.get('txt'), // 11
        ], // functions list

        'TEST' // default filespace (the one with the body)
      );

  // foreach tests

  let loopdiv = 0;

  // elements in loop
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '0) 1' }, 'first foreach span' );

  checkNode( `body|${loopdiv} div|1 span`,
             { textContent: '1) 2' }, 'second foreach span' );
  checkNode( `body|${loopdiv} div|2 span`,
             { textContent: '2) 3' }, 'third foreach span' );
  checkNode( `body|${loopdiv} div|3 span`,
             { textContent: '3) 4' }, 'fourth foreach span' );
  let elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 4, 'for in span foreach' );

  loopdiv = 1;
  // components in loop
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '0) 2' }, 'first foreach component' );
  checkNode( `body|${loopdiv} div|1 span`,
             { textContent: '1) 4' }, 'second foreach component' );
  checkNode( `body|${loopdiv} div|2 span`,
             { textContent: '2) 6' }, 'third foreach component' );
  checkNode( `body|${loopdiv} div|3 span`,
             { textContent: '3) 8' }, 'fourth foreach component' );
  checkNode( `body|${loopdiv} div|4 span`,
             { textContent: '4) 10' }, 'fifth foreach component' );
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, 'for in component foreach' );


  loopdiv = 2;
  // if and loop with components
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: undefined, style: {display:'none'} }, 'first foreach if component hidden' );
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 1, 'for in if component foreach' );

  loopdiv = 3;
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '0) 2', style: {display:''} }, 'second foreach if component, not hidden, 0' );
  checkNode( `body|${loopdiv} div|1 span`,
             { textContent: '1) 4', style: {display:''} }, 'second foreach if component, not hidden, 1' );
  checkNode( `body|${loopdiv} div|2 span`,
             { textContent: '2) 6', style: {display:''} }, 'second foreach if component, not hidden, 2' );
  checkNode( `body|${loopdiv} div|3 span`,
             { textContent: '3) 8', style: {display:''} }, 'second foreach if component, not hidden, 3' );
  checkNode( `body|${loopdiv} div|4 span`,
             { textContent: '4) 10', style: {display:''} }, 'second foreach if component, not hidden, 4' );

  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, 'for in if component foreach' );

  loopdiv = 5;
  // loop with content and inner stuff
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '0) 2', style: {display:''} }, 'foreach text with internal content 0' );
  checkNode( `body|${loopdiv} div|0 span|0 span`,
             { textContent: '(0,2)', style: {display:''} }, 'foreach with correct internal content 0' );
  checkNode( `body|${loopdiv} div|3 span`,
             { textContent: '3) 8', style: {display:''} }, 'foreach text with internal content 3' );
  checkNode( `body|${loopdiv} div|3 span|0 span`,
             { textContent: '(3,8)', style: {display:''} }, 'foreach with correct internal content 3' );
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, 'for in loop with content' );

  loopdiv = 6;
  // loop elements in looped elements
  checkNode( `body|${loopdiv} div|0 div|0 span`,
             { textContent: 'start 0', style: {display:''} }, 'el loop in el loop 0' );
  checkNode( `body|${loopdiv} div|0 div|1 span`,
             { textContent: 'innie(0/1) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/0' );
  checkNode( `body|${loopdiv} div|0 div|2 span`,
             { textContent: 'innie(1/2) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/1' );
  checkNode( `body|${loopdiv} div|0 div|3 span`,
             { textContent: 'innie(2/4) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/2' );

  checkNode( `body|${loopdiv} div|1 div|0 span`,
             { textContent: 'start 1', style: {display:''} }, 'el loop in el loop 1' );
  checkNode( `body|${loopdiv} div|1 div|1 span`,
             { textContent: 'innie(0/1) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/0' );
  checkNode( `body|${loopdiv} div|1 div|2 span`,
             { textContent: 'innie(1/2) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/2' );
  checkNode( `body|${loopdiv} div|1 div|3 span`,
             { textContent: 'innie(2/4) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/3' );

  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, '8 outies in el loop in el loop' );
  elp = elPath( `body|${loopdiv} div|0 div` );
  is (elp.childElementCount, 4, '1 title + 3 innies in in el loop in el loop' );


  loopdiv = 7;
  // loop components in looped elements
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, '8 outies in compo loop in el loop' );
  elp = elPath( `body|${loopdiv} div|0 div` );
  is (elp.childElementCount, 4, '1 title + 3 innies in in compo loop in el loop' );

  checkNode( `body|${loopdiv} div|0 div|0 span`,
             { textContent: 'start 0', style: {display:''} }, 'compo loop in el loop 0' );

  checkNode( `body|${loopdiv} div|0 div|1 span`,
             { textContent: 'innie(0/1) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/0' );
  checkNode( `body|${loopdiv} div|0 div|2 span`,
             { textContent: 'innie(1/2) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/1' );
  checkNode( `body|${loopdiv} div|0 div|3 span`,
             { textContent: 'innie(2/4) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/2' );



  loopdiv = 8;
  // loop components in looped els
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 5, '8 outies in compo loop in compo loop in compo loop outermost' );
  elp = elPath( `body|${loopdiv} div|1 span` );
  is (elp.childElementCount, 4, '1 title + 3 innies in in compo loop in compo loop middle' );
  elp = elPath( `body|${loopdiv} div|1 span|1 span` );
  is (elp.childElementCount, 4, '3 innies + 1 middle marker in in compo loop in compo loop in compo loop innermost' );

  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '[outermost 0]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 0/outer' );
  checkNode( `body|${loopdiv} div|0 span|0 span`,
             { textContent: 'compo start 0', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 0/top-title' );

  elp = elPath(`body|${loopdiv} div|0 span` );

  checkNode( `body|${loopdiv} div|0 span|1 span`,
             { textContent: '[middle 0,0]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 0/0 middle comp' );
  checkNode( `body|${loopdiv} div|0 span|2 span`,
             { textContent: '[middle 0,1]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 0/1 middle comp' );
  checkNode( `body|${loopdiv} div|0 span|3 span`,
             { textContent: '[middle 0,2]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 0/1 middle comp' );

  checkNode( `body|${loopdiv} div|1 span|2 span`,
             { textContent: '[middle 1,1]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 1/1 middle comp' );
  checkNode( `body|${loopdiv} div|1 span|2 span|0 span`,
             { textContent: '[innermost 1,1,0 (4 / 2 / 1)]', style: {display:''} },
             'loopy compo in loopy compo in el in loop compo 1/1/0 middle comp' );

  elp = elPath( `body|9 section|0 button` );
  is (window.misc,0,'misc starts out 0');
  elp.click();
  is (window.misc,1,'misc now 1');

  elp = elPath( `body|9 section|1 span|0 button` );
  let inst = elp.instance.parent;
  ok (inst.el.clickholder, 'got the element handle' );

  is (inst.el.clickholder, elPath( 'body|9 section|1 span' ), 'element handle points to element' );
  ok (inst.comp.clicker, 'got the component handle' );
  is (inst.comp.clicker, elp.instance, 'correct component handle' );

  ok (inst.el.forclickholder, 'got a element handle in' );
  is (inst.el.forclickholder.length, 3, ' handle' );

  elp = elPath( `body|9 section|2 div|0 span` );

  loopdiv = 9;
  elp = elPath( `body|${loopdiv} div` );
  is (elp.childElementCount, 3, '3 innies els in els' );

  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: 'txt : 0', style: {display:''} }, 'el in el loop 0' );
  checkNode( `body|${loopdiv} div|0 span|0 h2`,
             { textContent: 'txt : 0', style: {display:''} }, 'inner el in el loop 0' );

  checkNode( `body|${loopdiv} div|1 span`,
             { textContent: 'txt : 1', style: {display:''} }, 'el in el loop 0' );
  checkNode( `body|${loopdiv} div|1 span|0 h2`,
             { textContent: 'txt : 1', style: {display:''} }, 'inner el in el loop 0' );

  checkNode( `body|${loopdiv} div|2 span`,
             { textContent: 'txt : 2', style: {display:''} }, 'el in el loop 0' );
  checkNode( `body|${loopdiv} div|2 span|0 h2`,
             { textContent: 'txt : 2', style: {display:''} }, 'inner el in el loop 0' );

  doneTesting();

} //testLoops


function testLoop() {
  reset();
  const def =
        {
          TEST: {
            html: {
              body: {
                contents: [
                  el( 'div', [ //0
                    el( 'span', { foreach: 1, forval: 'numb', textContent: 2 } )
                  ] ),

                  el( 'div', [ //1
                    node( 'echo', { foreach: 3, forval: 'numb', data:{ echo: 'c2'} } )
                  ] ),

                ] }, //body
            }, //html

            components: {

              echo: {
                contents: [ el( 'span', { textContent: 0} ) ],
              },

              clicky: {
                data : { txt: 'sclickme' },
                contents: [
                  el( 'button', {
                    textContent: 11,
                    on_click: 10,
                  } )
                ],
              }, //clicky component

            }, //components

            functions: {
              groan: 4,
            } //functions

          }, //TEST (default)

        }; // filespaces

  init( def,
        [
          c => c.get('echo'),  // 0
          c => [1,2,3,4],      // 1
          c => c.idx.numb + ") " + c.it.numb, //2
          c => [2,4,6,8,10],   // 3
          c => c.idx.numb == 0 || c.idx.numb == 3,   // 4
          c => true,           // 5
          c => '(' + c.idx.numb + ',' + c.it.numb + ')', //6
          c => 'start ' + c.idx.numb, // 7
          c => `innie(${c.idx.innie}/${c.it.innie}) outie(${c.idx.numb}/${c.it.numb})`, //8
          c => [1,2,4],      // 9
          c => c.event( 'gotclick' ), // 10
          c => c.get('txt'), // 11
        ], // functions list

        'TEST' // default filespace (the one with the body)
      );

  // foreach tests

  let loopdiv = 0;

  let elp = elPath( `body|${loopdiv} div` );

  // elements in loop
  checkNode( `body|${loopdiv} div|0 span`,
             { textContent: '0) 1' }, 'first foreach span' );

  checkNode( `body|${loopdiv} div|1 span`,
             { textContent: '1) 2' }, 'second foreach span' );
  checkNode( `body|${loopdiv} div|2 span`,
             { textContent: '2) 3' }, 'third foreach span' );
  checkNode( `body|${loopdiv} div|3 span`,
             { textContent: '3) 4' }, 'fourth foreach span' );

  is (elp.childElementCount, 4, 'for in span foreach' );

} //testLoop

// // so we want to grab some json and compile it and stuff as a namespace, then attach it to the body
// function test() {
//   reset();
//   const def =
//         {
//           TEST: {
//             namespaces: {
//               ON: 'OTHERNAME',
//             },
//             data: {
//               blat: 'i1',
//             },
//             html: {
//               body: {
//                 contents: [ el( 'span', "FIRST" ), //0
//                             el( 'div', "SECOND", //1
//                                 [
//                                   node( 'foo' ),
//                                   node( 'foo', { functions: { bar: 1 } } ),
//                                   node( 'foo', { functions: { bar: 3 } },
//                                         [ el( 'span', 'a span' ),
//                                           el( 'span', 'with stuff' ) ] ),
//                                   node( 'foo', [ el( 'ul',
//                                                      [el( 'li', 'I am' ),
//                                                       el( 'li', { textContent: 5 } ),
//                                                       el( 'li', 'in' ) ] ) ] ),
//                                 ] ),
//                             node( 'ON.containery' ), //2
//                             node( 'ON.containery', [   //3
//                               el( 'div', 'in the middle' )
//                             ] ),
//                             node( 'ON.containery', //4
//                                   [
//                                     el( 'div', {
//                                       if: 10,
//                                       textContent: 'in a middle' } ),
//                                     el( 'div', {
//                                       else: true,
//                                       textContent: 'nop nope' } ),
//                                   ] ),
//                             node( 'ON.containery', //5
//                                   { data: { blat: 'i2' } },
//                                   [
//                                     el( 'div', {
//                                       if: 10,
//                                       textContent: 'in o middle' } ),
//                                     el( 'div', {
//                                       else: true,
//                                       textContent: 'nope nope im the else' } ),
//                                   ]
//                                 ),
//                             el( 'div', [ //6
//                               node( 'iffy', { data : { number: 'i3' } }),
//                               node( 'iffy', { data : { number: 'i2' } }),
//                               node( 'iffy' ),
//                             ] ),

//                             el( 'div', [ //7
//                               node( 'foo',
//                                     { data: { echo: 'nothing to say' } },
//                                     [
//                                       node( 'echo', { if: 13,     class: 'fail' } ),
//                                       node( 'echo', { elseif: 12, class: 'default' } ),
//                                       node( 'echo', { else: true, class: 'never' } ),
//                                     ] ),

//                               el ('div', [
//                                 node( 'echo', { if: 13,     class: 'fail' } ),
//                                 node( 'echo', { elseif: 12, class: 'default' } ),
//                                 node( 'echo', { else: true, class: 'never' } ),
//                               ] ),

//                             ] ),

//                             el( 'section', [ //8 foreach land
//                               el( 'div', [ //0
//                                 el( 'span', { foreach: 14, forval: 'numb', textContent: 15 } )
//                               ] ),

//                               el( 'div', [ //1
//                                 node( 'echo', { foreach: 16, forval: 'numb', data:{ echo: 'c15'} } )
//                               ] ),

//                               el( 'div', [ //2
//                                 node( 'echo', { foreach: 16,
//                                                 forval: 'numb',
//                                                 if: 17,
//                                                 data:{ echo: 'c15'} } ),
//                               ] ),
//                               el( 'div', [ //3
//                                 el( 'span', { foreach: 16,
//                                               forval: 'numb',
//                                               if: 18,
//                                               textContent: 15 } ),
//                               ] ),
//                               el( 'hr' ),  //4
//                               el( 'div', [ // 5 foreach with internal content
//                                 node( 'echo', { foreach: 16,
//                                                 forval: 'numb',
//                                                 data: { echo: 'c15' },
//                                               }, [
//                                                 el( 'span', { textContent: 19 } ),
//                                               ] ),
//                               ] ),
//                               el( 'div', [ //6 foreach els in foreach els
//                                 el( 'div', { foreach: 16,
//                                              forval: 'numb',
//                                            }, [
//                                              el( 'span', { textContent: 20 } ),
//                                              el( 'span', {
//                                                forval: 'innie',
//                                                foreach: 22,
//                                                textContent: 21,
//                                              } ),
//                                            ] ),
//                               ] ),

//                               // foreach compos in foreach els
//                               el( 'div', [ //7 foreach els in foreach els
//                                 el( 'div', { foreach: 16,
//                                              forval: 'numb',
//                                            }, [
//                                              el( 'span', { textContent: 20 } ),
//                                              node( 'echo', {
//                                                forval: 'innie',
//                                                foreach: 22,
//                                                data: { echo: 'c21' },
//                                              } ),
//                                            ] ),
//                               ] ),

//                               // 8 foreach compos in foreach compos in foreach compos
//                               el( 'div', [
//                                 node( 'echo',
//                                       { foreach: 16,
//                                         forval: 'i',
//                                         data: { echo: 'c23' },
//                                       },
//                                       [
//                                         el( 'span', { textContent: 27 } ),
//                                         node( 'echo',
//                                               {
//                                                 forval: 'j',
//                                                 foreach: 22,
//                                                 data: { echo: 'c24' },
//                                               },
//                                               [
//                                                 node( 'echo', {
//                                                   forval: 'k',
//                                                   foreach: 14,
//                                                   //debug: true,
//                                                   data: { echo: 'c25' },
//                                                 } ),
//                                               ] ),
//                                       ] ),
//                               ] ),

//                               // 9 element and element handles in foreach
//                               el( 'div', [
//                                 el( 'span',
//                                     {
//                                       foreach: 22,
//                                       forval: 'clickfor',
//                                       handle: 'forclickholder',
//                                       textContent: 31
//                                     },
//                                     [
//                                       el( 'h2', { textContent: 31 } ),
//                                     ] ) ] ),

//                             ] ),

//                             el( 'section', [ // 9 for other stuff

//                               node( 'clicky', { // 0 event handlers and component handlers
//                                 on_gotclick: 29
//                               } ),

//                               // element and component handles
//                               el( 'span',
//                                   {
//                                     handle: 'clickholder',
//                                   },
//                                   [
//                                     node( 'clicky', { handle: 'clicker' } )
//                                   ] ),

//                               // element and component handles in foreach
//                               el( 'div', [
//                                   el( 'span',
//                                       {
//                                         foreach: 22,
//                                         forval: 'clickfor',
//                                         handle: 'forclickholder',
//                                         textContent: 31
//                                       },
//                                       [
//                                         node( 'clicky', { handle: 'forclicker', data: { txt: 'shoy'}  } ),
//                                         el( 'span', { textContent: 'ENDY' } ),
//                                       ] ) ] ),
//                             ] ),

//                           ] }, //body
//             }, //html


//             components: {

//               foo: {
//                 functions: {
//                   bar: 0
//                 },
//                 contents: [
//                   el ( 'div', '', [
//                     el ('span', { textContent: 2 } ), // 2 references a function in the function list
//                   ] ),
//                 ],
//               }, // foo component

//               echo: {
//                 contents: [ el( 'span', { textContent: 11} ) ],
//               },


//               iffy: {
//                 data: { number: 'i1' },
//                 contents: [
//                   el ('div', [
//                     el ('h1', { if: 8, textContent: 'is one' } ),
//                     el ('h2', { elseif: 9, textContent: 'is two' } ),
//                     el ('h3', { else: true, textContent: 'whuddeveh' } ),
//                   ] )
//                 ],
//               }, //  iffy component


//               clicky: {
//                 data : { txt: 'sclickme' },
//                 contents: [
//                   el( 'button', {
//                     textContent: 30,
//                     on_click: 28,
//                   } )
//                 ],
//               }, //clicky component

//             }, //components

//             functions: {
//               groan: 4,
//             } //functions

//           }, //TEST (default)



//           OTHERNAME: {
//             components: {
//               containery: {
//                 contents: [
//                   el( 'div', [
//                     el( 'header', 'head' ),
//                     el( 'main', { textContent: 'main', internalContent: true } ),
//                     el( 'footer', { textContent: 7 } ),
//                   ] ),
//                 ],
//               },
//             },
//             functions: {
//               foot: 6,
//             },
//           }, //OTHER (namespace)

//         }; // filespaces

//   init( def,

//         [ c => "BAR",         // 0
//           c => "BAR2",        // 1
//           c => c.fun.bar(),   // 2
//           c => "BAR3",        // 3
//           c => "groan",       // 4
//           c => c.fun.groan(), // 5
//           c => "foot",        // 6
//           c => c.fun.foot(),  // 7
//           c => c.get('number') == 1, // 8
//           c => c.get('number') < 3,  // 9
//           c => c.get('blat') == 1,   // 10
//           c => c.get('echo'),  // 11
//           c => c.get('echo') === 'nothing to say',  // 12
//           c => false,          // 13
//           c => [1,2,3,4],      // 14
//           c => c.idx.numb + ") " + c.it.numb, //15
//           c => [2,4,6,8,10],   // 16
//           c => c.idx.numb == 0 || c.idx.numb == 3,   // 17
//           c => true,           // 18
//           c => '(' + c.idx.numb + ',' + c.it.numb + ')', //19
//           c => 'start ' + c.idx.numb, // 20
//           c => `innie(${c.idx.innie}/${c.it.innie}) outie(${c.idx.numb}/${c.it.numb})`, //21
//           c => [1,2,4],      // 22
//           c => `[outermost ${c.idx.i}]`,                       // 23
//           c => `[middle ${c.idx.i},${c.idx.j}]`,               // 24
//           c => `[innermost ${c.idx.i},${c.idx.j},${c.idx.k} (${c.it.i} / ${c.it.j} / ${c.it.k})]`, // 25
//           c => `[outmost start ${c.idx.i}]`, // 26
//           c => 'compo start ' + c.idx.i, // 27

//           c => c.event( 'gotclick' ), // 28
//           c => window.misc++, // 29
//           c => c.get('txt'), // 30
//           c => `txt : ${c.idx.clickfor}`, // 31
//         ], // functions list

//         'TEST' // default filespace (the one with the body)
//       );

//   checkNode( "body|0 span", { textContent: 'FIRST' }, 'first div text' );

//   checkNode( "body|1 div", { textContent: 'SECOND' }, 'second div text' );
//   checkNode( "body|1 div|0 div|0 span", { textContent: 'BAR' }, 'first bar' );
//   checkNode( "body|1 div|1 div|0 span", { textContent: 'BAR2' }, 'bar override' );

//   checkNode( "body|1 div|2 div|0 span", { textContent: 'BAR3' }, 'third bar' );
//   checkNode( "body|1 div|2 div|1 span", { textContent: 'a span' }, 'third bar with listed contents 1' );
//   checkNode( "body|1 div|2 div|2 span", { textContent: 'with stuff' }, 'third bar with listed contents 1' );

//   checkNode( "body|1 div|3 div|0 span", { textContent: 'BAR' }, 'fourth bar' );
//   checkNode( "body|1 div|3 div|1 ul|0 li", { textContent: 'I am' }, 'fourth bar with more content 1' );
//   checkNode( "body|1 div|3 div|1 ul|1 li", { textContent: 'groan' }, 'fourth bar with more content 2' );
//   checkNode( "body|1 div|3 div|1 ul|2 li", { textContent: 'in' }, 'fourth bar with more content 3' );

//   checkNode( "body|2 div|0 header", { textContent: 'head' }, 'containery 1 head' );
//   checkNode( "body|2 div|1 main", { textContent: 'main' }, 'containery 1 main' );
//   checkNode( "body|2 div|2 footer", { textContent: 'foot' }, 'containery 1 footer' );

//   checkNode( "body|3 div|0 header", { textContent: 'head' }, 'containery 2 head' );
//   checkNode( "body|3 div|1 main", { textContent: 'main' }, 'containery 2 main' );
//   checkNode( "body|3 div|1 main|0 div", { textContent: 'in the middle' }, 'containery 2 added content' );
//   checkNode( "body|3 div|2 footer", { textContent: 'foot' }, 'containery 2 footer' );

//   checkNode( "body|6 div|0 div|0 h1", { style: {display: 'none'}, textContent: undefined }, 'else test (hidden 1)' );
//   checkNode( "body|6 div|0 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'else test (hidden 2)' );
//   checkNode( "body|6 div|0 div|2 h3", { style: {display: ''}, textContent: 'whuddeveh' }, 'else test (not hidden)' );

//   checkNode( "body|6 div|1 div|0 h1", { style: {display: 'none'}, textContent: undefined }, 'elseif test (hidden 1)' );
//   checkNode( "body|6 div|1 div|1 h2", { style: {display: ''}, textContent: 'is two' }, 'elseif test (not hidden)' );
//   checkNode( "body|6 div|1 div|2 h3", { style: {display: 'none'}, textContent: undefined }, 'elseif test (hidden 3)' );

//   checkNode( "body|6 div|2 div|0 h1", { style: {display: ''}, textContent: 'is one' }, 'if test (not hidden)' );
//   checkNode( "body|6 div|2 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'if test (hidden 3)' );
//   checkNode( "body|6 div|2 div|2 h3", { style: {display: 'none'}, textContent: undefined }, 'if test (hidden 3)' );

//   // check instance data
//   let elseInst = elPath( "body|6 div|0 div" ).instance;
//   is (elseInst.get('number'), 3, 'else instance correct data');

//   let elseifInst = elPath( "body|6 div|1 div" ).instance;
//   is (elseifInst.get('number'), 2, 'elseif instance correct data');

//   let ifInst = elPath( "body|6 div|2 div" ).instance;
//   is (ifInst.get('number'), 1, 'if instance correct data');

//   // update the number and see what changes
//   elseInst.set('number', 1);
//   elseInst.refresh();
//   checkNode( "body|6 div|0 div|0 h1", { style: {display: ''}, textContent: 'is one' }, 'else to if test (not hidden)' );
//   checkNode( "body|6 div|0 div|1 h2", { style: {display: 'none'}, textContent: undefined }, 'else to if test (hidden 3)' );
//   checkNode( "body|6 div|0 div|2 h3", { style: {display: 'none'}, textContent: 'whuddeveh' }, 'else to if test (hidden 3 but still has old text content)' );

//   elseInst.set('number', 2);
//   elseInst.refresh();
//   checkNode( "body|6 div|0 div|0 h1", { style: {display: 'none'}, textContent: 'is one' }, 'else to if test (hidden, still has old text content)' );
//   checkNode( "body|6 div|0 div|1 h2", { style: {display: ''}, textContent: 'is two' }, 'else to if test (hidden 3)' );
//   checkNode( "body|6 div|0 div|2 h3", { style: {display: 'none'}, textContent: 'whuddeveh' }, 'else to if test (hidden 3 but still has old text content)' );

//   checkNode( "body|4 div|1 main|0 div", { style: {display: ''}, textContent: 'in a middle' }, 'containery 3 added content if yes part' );
//   checkNode( "body|4 div|1 main|1 div", { style: {display: 'none'}, textContent: undefined }, 'containery 3 added content if no part' );

//   checkNode( "body|5 div|1 main|0 div",
//              { style: {display: 'none'}, textContent: undefined },
//              'containery 4 added content if no part' );
//   checkNode( "body|5 div|1 main|1 div",
//              { style: {display: ''}, textContent: 'nope nope im the else' },
//              'containery 4 added content if yes part' );

//   checkNode( "body|5 div|1 main|1 div",
//              { style: {display: ''}, textContent: 'nope nope im the else' },
//              'containery 4 added content if yes part' );

//   checkNode( "body|7 div|0 div|1 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' foo echo first not showing, so no class for it either' );

//   checkNode( "body|7 div|0 div|2 span",
//              { style: {display: ''}, class: 'default', textContent: 'nothing to say' },
//              ' foo echo second showing' );
//   checkNode( "body|7 div|0 div|3 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' foo echo third not showing, class not yet set' );


//   checkNode( "body|7 div|1 div|0 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' in body echo first not showing, so no class for it either' );
//   checkNode( "body|7 div|1 div|1 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' in body echo second showing, class was removed because it is hidden' );
//   checkNode( "body|7 div|1 div|2 span",
//              { style: {display: ''}, class: 'never', textContent: undefined },
//              ' in body echo third now showing and class is set, but no textContent to show since echo not set in that instance' );

//   // update

//   let elp = elPath( "body|7 div|0 div" );
//   let instance = elp.instance;

//   instance.set("echo","NUBU");
//   instance.refresh();

//   checkNode( "body|7 div|0 div|1 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' foo echo first not showing, so no class for it either' );
//   checkNode( "body|7 div|0 div|2 span",
//              { style: {display: 'none'}, class: null, textContent: undefined },
//              ' foo echo second showing, class was removed because it is hidden' );
//   checkNode( "body|7 div|0 div|3 span",
//              { style: {display: ''}, class: 'never', textContent: 'NUBU' },
//              ' foo echo third now showing and class is set' );

//   // foreach tests

//   let loopdiv = 0;

//   // elements in loop
//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: '0) 1' }, 'first foreach span' );
//   checkNode( `body|8 section|${loopdiv} div|1 span`,
//              { textContent: '1) 2' }, 'second foreach span' );
//   checkNode( `body|8 section|${loopdiv} div|2 span`,
//              { textContent: '2) 3' }, 'third foreach span' );
//   checkNode( `body|8 section|${loopdiv} div|3 span`,
//              { textContent: '3) 4' }, 'fourth foreach span' );
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 4, 'for in span foreach' );

//   loopdiv = 1;
//   // components in loop
//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: '0) 2' }, 'first foreach component' );
//   checkNode( `body|8 section|${loopdiv} div|1 span`,
//              { textContent: '1) 4' }, 'second foreach component' );
//   checkNode( `body|8 section|${loopdiv} div|2 span`,
//              { textContent: '2) 6' }, 'third foreach component' );
//   checkNode( `body|8 section|${loopdiv} div|3 span`,
//              { textContent: '3) 8' }, 'fourth foreach component' );
//   checkNode( `body|8 section|${loopdiv} div|4 span`,
//              { textContent: '4) 10' }, 'fifth foreach component' );
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, 'for in component foreach' );


//   loopdiv = 2;
//   // if and loop with components
//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: undefined, style: {display:'none'} }, 'first foreach if component hidden' );
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 1, 'for in if component foreach' );

//   loopdiv = 3;
//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: '0) 2', style: {display:''} }, 'second foreach if component, not hidden, 0' );
//   checkNode( `body|8 section|${loopdiv} div|1 span`,
//              { textContent: '1) 4', style: {display:''} }, 'second foreach if component, not hidden, 1' );
//   checkNode( `body|8 section|${loopdiv} div|2 span`,
//              { textContent: '2) 6', style: {display:''} }, 'second foreach if component, not hidden, 2' );
//   checkNode( `body|8 section|${loopdiv} div|3 span`,
//              { textContent: '3) 8', style: {display:''} }, 'second foreach if component, not hidden, 3' );
//   checkNode( `body|8 section|${loopdiv} div|4 span`,
//              { textContent: '4) 10', style: {display:''} }, 'second foreach if component, not hidden, 4' );

//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, 'for in if component foreach' );

//   loopdiv = 5;
//   // loop with content and inner stuff
//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: '0) 2', style: {display:''} }, 'foreach text with internal content 0' );
//   checkNode( `body|8 section|${loopdiv} div|0 span|0 span`,
//              { textContent: '(0,2)', style: {display:''} }, 'foreach with correct internal content 0' );
//   checkNode( `body|8 section|${loopdiv} div|3 span`,
//              { textContent: '3) 8', style: {display:''} }, 'foreach text with internal content 3' );
//   checkNode( `body|8 section|${loopdiv} div|3 span|0 span`,
//              { textContent: '(3,8)', style: {display:''} }, 'foreach with correct internal content 3' );
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, 'for in loop with content' );

//   loopdiv = 6;
//   // loop elements in looped elements
//   checkNode( `body|8 section|${loopdiv} div|0 div|0 span`,
//              { textContent: 'start 0', style: {display:''} }, 'el loop in el loop 0' );
//   checkNode( `body|8 section|${loopdiv} div|0 div|1 span`,
//              { textContent: 'innie(0/1) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/0' );
//   checkNode( `body|8 section|${loopdiv} div|0 div|2 span`,
//              { textContent: 'innie(1/2) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/1' );
//   checkNode( `body|8 section|${loopdiv} div|0 div|3 span`,
//              { textContent: 'innie(2/4) outie(0/2)', style: {display:''} }, 'el loop in el loop 0 innie 0/2' );

//   checkNode( `body|8 section|${loopdiv} div|1 div|0 span`,
//              { textContent: 'start 1', style: {display:''} }, 'el loop in el loop 1' );
//   checkNode( `body|8 section|${loopdiv} div|1 div|1 span`,
//              { textContent: 'innie(0/1) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/0' );
//   checkNode( `body|8 section|${loopdiv} div|1 div|2 span`,
//              { textContent: 'innie(1/2) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/2' );
//   checkNode( `body|8 section|${loopdiv} div|1 div|3 span`,
//              { textContent: 'innie(2/4) outie(1/4)', style: {display:''} }, 'el loop in el loop 0 innie 1/3' );

//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, '8 outies in el loop in el loop' );
//   elp = elPath( `body|8 section|${loopdiv} div|0 div` );
//   is (elp.childElementCount, 4, '1 title + 3 innies in in el loop in el loop' );


//   loopdiv = 7;
//   // loop components in looped elements
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, '8 outies in compo loop in el loop' );
//   elp = elPath( `body|8 section|${loopdiv} div|0 div` );
//   is (elp.childElementCount, 4, '1 title + 3 innies in in compo loop in el loop' );

//   checkNode( `body|8 section|${loopdiv} div|0 div|0 span`,
//              { textContent: 'start 0', style: {display:''} }, 'compo loop in el loop 0' );

//   checkNode( `body|8 section|${loopdiv} div|0 div|1 span`,
//              { textContent: 'innie(0/1) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/0' );
//   checkNode( `body|8 section|${loopdiv} div|0 div|2 span`,
//              { textContent: 'innie(1/2) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/1' );
//   checkNode( `body|8 section|${loopdiv} div|0 div|3 span`,
//              { textContent: 'innie(2/4) outie(0/2)', style: {display:''} }, 'compo loop in el loop 0 innie 1/2' );



//   loopdiv = 8;
//   // loop components in looped els
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 5, '8 outies in compo loop in compo loop in compo loop outermost' );
//   elp = elPath( `body|8 section|${loopdiv} div|1 span` );
//   is (elp.childElementCount, 4, '1 title + 3 innies in in compo loop in compo loop middle' );
//   elp = elPath( `body|8 section|${loopdiv} div|1 span|1 span` );
//   is (elp.childElementCount, 4, '3 innies + 1 middle marker in in compo loop in compo loop in compo loop innermost' );

//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: '[outermost 0]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 0/outer' );
//   checkNode( `body|8 section|${loopdiv} div|0 span|0 span`,
//              { textContent: 'compo start 0', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 0/top-title' );

//   elp = elPath(`body|8 section|${loopdiv} div|0 span` );

//   checkNode( `body|8 section|${loopdiv} div|0 span|1 span`,
//              { textContent: '[middle 0,0]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 0/0 middle comp' );
//   checkNode( `body|8 section|${loopdiv} div|0 span|2 span`,
//              { textContent: '[middle 0,1]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 0/1 middle comp' );
//   checkNode( `body|8 section|${loopdiv} div|0 span|3 span`,
//              { textContent: '[middle 0,2]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 0/1 middle comp' );

//   checkNode( `body|8 section|${loopdiv} div|1 span|2 span`,
//              { textContent: '[middle 1,1]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 1/1 middle comp' );
//   checkNode( `body|8 section|${loopdiv} div|1 span|2 span|0 span`,
//              { textContent: '[innermost 1,1,0 (4 / 2 / 1)]', style: {display:''} },
//              'loopy compo in loopy compo in el in loop compo 1/1/0 middle comp' );

//   elp = elPath( `body|9 section|0 button` );
//   is (window.misc,0,'misc starts out 0');
//   elp.click();
//   is (window.misc,1,'misc now 1');

//   elp = elPath( `body|9 section|1 span|0 button` );
//   let inst = elp.instance.parent;
//   ok (inst.el.clickholder, 'got the element handle' );

//   is (inst.el.clickholder, elPath( 'body|9 section|1 span' ), 'element handle points to element' );
//   ok (inst.comp.clicker, 'got the component handle' );
//   is (inst.comp.clicker, elp.instance, 'correct component handle' );

//   ok (inst.el.forclickholder, 'got a element handle in' );
//   is (inst.el.forclickholder.length, 3, ' handle' );

//   elp = elPath( `body|9 section|2 div|0 span` );

//   loopdiv = 9;
//   elp = elPath( `body|8 section|${loopdiv} div` );
//   is (elp.childElementCount, 3, '3 innies els in els' );

//   checkNode( `body|8 section|${loopdiv} div|0 span`,
//              { textContent: 'txt : 0', style: {display:''} }, 'el in el loop 0' );
//   checkNode( `body|8 section|${loopdiv} div|0 span|0 h2`,
//              { textContent: 'txt : 0', style: {display:''} }, 'inner el in el loop 0' );

//   checkNode( `body|8 section|${loopdiv} div|1 span`,
//              { textContent: 'txt : 1', style: {display:''} }, 'el in el loop 0' );
//   checkNode( `body|8 section|${loopdiv} div|1 span|0 h2`,
//              { textContent: 'txt : 1', style: {display:''} }, 'inner el in el loop 0' );

//   checkNode( `body|8 section|${loopdiv} div|2 span`,
//              { textContent: 'txt : 2', style: {display:''} }, 'el in el loop 0' );
//   checkNode( `body|8 section|${loopdiv} div|2 span|0 h2`,
//              { textContent: 'txt : 2', style: {display:''} }, 'inner el in el loop 0' );

//   doneTesting();

// }
