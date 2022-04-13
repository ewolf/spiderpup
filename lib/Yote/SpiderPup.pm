package Yote::SpiderPup;

use strict;
use warnings;

use Data::Dumper;

use File::Slurp;
use CSS::LESSp;
use JSON;
use YAML;

my %config;
my $root;

#
# server function that serves up the named file and type.
# if no filename is given, try to detect via the request.
# if no file exists for the request, serve a 404.
#
sub serve_file {
    my ($c,$filename,$type) = @_;

    if (! $filename) {
        $filename = "$root".$c->req->url->to_abs->path;
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

    my $filename = "$root/html$page";

    my $css = $filename;

    $c->app->log->debug( "**HTML** $page, $filename" );

    if ($page =~ /\.html$/) {
        if (-e $filename) {
            return serve_file( $c, $filename );
        }
        $page =~ s/.html$//;
        if (-e "$root/recipes$page.yaml") {
            my $defjs  = -e "$root/js$page.js" ? "/js$page.js" : '';
            my $defcss = -e "$root/css$page.css" ? "/css$page.css" : '';
            return $c->render( template => 'page',
                               css      => $defcss,
                               js       => $defjs,
                               yaml     => "/_$page" );
        }
        return $c->render(text => "recipe NOTFOUND / $root/recipes$page.yaml / $filename");
    }

    # 404
    $c->render(text => "HTML NOTFOUND / '$page' / $filename");
} #serve_html

#
# in a node, moves the named function (if any) into
# the $funs array and then replaces it with its index
# in the $funs array
#
sub transform_fun {
    my ($node, $name, $funs) = @_;

    if (ref($node) eq 'HASH' && $node->{$name}) {
        my $fid = @$funs;
        push @$funs, $node->{$name};
        $node->{$name} = $fid;
    }
}

sub encode_fun {
    my ($node, $name, $funs) = @_;
    if (ref($node) eq 'HASH' && $node->{$name}) {
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
}


sub encode_fun_hash {
    my ($node, $funs) = @_;
    my $res = {};
    if (ref $node eq 'HASH') {
        for my $name (keys %$node) {
            my $fid = @$funs;
            push @$funs, $node->{$name};
            $res->{$name} = $fid;
        }
    }
    return $res;
}

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
}

sub encode_functions_and_attrs {
    my ($node, $node_data, $funs, $filename) = @_;
    my $attrs = $node->{attrs} = {};
    my $calculate = $node->{calculate} = encode_fun_hash( $node_data->{calculate}, $funs );
    my $on = $node->{on} = encode_fun_hash( $node_data->{on}, $funs );
    for my $field (keys %$node_data) {
        my $val = $node_data->{$field};
        if ($field =~ /^(functions)$/) {
            $node->{$field} = encode_fun_hash( $val, $funs );
        }
        elsif ($field =~ /^(onLoad|preLoad|if|elseif|else|foreach)$/) {
            $node->{$field} = encode_fun( $node_data, $field, $funs );
        }
        elsif ($field =~ /^on_(.*)/) {
            $on->{$1} = encode_fun( $node_data, $field, $funs );
        }
        elsif ($field !~ /^(calculate|contents|forval)$/) {
            # assume an attribute, and calculate was already handled
            if ($val =~ /^(\([^)]*\)\s*=\>|function\s*\([^)]*\)\s*\{.*\}\s*$)/ ) {
                $calculate->{$field} = encode_fun( $node_data, $field, $funs );
            } else {
                $attrs->{$field} = $val;
            }
        }
    }
}

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
        $data = { textContent => $data };
    }

    my $con = $node->{contents} = [];
    for my $data (@{$data->{contents}||[]}) {
        push @$con, build_node( $data, $funs, $filename );
    }

    encode_functions_and_attrs( $node, $data, $funs, $filename );

    # get on_click, etc
    # get data, etc

    return $node;
} #build_node

#
# in a node, moves the nameds function of a hash (if any)
# into the $funs array and then replaces them with
# their indexes in the $funs array
#
sub transform_fun_hash {
    my ($node, $funs) = @_;
    if (ref $node eq 'HASH') {
        for my $name (keys %$node) {
            my $fid = @$funs;
            push @$funs, $node->{$name};
            $node->{$name} = $fid;
        }
    }
}

# UGH, perl YAML turns all the data to strings
# turn obvious number into numbers and booleans into
# boolans. for json, \1 and \0 translat to true and
# false, respectively.
sub transform_data {
    my $data = shift;
    if ($data) {
        for my $fld (keys %$data) {
            my $val = $data->{$fld};
            no warnings 'numeric';
            if ( (0 + $val) eq $val) {
                $data->{$fld} = int( $val );
            } elsif( $val =~ /^(true|yes|y|on)$/i ) {
                $data->{$fld} = \1;
            } elsif( $val =~ /^(false|no|n|off)$/i ) {
                $data->{$fld} = \0;
            }
        }
    }
}

#
# 
#
sub yaml_to_js {
    my ($root,$filename) = @_;

    my $funs       = [];
    my $filespaces = {};

    my $default_filename = [load_namespace( $root, $filename, $filespaces, $funs )];

    my $js = "const funs = [\n" . join("", map { chomp $_; "\t$_,\n" } @$funs) . "];\n" .
        "const filespaces = ".to_json( $filespaces ) . ";\n" .
        "const defaultFilename = ".to_json($default_filename)."[0];\n"; 
    # put the default_filename in an array so it can be json escaped, in case it has quotes or something crazy like that.

    return $js;
}

sub load_namespace {
    my ( $root, $filename, $filespaces, $funs ) = @_;

    my $yaml_file = "$root/$filename";

    return $yaml_file if $filespaces->{$yaml_file};

    if (-e $yaml_file) {
        my $yaml = YAML::LoadFile( $yaml_file );

        my $namespace = { 
            namespaces => {},
        };

        $filespaces->{$yaml_file} = $namespace;

        # css defined
        my $fn = $filename;
        $fn =~ s!/!_!g;
        $fn =~ s![.]!-!g;

        if ($yaml->{css}) {
            my $less = ".$fn { $yaml->{css} }";
            my @css = CSS::LESSp->parse( $less );
            $namespace->{css} = join( '', @css );
        }

        # check for imports
        if (my $imports = $yaml->{import}) {
            for my $imp (@$imports) {
                my ($ns) = keys %$imp;
                if ($ns =~ /\./) {
                    die "namespace may not contain '.' and got '$ns'";
                }
                my $imp_filename = $imp->{$ns};

                $namespace->{namespaces}{$ns} = load_namespace( $root, "recipes/$imp_filename.yaml", $filespaces, $funs );
            }
        }

        # encode functions, onLoad, preLoad
        $namespace->{functions} = encode_fun_hash( $yaml->{functions}, $funs );
        for my $fun (qw( onLoad preLoad )) {
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

        my $body = $yaml->{html}{body};

        if ($body) {
            $body = $namespace->{html}{body} = build_recipe( $body, $funs, $filename, $fn );
            $body->{attrs}{class} .= " $fn";
        }
    }
    return $yaml_file;
}

#
# Loads in yaml corresponding to the path, builds a javascript
# page from that and serves that.
# 
sub serve_recipe {
    my ($c,$page) = @_;
    $page //= $c->req->url->to_abs->path;
    $page =~ s~^/_/~/~;

    my $js = yaml_to_js( $root, "recipes$page.yaml" );

    if ($js) {
        $c->res->headers->content_type( "text/javascript" );
        return $c->render(text => $js);
    }

    # 404
    $c->render(text => "YAML NOTFOUND / $page");
} #serve_recipe

sub prepare_handlers {
    my ($pkg, $spider_root, $mojo_app) = @_;

    $root = $spider_root;

    push @{$mojo_app->renderer->paths}, "$root/templates";

    my $routes = $mojo_app->routes;

    $routes->get( '/js/*' => sub { serve_file( shift,
                                     undef,
                                     'text/javascript') } );

    $routes->get ('/img/*' => \&serve_file);
    $routes->get ('/res/*' => \&serve_file);
    $routes->get ('/css/*' => \&serve_file);
    $routes->get ('/recipes/*' => sub {
	my $c = shift;
	my $filename = "$root".$c->req->url->to_abs->path;
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
    my ($pkg,$root,$mojo_app) = @_;
    $pkg->prepare_handlers( $root, $mojo_app );
    $mojo_app->start;
} #launch

1;
