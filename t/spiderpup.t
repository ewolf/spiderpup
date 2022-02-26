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
        return $prefix . find_end_brace( $rest );
    }
    elsif ($txt =~ /^([^\}]*\})(.*)/s) {
        return $1;
    }
    die "Unable to find end brace for $txt\n";
}

sub spiderpup_data {
    my $file = shift;
    my $js = Yote::SpiderPup->yaml_to_js( $base, "recipes/$file", 'alphasort' );
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

($funs, my $filespaces,my $defNS) = spiderpup_data( "import_test.yaml" );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [ '()=>{return 2}',
                    '()=>{return 1}' ], 'funs' );

my $exp = {'t/www/recipes/impy.yaml'=>{'namespaces'=>{},'functions'=>{},'data'=>{},'components'=>{'myform'=>{'contents'=>[{'contents'=>[{'tag'=>'mydiv'}],'tag'=>'form'}],'functions'=>{'foo'=>1}},'mydiv'=>{'contents'=>[{'attrs'=>{'textContent'=>'my div'},'tag'=>'div'}]}}},'t/www/recipes/import_test.yaml'=>{'data'=>{},'html'=>{'head'=>{'style'=>"body { background: blue; }\\ndiv table { color: green; }\\n",'script'=>"alert(\"HI\")",'javascript'=>['js_one.js','js_two.js'],'css'=>['css_one.css'],'title'=>'test thing'},'body'=>{'contents'=>[{'tag'=>'bar.myform','functions'=>{'foo'=>0}}]}},'components'=>{},'namespaces'=>{'bar'=>'t/www/recipes/impy.yaml'},'functions'=>{}}};
is_deeply( $filespaces, $exp, 'file spaces' );


done_testing;
