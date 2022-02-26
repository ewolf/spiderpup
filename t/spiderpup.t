#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use lib '../lib';
use lib './lib';

use Cwd;
use Data::Dumper;
use JSON;
use SpiderPup;

my $base = ( getcwd =~ m~/t$~ ? '.' : 't' ) . '/www';

sub spiderpup_data {
    my $file = shift;
    my $js = SpiderPup::yaml_to_js( $base, "recipes/$file" );
    my ($funs, $filespaces, $defNS) = ( $js =~ /^const funs = \[(.*?)\];\nconst filespaces = (.*?);\nconst defaultNamespace = \["([^"]+)/s );
    $funs = [grep {$_} map { $_ =~ s/^\s*//s; $_ =~ s/\s*$//s; $_ } split (/,\n/s, $funs)];
    return $funs, from_json($filespaces), $defNS;
}

my ($funs, $filespaces,$defNS) = spiderpup_data( "import_test.yaml" );
is ($defNS, 't/www/recipes/import_test.yaml', 'correct default namespace' );

is_deeply( $funs, [ '() => 1', '() => 2' ], 'funs' );
is_deeply( $filespaces,{'t/www/include/impy.yaml'=>{'html'=>{},'namespaces'=>{},'components'=>{'myform'=>{'functions'=>{'foo'=>0},'contents'=>[{'form'=>['mydiv']}]},'mydiv'=>[{'div'=>'my div'}]}},'t/www/recipes/import_test.yaml'=>{'html'=>{'body'=>[{'bar.myform'=>{'functions'=>{'foo'=>1}}}]},'import'=>[{'impy'=>'bar'}],'components'=>{},'namespaces'=>{'bar'=>'t/www/include/impy.yaml'}}}, 'file spaces' );
#is_deeply($instrs,{'components'=>{'bar.mydiv'=>[{'div'=>'mydiv'}],'bar.myform'=>{'functions'=>{'foo'=>0},'contents'=>[{'form'=>['mydiv']}]}},'html'=>{'body'=>[{'bar.myform'=>{'functions'=>{'foo'=>1}}}]},'import'=>[{'impy'=>'bar'}]},'instrs');


done_testing;
