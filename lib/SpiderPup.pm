package SpiderPup;

use strict;
use warnings;

use Data::Dumper;

use File::Slurp;
use JSON;
use Mojolicious::Lite;
use YAML;

my %config;
my $root;

sub serve_file {
    my ($c,$file,$type) = @_;
    if (! $file) {
        $file = "$root".$c->req->url->to_abs->path;
    }

    if (-e $file) {
        app->log->debug( "**FILE**, $file" );
        my $text = read_file( $file );
        $type && $c->res->headers->content_type( $type );
        return $c->render( text => $text );
    } else {
        # 404
        $c->render(text => "FILE NOTFOUND / $file");
    }
} #serve_file

sub serve_html {
    my $c = shift;
    my $page = $c->req->url->to_abs->path;

    $page = ($page eq '' || $page eq '/') ? '/index.html' : $page;
    
    my $file = "$root/html$page";

    my $css = $file;

    app->log->debug( "**HTML** $page, $file" );

    if ($page =~ /\.html$/) {
        if (-e $file) {
            return serve_file( $c, $file );
        }
        $page =~ s/.html$//;
        if (-e "$root/recipes/$page.yaml") {
            my $defjs = -e "$root/js$page.js" ? "/js$page.js" : '';            
            return $c->render( template => 'page',
                               css      => "/css$page.css",
                               js       => $defjs,
                               yaml     => "/_$page" );
        }
        return $c->render(text => "recipe NOTFOUND / $root/recipes/$page.yaml / $file");
    }

    # 404
    $c->render(text => "HTML NOTFOUND / '$page' / $file");
} #serve_html

sub transform_fun {
    my ($node, $name, $funs) = @_;
    if (ref($node) eq 'HASH' && $node->{$name}) {
        my $fid = @$funs;
        push @$funs, $node->{$name};
        $node->{$name} = $fid;
    }
}


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

sub yaml_to_js {
    my ($root,$file) = @_;
    my $yaml_file = "$root/recipes/$file";

    if (-e $yaml_file) {
        my $yaml = YAML::LoadFile( $yaml_file );

        # check for imported components
        if (my $file_imports = $yaml->{import}) {
            for my $i_file (@$file_imports) {
                my $i_yaml = YAML::LoadFile( "$root/include/$i_file.yaml" );
                if (my $compos = $i_yaml->{components}) {
                    for my $name (keys %$compos) {
                        $yaml->{components}{$name} = $compos->{$name};
                    }
                }
            }            
        }

        my $funs = [];

        # functions and onLoad only appear in the root of the recipe
        transform_fun_hash( $yaml->{functions}, $funs );

        for my $recipe (values %{$yaml->{components}||{}}) {
            transform_recipe( $recipe, $funs );
            transform_fun( $recipe, 'onLoad', $funs );
        }


        my $body = $yaml->{html}{body};
        $body && transform_recipe( $body, $funs );

        my $js = "const funs = [\n" . join("", map { chomp $_; "\t$_,\n" } @$funs) . "];\n" .
            "const instructions = ".to_json( $yaml  ).";\n";

        return $js;
    }

}

sub serve_recipe {
    my ($c,$page) = @_;
    $page //= $c->req->url->to_abs->path;
    $page =~ s~^/_/~/~;

    my $js = yaml_to_js( $root, "$page.yaml" );

print STDERR Data::Dumper->Dump([$js,"JS"]);

    if ($js) {
        $c->res->headers->content_type( "text/javascript" );
        return $c->render(text => $js);
    }

    # 404
    $c->render(text => "YAML NOTFOUND / $page");
} #serve_recipe


sub launch {
    my $pkg = shift;
    %config = @_;
    $root = $config{root};

    # yote call
    any '/yote' => sub {
        my $c = shift;

        $c->render(text => "/yote");
    };

    get '/js/*' => sub { serve_file( shift,
                                     undef,
                                     'text/javascript');
    };

    get '/img/*' => \&serve_file;
    get '/res/*' => \&serve_file;
    get '/css/*' => \&serve_file;
    get '/recipes/*' => sub {
	my $c = shift;
	my $file = "$root".$c->req->url->to_abs->path;
	serve_file( $c, $file, 'text/plain' );
    };

    any '/_/*' => \&serve_recipe;

    get '/' => sub {
        my $c = shift;
        #    $c->render(text => "rooo");
        serve_html( $c, '/index.html' );
    };

    get '/*' => \&serve_html;

    app->start;
} #launch

1;

__DATA__

@@ page.html.ep
<html>
  <head>
    <title></title>
    % if ( $js ) {
      <script src="<%= $js %>"></script>
    % }
    <script src="/js/spiderpup.js"></script>
    <script src="<%= $yaml %>"></script>
    <link rel="stylesheet" href="<%= $css %>" media="screen">
  </head>
  <body></body>
</html>
