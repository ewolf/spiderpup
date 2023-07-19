package Yote::SpiderPup::Mojo;

use 5.14.0;

use Data::Dumper;

use File::LibMagic;
use File::Slurp;
use Scalar::Util qw( looks_like_number );

use base 'Yote::SpiderPup';

my $magic = File::LibMagic->new;

our $root_directory;
our $yote;

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

    $c->app->log->debug( "serving file '$filename'" );

    if (-e $filename) {
        my $text = read_file( $filename );
        if ($type) {
            $c->res->headers->content_type( $type );
        } elsif( $filename =~ /\.css$/ ) {
            $c->res->headers->content_type( 'text/css' );
        } else {
            my $info = $magic->info_from_filename( $filename );
            $c->res->headers->content_type( $info->{mime_type} );
        }
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
    my ($c,$page) = @_;
    $page //= $c->req->url->to_abs->path;

    $page = ($page eq '' || $page eq '/') ? '/index.html' : $page;

    my ($test) = ($page =~ s!^/(test)/!/!);

    my $filename = "$root_directory/html$page";

    $c->app->log->debug( "serving HTML '$filename' $test" );

    if ($page =~ /\.html$/) {
        if (-e $filename) {
            return serve_file( $c, $filename );
        }

        $page =~ s/.html$//;
        if (-e "$root_directory/recipes$page.yaml") {
            my $phash = $c->req->params->to_hash || {};
            my $yaml_url = $test ? "/_test$page" : "/_$page";
            print STDERR "Serving ($test) $yaml_url from $root_directory/recipes$page.yaml\n";
            return $c->render( template => 'page',
                               tests    => $test,
                               params   => Yote::SpiderPup::to_json($phash),
                               yote     => $yote, # to load yote or note
                               yaml     => $yaml_url );
        }
        return $c->render(text => "RECIPE NOT FOUND / '$root_directory/recipes$page.yaml' / '$filename'");
    }

    # 404
    $c->render(text => "HTML NOTFOUND / '$page' / $filename");
} #serve_html


#
# Loads in yaml corresponding to the path, builds a javascript
# page from that and serves that.
# 
sub serve_recipe {
    my ($c,$page) = @_;
    $page //= $c->req->url->to_abs->path;
    my ($test) = ($page =~ s~^/_test/~/~);
    $page =~ s~^/_/~/~;
    $c->app->log->debug( "SERVE '$page', from root '$root_directory', and recipe 'recipes$page.yaml'" );

    my $js = Yote::SpiderPup->yaml_to_js( $root_directory, "recipes$page.yaml", undef, $test );

    if ($js) {
        $c->res->headers->content_type( "text/javascript" );
        return $c->render(text => $js);
    }

    # 404
    $c->render(text => "YAML NOTFOUND / $page");
} #serve_recipe

sub prepare_handlers {
    my ($pkg, $spider_root, $mojo_app, $use_yote) = @_;

    warn "need to store the js result and check if the yaml file or cahed file are more recent";

    $mojo_app->log->debug( "Setting root directory to '$spider_root'" );
    $root_directory = $spider_root;
    
    # res -> file upload resource directory
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
    $routes->get ('/recipes/*' => 
                  sub {
                      my $c = shift;
                      my $filename = "$root_directory".$c->req->url->to_abs->path;
                      serve_file( $c, $filename, 'text/plain' );
                  } );

    $routes->any ('/_/*' => \&serve_recipe);
    $routes->any ('/_test/*' => \&serve_recipe);

    # $routes->any ('/test/*' => \&serve_html );

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
