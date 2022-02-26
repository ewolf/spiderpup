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
    while( $json_str =~ /((\([^\)]*\)|[a-zA-Z0-9_-]+)\s*=>\s*)(\{.*)/s ) {
        my ($fun_prefix,$rest) = ( $2, $3 );
        my $fun_body = find_end_brace( $rest );

        my $fun = "$fun_prefix$fun_body";

        while ($body =~ /^{([^\'\"\{]+)((['"\{])(.*))/) {
            if( $2 =~ /"(?:[^"\\]|\\.)*(.*)"/ ) {
                $fun .= $2;
                $body = $1;
            } 
            elsif( $2 =~ /'(?:[^'\\]|\\.)*(.*)'/ ) {
                $fun .= $2;
                $body = $1;
            } 
            else {
                $fun .= $1;
            }
        }
        return join( '', $args, @body );
    }
}

sub find_end_brace {
    my $txt = shift;
    if ($txt =~ /^([^\{\'\"]*)([\{\'\"].*)/s) {
        my $prefix = $1;
        my $rest = $2;
        if ($rest =~ /("(?:[^"\\]|\\.)*(.*)")(.*)/s ) {
            return $prefix . $1 . find_end_brace( $rest );
        }
        elsif( $rest =~ /'(?:[^'\\]|\\.)*(.*)'/s ) {
            return $prefix . $1 . find_end_brace( $rest );
        }
        return $prefix . find_end_brace( $rest );
    }
    elsif ($txt =~ /^([^\}]*\})(.*)/s) {
        return $1;
    }
    die "Unable to find end brace for $txt\n";
}

my $funs = [];
print convert_json( '{"foo":()=>{return "HI{THERE"}},"bar":function() { alert("HIYA}") }}', $funs );
print "\n";
exit;

sub spiderpup_data {
    my $file = shift;
    my $js = Yote::SpiderPup->yaml_to_js( $base, "recipes/$file" );
    my ($filespaces, $defNS) = ( $js =~ /^let filespaces = (.*?);\nlet defaultFilename = \["([^"]+)/s );
    my $funs = [];
    my $json = convert_json($filespaces,$funs);
    return $funs, $json, $defNS;
}

my $obj = { arry => [ 1,2,"FOO",qq~() => alert("HI");~ ], zap => "zuup", fh=> { "HI" => "TH\"ERE", "OH" => 'function() { return "BLEEP" }' } };
my $txt = Yote::SpiderPup::to_json( $obj, 'alpha' );
is ( $txt,
     q~{"arry":[1,2,"FOO",()=>{return alert("HI")}],"fh":{"HI":"TH\"ERE","OH":function() { return "BLEEP" }},"zap":"zuup"}~,
     'to_json'
    );
done_testing;
exit;

my ($funs, $filespaces,$defNS) = spiderpup_data( "import_test.yaml" );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [ '() => 1', '() => 2' ], 'funs' );

is_deeply( $filespaces,{'t/www/recipes/impy.yaml'=>{'namespaces'=>{},'functions'=>{},'data'=>{},'components'=>{'myform'=>{'contents'=>[{'contents'=>[{'tag'=>'mydiv'}],'tag'=>'form'}],'functions'=>{'foo'=>0}},'mydiv'=>{'contents'=>[{'attrs'=>{'textContent'=>'my div'},'tag'=>'div'}]}}},'t/www/recipes/import_test.yaml'=>{'data'=>{},'html'=>{'head'=>{'style'=>"body { background: blue; }\ndiv table { color: green; }\n",'script'=>'alert("HI")','javascript'=>['js_one.js','js_two.js'],'css'=>['css_one.css'],'title'=>'test thing'},'body'=>{'contents'=>[{'tag'=>'bar.myform','functions'=>{'foo'=>1}}]}},'components'=>{},'namespaces'=>{'bar'=>'t/www/recipes/impy.yaml'},'functions'=>{}}}, 'file spaces' );


done_testing;
