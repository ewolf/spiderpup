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
    my ($funs, $filespaces, $defNS) = ( $js =~ /^const funs = \[(.*?)\];\nconst filespaces = (.*?);\nconst defaultFilename = \["([^"]+)/s );
    $funs = [grep {$_} map { $_ =~ s/^\s*//s; $_ =~ s/\s*$//s; $_ } split (/,\n/s, $funs)];
    return $funs, from_json($filespaces), $defNS;
}

my ($funs, $filespaces,$defNS) = spiderpup_data( "import_test.yaml" );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [ '() => 1', '() => 2' ], 'funs' );
print STDERR Data::Dumper->Dump([$filespaces]);
is_deeply( $filespaces,{'t/www/recipes/impy.yaml'=>{'namespaces'=>{},'functions'=>{},'components'=>{'myform'=>{'contents'=>[{'contents'=>[{'contents'=>[],'attrs'=>{},'tag'=>'mydiv','calculate'=>{},'on'=>{}}],'attrs'=>{},'calculate'=>{},'tag'=>'form','on'=>{}}],'functions'=>{'foo'=>0},'on'=>{},'calculate'=>{},'attrs'=>{}},'mydiv'=>{'contents'=>[{'contents'=>[],'attrs'=>{'textContent'=>'my div'},'on'=>{},'tag'=>'div','calculate'=>{}}],'on'=>{},'calculate'=>{},'attrs'=>{}}}},'t/www/recipes/import_test.yaml'=>{'html'=>{'body'=>{'calculate'=>{},'on'=>{},'contents'=>[{'contents'=>[],'tag'=>'bar.myform','on'=>{},'functions'=>{'foo'=>1},'calculate'=>{},'attrs'=>{}}],'attrs'=>{'class'=>' recipes_import_test-yaml'}}},'components'=>{},'namespaces'=>{'bar'=>'t/www/recipes/impy.yaml'},'functions'=>{}}}, 'file spaces' );


done_testing;
