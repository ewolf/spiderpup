const qs = (sel,el) => (el||document).querySelector(sel);
const qsa = (sel,el) => Array.from((el||document).querySelectorAll(sel));


let testcount = 0;
let passes = 0;
let fails = 0;

function pass( msg ) {
  testcount++;
  console.log( `pass: ${msg}` );
  passes++;
}
function fail( msg ) {
  testcount++;
  console.log( `warn: ${msg}` );
  fails++;
}

function is( a, b, msg ) {
  if (a===b) {
    pass( msg );
  } else {
    console.log( 'expected', b, 'got', a );
    fail( msg );
  }
};

function doneTesting() {
  if (testcount === 0) {
    console.log( "No tests to run" );
  } else if( fails === 0) {
    console.log( `ALL ${testcount} tests pass` );
  } else {
    console.log( `Failed ${fails} out of ${testcount} tests` );
  }
}
