package Yote::SpiderPup;

use strict;
use warnings;

use Data::Dumper;

use File::Slurp;
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

#
# in a node, moves the nameds function of a hash (if any)
# into the $funs array and then replaces thm with
# their indexes in the $funs array
#
sub transform_fun_hash {
    my ($node, $funs) = @_;
    if ($node) {
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
# pulls out the functions in a recipe to the funs array and replaces them
# with that index in the funs array they were pulled to. Also transforms
# the data into numbers when appropriate.
#
sub transform_recipe {
    my ($node, $funs) = @_;
    if(ref( $node ) eq 'ARRAY') {
       for my $ingdef (@$node) {
            my ($ingredient) = ref $ingdef eq 'HASH' ? values %$ingdef : $ingdef;
            transform_recipe($ingredient, $funs);
        }
    }
    elsif(ref( $node ) eq 'HASH') {
        transform_fun_hash( $node->{methods}, $funs );
        transform_fun_hash( $node->{on}, $funs );
        transform_fun_hash( $node->{calculate}, $funs );
        transform_fun( $node, 'if', $funs );
        transform_fun( $node, 'elseif', $funs );
        transform_fun( $node, 'foreach', $funs );
        transform_data( $node->{data} );
        transform_recipe( $node->{contents}, $funs );
        transform_fun_hash( $node->{functions}, $funs );
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
        "const defaultNamespace = ".to_json($default_filename)."[0];\n"; # put the default_filename in an array so it can be json escaped

#    print STDERR "$js\n";

    return $js;
}

sub load_namespace {
    my ( $root, $filename, $filespaces, $funs ) = @_;

    my $yaml_file = "$root/$filename";

    return $yaml_file if $filespaces->{$yaml_file};

    if (-e $yaml_file) {
        my $yaml = YAML::LoadFile( $yaml_file );
        $yaml->{namespaces} //= {};

        # check for imports
        if (my $imports = $yaml->{import}) {
            for my $imp (@$imports) {
                my ($imp_filename) = keys %$imp;
                my $namespace = $imp->{$imp_filename};

                $yaml->{namespaces}{$namespace} = load_namespace( $root, "include/$imp_filename.yaml", $filespaces, $funs );
            }
        }

        # functions and onLoad only appear in the root of the recipe
        transform_fun_hash( $yaml->{functions}, $funs );

        for my $recipe_name (keys %{$yaml->{components}}) {
            die "recipe '$recipe_name' in '$yaml_file' may not have a . in the name" if $recipe_name =~ /\./;
            my $recipe = $yaml->{components}{$recipe_name};
            transform_recipe( $recipe, $funs );
            transform_fun( $recipe, 'onLoad', $funs );
        }

        my $body = $yaml->{html}{body};
        $body && transform_recipe( $body, $funs );

        $filespaces->{$yaml_file} = $yaml;
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
    my ($pkg, $spider_root, $app) = @_;

    $root = $spider_root;

    push @{$app->renderer->paths}, "$root/templates";

    my $routes = $app->routes;

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
    my ($pkg,$root,$app) = @_;
    $pkg->prepare_handlers( $root, $app );
    $app->start;
} #launch

1;
