const qs = (sel,el) => (el||document).querySelector(sel);
const qsa = (sel,el) => Array.from((el||document).querySelectorAll(sel));


let testcount = 0;
const passes = [];
const fails = [];
const messages = [];

function pass( msg ) {
  testcount++;
  passes.push( msg );
  messages.push( `PASS : ${msg}` );
}
function fail( msg ) {
  testcount++;
  fails.push( msg );
  messages.push( `FAIL : ${msg}` );
}

function like( a, regex, msg ) {
  if (String(a).match(regex)) {
    pass( msg );
    return true;
  } else {
    fails( msg );
    messages.push( `expected to match ${regex} and got '${a}'` );
    return false;
  }
}

function is( a, b, msg ) {
  if (a===b) {
    msg && pass( msg );
    return true;
  } else {
    msg && fail( msg );
    messages.push( `expected '${b}' and got '${a}'` );
    return false;
  }
}

function is_deeply( a, b, msg ) {
  let fails = 0;
  if (Array.isArray(b)) {
    if (!Array.isArray(a)) {
      msg && fail( msg );
      messages.push( 'expected array' );
      msg && console.log( a, b, `${msg}: type mismatch` );
      return false;
    }
    if (b.length !== a.length) {
      msg && fail( msg );
      messages.push( 'arrays not the same size' );
      msg && console.log( a, b, `${msg}: arrays with different lengths` );
      return false;
    }
    for (let i=0; i<b.length; i++) {
      if (!is_deeply( a[i], b[i])) {
        msg && fail( msg );
        messages.push( `arrays differ index ${i} expected '${b[i]}' and got '${a[i]}'` );
        msg && console.log( a, b, `${msg}: arrays with different values` );
        return false;
      }
    }
    msg && pass( msg );
    return true;
  }
  else if (typeof b === 'object') {
    if (typeof a !== 'object') {
      msg && fail( msg );
      messages.push( 'expected object' );
      return false;
    }
    const akeys = Object.keys( a );
    const bkeys = Object.keys( b );
    if (bkeys.length !== akeys.length) {
      msg && fail( msg );
      messages.push( 'objects have different keys' );
      msg && console.log( a, b, `${msg}: objects with different keys` );
      return false;
    }
    for (let i=0; i<bkeys.length; i++) {
      const key = bkeys[i];
      const bval = b[key];
      const aval = a[key];
      if (!is_deeply( aval, bval)) {
        msg && fail( msg );
        msg && console.log( a, b, `${msg}: objects with different keys` );
        messages.push( `objects differ on key ${key}. Got '${aval}' and expected '${bval}'` );
        return false;
      }
    }
    msg && pass( msg );
    return true;
  }
  else {
    return is(a, b, msg);
  }
} //is_deeply

function html_structure( el, node, msg ) {
  let [ tag, textContent, attrs, ...contents ] = node;

  if (! is(el.tagName, tag.toUpperCase())) {
    msg && fail( msg );
    messages.push ( `html_structure. Expected tagName '${tag.toUpperCase()}' and got '${el.tagName}'` );
    return false;
  }

  if(Array.isArray( attrs )) {
    // no attrs
    contents.unshift( attrs );
    attrs = {};
  }

  if (Array.isArray(textContent)) {
    // no attrs or textContent
    contents.unshift( textContent );
    textContent = '';
  } else if( typeof textContent === 'object') {
    // got attrs, no textContent
    attrs = textContent;
    textContent = '';
  } 

  attrs = attrs || {};
  const elAttrs = {};
  for (const node of el.attributes) {
    if (! node.nodeName.match( /^data-sp(id|lastlistlen|foridx)/) ) {
      elAttrs[node.nodeName] = node.nodeValue;
    }
  }
  if (textContent) {
    elAttrs.textContent = el.textContent;
    attrs.textContent = textContent;
  }
  if ('style' in elAttrs) {
    attrs.style = attrs.style || '';
  }
  if (! is_deeply( elAttrs, attrs ) ) {
    msg && fail( msg );
//    console.log( elAttrs, attrs, "ATTR FAIL" );
    messages.push ( `html_structure. Attribute mismatch for element '${tag}'` );
    return false;
  }
  if ( el.childElementCount != contents.length ) {
    msg && fail( msg );
    messages.push ( `html_structure. Child element count mismatch for element '${tag}'. Got ${el.childElementCount} and was expecting ${contents.length}` );
    return false;
  }

  for (let i=0; i<el.childElementCount; i++) {
    if (! html_structure( el.children[i], contents[i] )) {
      msg && fail( msg );
      return false;
    }
  }
  msg && pass( msg );
  return true;
} //html_structure

function attach( txt, tag ) {
  tag = tag || 'div';
  const el = document.createElement( tag );
  el.textContent = txt;
  document.body.prepend( el );
}

function sleep( ms ) {
  return new Promise( res => setTimeout( () => res(), ms ) );
}

function doneTesting() {

  messages.reverse().forEach( msg => attach( msg ) );

  if (testcount === 0) {
    attach( "No tests to run", 'h2' );
  } else if( fails.length === 0) {
    attach( `ALL ${testcount} tests pass`, 'h2' );
  } else {
    attach( 'see console for more messages', 'h3' );
    attach( `Failed ${fails.length} out of ${testcount} tests`, 'h2' );
  }

  attach( "TEST RESULTS", 'h1' );
  
}

window.SP ||= {};

SP.tester = {
  attach,
  doneTesting,
  fail,
  html_structure,
  is,
  is_deeply,
  like,
  pass,
  sleep,
};
