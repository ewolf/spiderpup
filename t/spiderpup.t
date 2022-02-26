#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use lib '../lib';
use lib './lib';

use Cwd;
use Data::Dumper;
use JSON;
use Yote::SpiderPup;

my $base = ( getcwd =~ m~/t$~ ? '.' : 't' ) . '/www';

sub spiderpup_data {
    my $file = shift;
    my $js = Yote::SpiderPup::yaml_to_js( $base, "recipes/$file" );
    my ($funs, $filespaces, $defNS) = ( $js =~ /^let funs = \[(.*?)\];\nlet filespaces = (.*?);\nlet defaultFilename = \["([^"]+)/s );
    $funs = [grep {$_} map { $_ =~ s/^\s*//s; $_ =~ s/\s*$//s; $_ } split (/,/s, $funs)];
    return $funs, from_json($filespaces), $defNS;
}

my ($funs, $filespaces,$defNS) = spiderpup_data( "import_test.yaml" );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [ '() => 1', '() => 2' ], 'funs' );

is_deeply( $filespaces,{'t/www/recipes/impy.yaml'=>{'namespaces'=>{},'functions'=>{},'data'=>{},'components'=>{'myform'=>{'contents'=>[{'contents'=>[{'tag'=>'mydiv'}],'tag'=>'form'}],'functions'=>{'foo'=>0}},'mydiv'=>{'contents'=>[{'attrs'=>{'textContent'=>'my div'},'tag'=>'div'}]}}},'t/www/recipes/import_test.yaml'=>{'data'=>{},'html'=>{'head'=>{'style'=>"body { background: blue; }\ndiv table { color: green; }\n",'script'=>'alert("HI")','javascript'=>['js_one.js','js_two.js'],'css'=>['css_one.css'],'title'=>'test thing'},'body'=>{'contents'=>[{'tag'=>'bar.myform','functions'=>{'foo'=>1}}]}},'components'=>{},'namespaces'=>{'bar'=>'t/www/recipes/impy.yaml'},'functions'=>{}}}, 'file spaces' );


done_testing;
