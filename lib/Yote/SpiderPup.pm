package Yote::SpiderPup;

use strict;
use warnings;

use Data::Dumper;

use File::Slurp;
use CSS::LESSp;

use JSON;
use YAML;

my %config;
my $root_directory;
my $yote;

#
# server function that serves up the named file and type.
# if no filename is given, try to detect via the request.
# if no file exists for the request, serve a 404.
#
sub serve_file {
    my ($c,$filename,$type) = @_;

    if (! $filename) {
        $filename = "$root_directory".$c->req->url->to_abs->path;
    }

    $c->app->log->debug( "**FILE**, $filename" );

    if (-e $filename) {
        my $text = read_file( $filename );
        $type && $c->res->headers->content_type( $type );
        return $c->render( text => $text );
    } else {
        # 404
        $c->render(text => "FILE NOTFOUND / $filename");
    }
} #serve_file

#
# server function that detects a request for an html page
# and tries to serve it. If a matching page exists in the html
# directory, it is served, otherwise it checks to see if a
# corresponding recipe exists in the recipes directory. If
# so, it builds a page from the 'page' template that is
# built to load the yaml constructed javascript, plus any
# corresponding css or javascript.
#
sub serve_html {
    my $c = shift;
    my $page = $c->req->url->to_abs->path;

    $page = ($page eq '' || $page eq '/') ? '/index.html' : $page;

    my $filename = "$root_directory/html$page";

    my $css = $filename;

    $c->app->log->debug( "**HTML** $page, $filename" );

    if ($page =~ /\.html$/) {
        if (-e $filename) {
            return serve_file( $c, $filename );
        }
        $page =~ s/.html$//;
        if (-e "$root_directory/recipes$page.yaml") {
            return $c->render( template => 'page',
                               yote     => $yote, # to load yote or note
                               yaml     => "/_$page" );
        }
        return $c->render(text => "recipe NOTFOUND / $root_directory/recipes$page.yaml / $filename");
    }

    # 404
    $c->render(text => "HTML NOTFOUND / '$page' / $filename");
} #serve_html

sub encode_fun {
    my ($node, $name, $funs) = @_;
    if (ref($node) eq 'HASH' && defined($node->{$name})) {
        my $val = $node->{$name};
        my $fid = @$funs;
        # remove accidental trailing ; for function delcarations
        if ($val =~ /;\s*$/) {
            $val =~ s/;\s*$//;
            warn "removing trailing ; from function delcaration";
        }

        push @$funs, $val;
        return $fid;
    }
} #encode_fun


sub encode_fun_hash {
    my ($node, $funs) = @_;

    if (ref $node eq 'HASH') {
        my $res = {};
        for my $name (keys %$node) {
            my $fid = @$funs;
            push @$funs, $node->{$name};
            $res->{$name} = $fid;
        }
        return $res;
    }
} #encode_fun_hash

sub build_recipe {
    my ($recipe_data, $funs, $filename) = @_;

    if (ref $recipe_data eq 'ARRAY') {
        $recipe_data = { contents => $recipe_data };
    }

    my $recipe = {};
    my $con = $recipe->{contents} = [];

    for my $node_data (@{$recipe_data->{contents}||[]}) {
        push @$con, build_node( $node_data, $funs, $filename );
    }

    encode_functions_and_attrs( $recipe, $recipe_data, $funs, $filename );

    return $recipe;
} #build_recipe

sub encode_functions_and_attrs {
    my ($node, $node_data, $funs, $filename) = @_;

    if ($node_data->{calculate}) {
        $node->{calculate} = encode_fun_hash( $node_data->{calculate}, $funs );
    }
    if ($node_data->{on}) {
        $node->{on} = encode_fun_hash( $node_data->{on}, $funs );
    }
    for my $field (keys %$node_data) {
        my $val = $node_data->{$field};
        if ($field =~ /^(functions)$/) {
            $node->{$field} = encode_fun_hash( $val, $funs );
        }
        elsif ($field =~ /^(onLoad|preLoad|if|elseif|foreach)$/) {
            $node->{$field} = encode_fun( $node_data, $field, $funs );
        }
        elsif ($field eq 'else') {
            $node->{$field} = 1;
        }
        elsif ($field =~ /^on_(.*)/) {
            $node->{on}{$1} = encode_fun( $node_data, $field, $funs );
        }
        elsif ($field =~ /^listen$/) {
            $node->{listen} = encode_fun( $node_data, $field, $funs );
        }
        elsif ($field =~ /^(data|forval|handle|internalContent)$/) {
            if ($field eq 'data') {
                transform_data( $node_data->{data}, $funs );
            }
            $node->{$field} = $val;
        }
        elsif ($field =~ /^for_placeholder_(.*)/) {
            # this is like contents, but targetted to a placeholder. only makes sense if
            # this is a component node
            $node->{placeholder_contents}{$1} = $val;
        }
        elsif ($field !~ /^(calculate|contents|forval)$/) {
            # assume an attribute for this case, (other calculate was already handled)
            if ($val =~ /^((\([^)]*\)|\w+)\s*=\>|function\s*\([^)]*\)\s*\{.*\}\s*$)/ ) {
                $node->{calculate}{$field} = encode_fun( $node_data, $field, $funs );
            } else {
                $node->{attrs}->{$field} = $val;
            }
        }
    }
} #encode_functions_and_attrs

sub build_node {
    my ($node_data, $funs, $filename) = @_;

    my $node = {};

    my ($tag, $data);
    if (ref $node_data eq 'HASH') {
        ($tag, $data) = %$node_data;
    } else {
        ($tag, $data) = ($node_data, {});
    }

    $node->{tag} = $tag;

    my $r = ref $data;
    if ($r eq 'ARRAY') {
        $data = { contents => $data };
    } elsif ($r ne 'HASH') {
        if (defined $data) {
            $data = { textContent => $data };
        } else {
            $data = {};
        }
    }

    if ($data->{contents}) {
        my $con = $node->{contents} = [];
        for my $data (@{$data->{contents}||[]}) {
            push @$con, build_node( $data, $funs, $filename );
        }
    }

    encode_functions_and_attrs( $node, $data, $funs, $filename );

    # get on_click, etc
    # get data, etc

    return $node;
} #build_node

# UGH, perl YAML turns all the data to strings
# turn obvious number into numbers and booleans into
# boolans. for json, \1 and \0 translat to true and
# false, respectively.
sub transform_data {
    my ($data, $funs) = @_;

    if ($data) {
        for my $fld (keys %$data) {
            my $val = $data->{$fld};
            if (! ref( $val ) ) {
                no warnings 'numeric';
                if ($val =~ /^((\([^)]*\)|\w+)\s*=\>|function\s*\([^)]*\)\s*\{.*\}\s*$)/) {
                    $data->{$fld} = 'c' . encode_fun( $data, $fld, $funs );
                } elsif ( (0 + $val) eq $val) {
                    if ($val =~ /[.]/) {
                        $data->{$fld} = "f$val";
                    } else {
                        $data->{$fld} = 'i'.int( $val );
                    }
                } elsif( $val =~ /^(true|yes|y|on)$/i ) {
                    $data->{$fld} = \1;
                } elsif( $val =~ /^(false|no|n|off)$/i ) {
                    $data->{$fld} = \0;
                } else {
                    $data->{$fld} = "s$val";
                }
            }
        }
    }
}

sub make_error {
    my $filename = shift;
    my $err = "$@";
    return q~let funs = []; let defaultFilename = 'ERROR'; let filespaces = ~
             . to_json( { ERROR => {
                 components => {},
                 data => {},
                 functions => {},
                 namespaces => {},
                 html => {
                     body => {
                         contents => [
                             {
                                 tag => 'h3',
                                 attrs => {
                                     textContent => "Error in file $filename",
                                 },
                             },
                             {
                                 tag => 'div',
                                 contents => [
                                     { tag => 'p',
                                       attrs => { textContent => $err }
                                     }
                                     ]
                             }
                             ]
                     },
                 },
                          } } ) .';';
}

#
# 
#
sub yaml_to_js {
    my ($yaml_root_directory,$filename) = @_;
    $root_directory = $yaml_root_directory;

    my $funs       = [];
    my $filespaces = {};

    my $js = '';
    eval {
        my $default_filename = [load_namespace( $filename, $filespaces, $funs )];
        $js = "let funs = [\n" . join(",", map { "\t$_" } @$funs) . "];\n" .
            "let filespaces = ".to_json( $filespaces ) . ";\n" .
            "let defaultFilename = ".to_json($default_filename)."[0];\n"; 
    };
    if ($@) {
        $js = make_error($filename);
    }
    # put the default_filename in an array so it can be json escaped, in case it has quotes or something crazy like that.
    print STDERR Data::Dumper->Dump([$js,"JS"]);
    return $js;
}

sub load_namespace {
    my ( $filename, $filespaces, $funs, $root_namespace ) = @_;
    my $yaml_file = "$root_directory/$filename";

    return $yaml_file if $filespaces->{$yaml_file};

    if (-e $yaml_file) {
        my $yaml = YAML::LoadFile( $yaml_file );
        my $namespace = { 
            namespaces => {},
        };

        $filespaces->{$yaml_file} = $namespace;

        $root_namespace //= $namespace;

        # css defined
        my $fn = $filename;
        $fn =~ s!/!_!g;
        $fn =~ s![.]!-!g;

        # check for imports
        if (my $imports = $yaml->{import}) {
            if (ref $imports eq 'HASH') {
                for my $ns (keys %$imports) {
                    if ($ns =~ /\./) {
                        die "namespace may not contain '.' and got '$ns'";
                    }
                    my $imp_filename = $imports->{$ns};
                    $namespace->{namespaces}{$ns} = load_namespace( "recipes/$imp_filename.yaml", $filespaces, $funs, $root_namespace );
                }
            } else {
                # array
                for my $imp (@$imports) {
                    for my $ns (keys %$imp) {
                        if ($ns =~ /\./) {
                            die "namespace may not contain '.' and got '$ns'";
                        }
                        my $imp_filename = $imp->{$ns};
                        $namespace->{namespaces}{$ns} = load_namespace( "recipes/$imp_filename.yaml", $filespaces, $funs, $root_namespace );
                    }
                }
            }
        }

        # encode functions, onLoad, preLoad
        $namespace->{functions} = encode_fun_hash( $yaml->{functions}, $funs ) || {};
        for my $fun (qw( onLoad preLoad listen )) {
            if ($namespace->{$fun}) {
                $namespace->{$fun} = encode_fun( $yaml, $fun, $funs );
            }
        }

        $namespace->{components} = {};
        for my $recipe_name (keys %{$yaml->{components}}) {
            die "recipe '$recipe_name' in '$yaml_file' may not have a '.' in the name" if $recipe_name =~ /\./;
            my $recipe = $yaml->{components}{$recipe_name};
            $namespace->{components}{$recipe_name} = build_recipe( $yaml->{components}{$recipe_name}, $funs, $filename );
        }

        $namespace->{data} = $yaml->{data} || {};
        transform_data( $namespace->{data}, $funs );

        my $body = $yaml->{body};

        if ($body) {

            if ($yaml->{title}) {
                $namespace->{html}{head}{title} = $yaml->{title};
            }

            for my $thing (qw( css javascript )) {
                if (ref $yaml->{include}{$thing} eq 'ARRAY') {
                    $namespace->{html}{head}{$thing} = $yaml->{include}{$thing};
                } 
                elsif ($yaml->{include}{$thing}) {
                    $namespace->{html}{head}{$thing} = [$yaml->{include}{$thing}];
                }
            }

            $namespace->{html}{body} = build_recipe( $body, $funs, $filename, $fn );
            
            for my $targ (qw( listen onLoad preLoad )) {
                if ($yaml->{$targ}) {
                    $namespace->{html}{body}{$targ} = encode_fun($yaml, $targ, $funs);
                }
            }
        } #if a body

        my @css;
        if ($yaml->{css}) {
            push @css, $yaml->{css};
        }
        if ($yaml->{less}) {
            push @css, CSS::LESSp->parse( $yaml->{less} );
        }
        if (@css) {
            $root_namespace->{html}{head}{style} .= join( '', @css );
        }
        if ($yaml->{javascript}) {
            $root_namespace->{html}{head}{script} .= $yaml->{javascript};
        }
    }
    return $yaml_file;
} #load_namespace

#
# Loads in yaml corresponding to the path, builds a javascript
# page from that and serves that.
# 
sub serve_recipe {
    my ($c,$page) = @_;
    $page //= $c->req->url->to_abs->path;
    $page =~ s~^/_/~/~;

    my $js = yaml_to_js( $root_directory, "recipes$page.yaml" );

    if ($js) {
        $c->res->headers->content_type( "text/javascript" );
        return $c->render(text => $js);
    }

    # 404
    $c->render(text => "YAML NOTFOUND / $page");
} #serve_recipe

sub prepare_handlers {
    my ($pkg, $spider_root, $mojo_app, $use_yote) = @_;

    $root_directory = $spider_root;

    for my $sdir (qw( log img res css recipes)) {
        my $dir = "$root_directory/$sdir";
        -d $dir or mkdir $dir;
    }

    $yote = $use_yote;

    push @{$mojo_app->renderer->paths}, "$root_directory/templates";

    my $routes = $mojo_app->routes;

    $routes->get( '/js/*' => sub { serve_file( shift,
                                     undef,
                                     'text/javascript') } );

    $routes->get ('/img/*' => \&serve_file);
    $routes->get ('/res/*' => \&serve_file);
    $routes->get ('/css/*' => \&serve_file);
    $routes->get ('/recipes/*' => sub {
	my $c = shift;
	my $filename = "$root_directory".$c->req->url->to_abs->path;
	serve_file( $c, $filename, 'text/plain' );
    } );

    $routes->any ('/_/*' => \&serve_recipe);

    $routes->get ( '/' => sub {
        my $c = shift;
        #    $c->render(text => "rooo");
        serve_html( $c, '/index.html' );
    } );

    $routes->get ('/*' => \&serve_html);

} #prepare_handlers

#
# Active the server
#
sub launch {
    my ($pkg,$root_dir,$mojo_app) = @_;
    $pkg->prepare_handlers( $root_dir, $mojo_app );
    $mojo_app->start;
} #launch

1;
