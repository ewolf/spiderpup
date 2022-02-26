use strict;
use warnings;
use Module::Build;


my $builder = Module::Build->new(
    add_to_cleanup      => [ 'Yote-SpiderPup-*' ],
    build_requires => {
        'Test::More'      => 0,
        'Test::Exception' => 0,
        'Module::Build'   => 0.40,
        'CSS::LESSp'      => 0,
        'YAML'            => 0,
    },
    dist_abstract      => 'SpiderPup',
    create_makefile_pl => 'traditional',
    license            => 'perl',
    module_name        => 'Yote::SpiderPup',
    release_status     => 'stable',
    test_files         => [ 't/spiderpup.t',
                        ],

    script_files       => 'script/spiderpup',
    requires => {
        'perl'              => 'v5.16',
    },
    );

$builder->create_build_script();
