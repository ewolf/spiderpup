#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Exception;

use lib '../lib';
use lib './lib';

use Cwd;
use Data::Dumper;
use JSON;
use Yote::SpiderPup;

my $base = ( getcwd =~ m~/t$~ ? '.' : 't' ) . '/www';

# convert to perl structures.
# yank functions and put them in $funs
sub convert_json {
    my ( $json_str, $funs ) = @_;
    my $done = '';
    while( $json_str =~ /(.*)((\([^\)]*\)|[a-zA-Z0-9_-]+)\s*=>\s*)(\{)(.*)/s ) {
        my ($prefix,$fun_prefix,$brace,$rest) = ( $1, $2, $4, $5 );
        my $fun_body = find_end_brace( $rest );

        my $fun = "$fun_prefix$brace$fun_body";
        my $idx = @$funs;
        push @$funs, $fun;
        substr $json_str, length( $prefix ), length( $fun ), $idx;
    }
    while( $json_str =~ /(.*)(function\s*\([^\)]*\)\s*)(\{)(.*)/s ) {
        my ($prefix,$fun_prefix,$brace,$rest) = ( $1, $2, $3, $4 );
        my $fun_body = find_end_brace( $rest );

        my $fun = "$fun_prefix$brace$fun_body";
        my $idx = @$funs;
        push @$funs, $fun;
        substr $json_str, length( $prefix ), length( $fun ), $idx;
    }
    return $json_str;
}

sub find_end_brace {
    my $txt = shift;
    if ($txt =~ /^([^\{\}\'\"]*)([\{\'\"].*)/s) {
        my $prefix = $1;
        my $rest = $2;
        if ($rest =~ /^("(?:[^"\\]|\\.)*(.*?)")(.*)/s ) {
            return $prefix . $1 . find_end_brace( $3);
        }
        elsif( $rest =~ /^('(?:[^'\\]|\\.)*(.*?)')(.*)/s ) {
            return $prefix . $1 . find_end_brace( $3 );
        }
        # a new level
        my $to_next = find_end_brace( substr($rest,1) );
        $rest = substr($rest,length($to_next)-1);
        return $prefix . '{' . $to_next . find_end_brace( $rest );
    }
    elsif ($txt =~ /^([^\}]*)\}(.*)/s) {
        return $1 . "}";
    }
    die "Unable to find end brace for $txt\n";
}

sub spiderpup_data {
    my ($file, $alphasort ) = @_;
    my $js = Yote::SpiderPup->yaml_to_js( $base, "recipes/$file", $alphasort );
    my ($filespaces, $defNS) = ( $js =~ /^let filespaces = (.*?);\nlet defaultFilename = "(.*)";/s );
    my $funs = [];
    my $json = convert_json($filespaces,$funs);
    return $funs, from_json($json), $defNS;
}

my $funs = [];
my $conv = convert_json( q~{"foo":"bar",[function(){say('FREEN}')}],"y":()=>{foo("I LI\"KE } AND O' {")}}~, $funs );

# test the test funs
is_deeply( $funs,
           [ '()=>{foo("I LI\\"KE } AND O\' {")}',
             'function(){say(\'FREEN}\')}'
           ], 'convert back to funs from json' );
is ( $conv, '{"foo":"bar",[1],"y":0}', 'json after funs conversion' );



my $obj = { arry => [ 1,2,"FOO",qq~() => alert("HI");~ ], zap => "zuup", fh=> { "HI" => "TH\"ERE", "OH" => 'function() { return "BLEEP" }' } };
my $txt = Yote::SpiderPup::to_json( $obj, 'alpha' );
is ( $txt,
     q~{"arry":[1,2,"FOO",()=>{return alert("HI")}],"fh":{"HI":"TH\"ERE","OH":function() { return "BLEEP" }},"zap":"zuup"}~,
     'to_json'
    );

($funs, my $filespaces,my $defNS) = spiderpup_data( "import_test.yaml", 'alpha' );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [
               '()=>{return 1}',
               'c=>{ if( true ) { return 7.1; } }',
               '()=>{return 2}',
           ], 'funs' );

my $exp = {'t/www/recipes/impy.yaml'=>{'namespaces'=>{},'functions'=>{},'data'=>{},'recipes'=>{'myform'=>{'contents'=>[{'contents'=>[{'tag'=>'mydiv'}],'tag'=>'form'}],'functions'=>{'foo'=>0}},'mydiv'=>{'contents'=>[{'attrs'=>{'textContent'=>'my div'},'tag'=>'div'}]}}},'t/www/recipes/import_test.yaml'=>{'data'=>{},'html'=>{'head'=>{'style'=>"body { background: blue; }\ndiv table { color: green; }\n",'script'=>"alert(\"HI\")",'javascript'=>['js_one.js','js_two.js'],'css'=>['css_one.css'],'title'=>'test thing'},'body'=>{'listen'=>1,'contents'=>[{'tag'=>'bar.myform','functions'=>{'foo'=>2}}]}},'recipes'=>{},'namespaces'=>{'bar'=>'t/www/recipes/impy.yaml'},'functions'=>{}}};
is_deeply( $filespaces, $exp, 'file spaces for import_test' );

($funs, $filespaces, $defNS) = spiderpup_data( "simple_test.yaml" );
is_deeply( $funs, [], 'simple no funs' );
$exp = {'t/www/recipes/simple_test.yaml'=>
        {'data'=>{ x => 'y' },'recipes'=>{},'functions'=>{},'namespaces'=>{},
             'html'=>{'body'=>{'contents'=>[{'tag'=>'div','attrs'=>{'textContent'=>'hello world'}}]}}}};
is_deeply( $filespaces, $exp, 'file spaces for simple test' );


throws_ok(
    sub {
        my $loader = sub {
            return {
                recipes => {
                    burp => {

                    },
                }
            };
        };
        Yote::SpiderPup::load_namespace( '', '', {}, undef, $loader );
    },
    qr/recipe 'burp' must contain contents/,
    'component without contents'
);

throws_ok(
    sub {
        my $loader = sub {
            return {
                recipes => {
                    burp => {
                        contents => []
                    },
                }
            };
        };
        Yote::SpiderPup::load_namespace( '', '', {}, undef, $loader );
    },
    qr/recipe 'burp' must contain contents/,
    'component without contents'
);

($funs, $filespaces, $defNS) = spiderpup_data( "error.yaml" );
is( $defNS, 'ERROR', 'error namespace name' );
is_deeply ($funs, [], 'no error funs' );
is_deeply( $filespaces, {"ERROR"=>{"html"=>{"body"=>{"contents"=>[{"tag"=>"h3","attrs"=>{"textContent"=>"Error in file recipes/error.yaml"}},{"tag"=>"div","contents"=>[{"attrs"=>{"textContent"=>"recipe \'burp\' must contain contents at lib/Yote/SpiderPup.pm line 31.\n"},"tag"=>"p"}]}]}},"functions"=>{},"recipes"=>{},"namespaces"=>{},"data"=>{}}}, 'error data' );


throws_ok(
    sub {
        my $loader = sub {
            return {
                recipes => {
                    'burp.urp' => {
                        contents => [ "div" ],
                    },
                }
            };
        };
        Yote::SpiderPup::load_namespace( '', '', {}, undef, $loader );
    },
    qr/'burp.urp' in '\/' may not have a '.' in the name/,
    'component without contents'
);

my $loader = sub {
    return {
        recipes => {
            'spano' => {
                data => { items => [ "A", "B", undef ] },
                contents => [ 'span' ],
                onLoad => 'function() { console.log( "got load" ) }',
                preLoad => 'function() { console.log( "starting load" ) }',
                listen => 'function() { console.log( "heard something" ) }',
            },
        },
    };
};
my $namespaces = {};
Yote::SpiderPup::load_namespace( '', '', $namespaces, undef, $loader );

is_deeply( $namespaces,
           {
               '/' => {
                   'recipes' => {
                       'spano' => {
                           'contents' => [ {
                               'tag' => 'span',
                                           } ],
                           'data' => { 'items' => [ "A", "B", undef ] },
                           'listen' => 'function() { console.log( "heard something" ) }',
                           'onLoad' => 'function() { console.log( "got load" ) }',
                           'preLoad' => 'function() { console.log( "starting load" ) }',
                       }
                   },
                       'namespaces' => {},
                       'functions' => {},
                       'data' => {},

               },
           },
           'very simple namespace' );



$loader = sub {
    return {
        preLoad => '() => { console.log( "starting to load" ) }',
        onLoad => '() => { console.log( "loaded" ) }',
        listen => '() => console.log("I HEAR U")',
        functions => {
            beep => 'function() { alert("BEEP") }',
            leep => 'c=>alert("leep")',
        },
        page => {
            body => {
                'contents' => [
                    { 'div' => {
                        if => 'c => true',
                        textContent => "first",
                        handle => "FIRSTY",
                      }},
                    { 'div' => {
                        elseif => '() => true',
                        textContent => "second",
                        on_click => 'function() { alert("CLEEK") }',
                      }},
                    { 'div' => {
                        else => 'True',
                        textContent => 'c => "third "+c.it.doh+" = "+c.idx.doh"',
                                                 forvar => 'doh',
                                                 foreach => [ 1,2,3,4 ],
                      }},
                    ],
            },
        }
    };
};
$namespaces = {};
Yote::SpiderPup::load_namespace( '', '', $namespaces, undef, $loader );
my $js = Yote::SpiderPup::to_json( $namespaces, 1 );
is ($js, '{"/":{"data":{},"functions":{"beep":function() { alert("BEEP") },"leep":c=>{return alert("leep")}},"html":{"body":{"contents":[{"attrs":{"textContent":"first"},"handle":"FIRSTY","if":c=>{return true},"tag":"div"},{"attrs":{"textContent":"second"},"elseif":()=>{return true},"on":{"click":function() { alert("CLEEK") }},"tag":"div"},{"attrs":{"textContent":c=>{return "third "+c.it.doh+" = "+c.idx.doh"}},"else":1,"foreach":[1,2,3,4],"forvar":"doh","tag":"div"}],"listen":()=>{return console.log("I HEAR U")},"onLoad":()=>{ console.log( "loaded" ) },"preLoad":()=>{ console.log( "starting to load" ) }}},"namespaces":{},"recipes":{}}}', "json checks out" );
is_deeply( $namespaces,
           {
               '/' => {
                   html => {
                       body => {
                           contents => [
                               {
                                   'if' => 'c => true',
                                   'attrs' => {
                                      'textContent' => 'first',
                                   },
                                   'handle' => 'FIRSTY',
                                   'tag' => 'div'
                               },
                               {
                                   'elseif' => '() => true',
                                   'attrs' => {
                                       'textContent' => 'second'
                                   },
                                   'tag' => 'div',
                                   'on' => { 'click' => 'function() { alert("CLEEK") }' },
                               },
                               {
                                   'foreach' => [ 1, 2, 3, 4 ],
                                   'else' => 1,
                                   'forvar' => 'doh',
                                   'tag' => 'div',
                                   'attrs' => {
                                      'textContent' => 'c => "third "+c.it.doh+" = "+c.idx.doh"'
                                   }
                               },
                               ],
                           listen => '() => console.log("I HEAR U")',
                           onLoad => '() => { console.log( "loaded" ) }',
                           preLoad => '() => { console.log( "starting to load" ) }',
                       }
                   },
                   data => {},
                   namespaces => {},
                   functions => {
                       beep => 'function() { alert("BEEP") }',
                       leep => 'c=>alert("leep")',
                   },
                   recipes => {},
               },
           },
           'body with branches and loops' );


$loader = sub {
    return {
        page => {
            body => {
                'contents' => [
                    { 'slotty' => {
                        fill_contents => {
                            one => [
                                { 'div' => 'div one' },
                                ],
                            two => [
                                { 'div' => 'div two' },
                                ],
                        } } },
                    { 'div' => undef },
                    ],
            },
        },
        recipes => {
            'slotty' => {
                data => { hasSlot => 'false', hasYarg => 'FALSE' },
                contents => [
                    {
                        'div' => {
                            contents => [
                                { 'div' => {
                                    'fill' => 'one',
                                  }},
                                { 'div' => {
                                    'fill' => 'two',
                                  }},
                                { 'div' => {
                                    'fill' => 'true',
                                  }},
                                ]
                        },
                    },
                ],
            }
        },
    };
};
$namespaces = {};
Yote::SpiderPup::load_namespace( '', '', $namespaces, undef, $loader );
$js = Yote::SpiderPup::to_json( $namespaces, 1 );

is ($js, '{"/":{"data":{},"functions":{},"html":{"body":{"contents":[{"fill_contents":{"one":[{"attrs":{"textContent":"div one"},"tag":"div"}],"two":[{"attrs":{"textContent":"div two"},"tag":"div"}]},"tag":"slotty"},{"tag":"div"}]}},"namespaces":{},"recipes":{"slotty":{"contents":[{"contents":[{"fill":"one","tag":"div"},{"fill":"two","tag":"div"},{"fill":true,"tag":"div"}],"tag":"div"}],"data":{"hasSlot":false,"hasYarg":false}}}}}', "json checks out with slots" );

is_deeply( $namespaces,
           {
               '/' => {
                   html => {
                       body => {
                           contents => [
                               {
                                   'tag' => 'slotty',
                                   'fill_contents' => {
                                       'one' => [ { "tag" => "div", attrs => { textContent => "div one" } } ],
                                       'two' => [ { "tag" => "div", attrs => { textContent => "div two" } } ],
                                   },
                               },
                               { 'tag' => 'div' },
                               ],
                       }
                   },
                   recipes => {
                       slotty => {
                           data => { hasSlot => 'false', hasYarg => 'FALSE' },
                           contents => [
                               {
                                   'tag' => 'div',
                                   contents => [
                                       { 'tag' => 'div',
                                         'fill' => 'one' },
                                       { 'tag' => 'div',
                                         'fill' => 'two' },
                                       { 'tag' => 'div',
                                         'fill' => 'true' },
                                    ]
                               },
                               ],
                           }
                   },
                   data => {},
                   namespaces => {},
                   functions => {},
               },
           },
           'body with fill content' );




$loader = sub {
    return {
        page => {
            body => {
                'contents' => [
                    { 'slotty' => {
                        'fill_contents' => {
                            one => [
                                { 'slotty' => {
                                    'on_foo' => '() => alert()' },
                                } ],
                        } } },
                    { 'div' => undef },
                    ],
            },
        },
        recipes => {
            'slotty' => {
                data => { hasSlot => 'false', hasYarg => 'FALSE' },
                contents => [
                    {
                        'div' => {
                            contents => [
                                { 'div' => {
                                    'fill' => 'one',
                                  }},
                                { 'div' => {
                                    'fill' => 'two',
                                  }},
                                { 'div' => {
                                    'fill' => 'true',
                                  }},
                                ]
                        },
                    },
                ],
            }
        },
    };
};
$namespaces = {};
Yote::SpiderPup::load_namespace( '', '', $namespaces, undef, $loader );
$js = Yote::SpiderPup::to_json( $namespaces, 1 );
is ($js, '{"/":{"data":{},"functions":{},"html":{"body":{"contents":[{"fill_contents":{"one":[{"on":{"foo":()=>{return alert()}},"tag":"slotty"}]},"tag":"slotty"},{"tag":"div"}]}},"namespaces":{},"recipes":{"slotty":{"contents":[{"contents":[{"fill":"one","tag":"div"},{"fill":"two","tag":"div"},{"fill":true,"tag":"div"}],"tag":"div"}],"data":{"hasSlot":false,"hasYarg":false}}}}}', "json checks out with slots" );

$filespaces = {};
my $yaml_file = Yote::SpiderPup::load_namespace( $base, 'recipes/import_test_again.yaml', $filespaces );
is ($yaml_file, "$base/recipes/import_test_again.yaml", "load namespace return");
is_deeply ($filespaces,
           {
               't/www/recipes/impy.yaml' => {
                   'recipes' => {
                       'mydiv' => {
                           'contents' => [
                               {
                                   'attrs' => {
                                       'textContent' => 'my div'
                                   },
                                       'tag' => 'div'
                               } ]
                       },
                       'myform' => {
                           'functions' => {
                               'foo' => '() => 1'
                           },
                           'contents' => [ {
                               'contents' => [ { 'tag' => 'mydiv' } ],
                               'tag' => 'form'
                            } ]
                       }
                   },
                   'data' => {},
                   'namespaces' => {},
                   'functions' => {}
               },
               't/www/recipes/import_test_again.yaml' => {
                   'recipes' => {},
                   'html' => {
                       'body' => {
                           'contents' => [ {
                               'tag' => 'bar.myform',
                               'functions' => {
                                   'foo' => '() => 2'
                               }
                           } ]
                       }
                   },
                   'data' => {},
                   'namespaces' => {
                       'bar' => 't/www/recipes/impy_two.yaml',
                       'impy' => 't/www/recipes/impy.yaml'
                   },
                   'functions' => {}
               },
               't/www/recipes/impy_two.yaml' => {
                   'functions' => {},
                   'recipes' => {
                       'myimpy' => {
                           'attrs' => {
                               'class' => 'myclass'
                           },
                           'contents' => [ {
                               'contents' => [ {
                                   'attrs' => {
                                       'textContent' => 'its mine'
                                   },
                                   'tag' => 'span'
                               } ],
                               'tag' => 'impy'
                           } ]
                       }
                   },
                   'data' => {},
                   'namespaces' => {
                       'impy' => 't/www/recipes/impy.yaml'
                   }
               }
           },
           'namespace where two spaces each call a third'
    );


throws_ok(
    sub {
        my $loader = sub {
            return {
                page => {
                    body => {
                        contents => [ { tag => "div" } ],
                    },
                },
                import_namespaces => {
                    i1 => "import_one",
                    "this.for.that" => "import_dead",
                }
            };
        };
        Yote::SpiderPup::load_namespace( '', '', {}, undef, $loader );
    },
    qr/namespace may not contain '.' and got 'this.for.that'/,
    'namespace alias check'
);

$yaml_file = Yote::SpiderPup::load_namespace( $base, 'recipes/test_not_exist.yaml', $filespaces );
is( $yaml_file, undef, 'unable to load non existant file' );

done_testing;
