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
print STDERR Data::Dumper->Dump([$js,"JS"]);
    my ($funs, $instrs) = ( $js =~ /^const funs = \[(.*?)\];\nconst instructions = (.*);\n/s );
    $funs = [grep {$_} map { $_ =~ s/^\s*//s; $_ =~ s/\s*$//s; $_ } split (/,\n/s, $funs)];
    return $funs, from_json($instrs);
}

my ($funs, $instrs) = spiderpup_data( "import_test.yaml" );
print STDERR Data::Dumper->Dump([$funs,$instrs,"CHDIS"]);
is_deeply( $funs, [ '() => 1', '() => 2' ], 'funs' );
is_deeply($instrs,{'components'=>{'bar.mydiv'=>[{'div'=>'my div'}],'bar.myform'=>{'functions'=>{'foo'=>0},'contents'=>[{'form'=>['mydiv']}]}},'html'=>{'body'=>[{'bar.myform'=>{'functions'=>{'foo'=>1}}}]},'import'=>[{'impy'=>'bar'}]}, 'instrs');


done_testing;
