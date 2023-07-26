package Yote::SpiderPup;

use 5.14.0;

use Data::Dumper;

use File::Slurp;
use CSS::LESSp;
use Scalar::Util qw( looks_like_number );

use YAML;

our %config;

my $default_yaml_loader = sub {
    my $yaml_file = shift;
    return -e $yaml_file && YAML::LoadFile( $yaml_file );
};

warn "try to validate the javascript snippets";
warn "CSS::LESSp has an infinite loop case";

sub build_recipe {
    my ($name, $recipe_data) = @_;

    if (ref $recipe_data eq 'ARRAY') {
        $recipe_data = { contents => $recipe_data };
    }
    
    my $recipe = {};
    my $con = $recipe->{contents} = [];

    if (@{$recipe_data->{contents}||[]} == 0) {
        die "recipe '$name' must contain contents";
    }

    for my $node_data (@{$recipe_data->{contents}}) {
        push @$con, build_node( $node_data );
    }

    encode_attrs( $recipe, $recipe_data );

    return $recipe;
} #build_recipe

sub encode_attrs {
    my ($node, $node_data) = @_;

    for my $field (keys %$node_data) {
        my $val = $node_data->{$field};
        if ($field =~ /^(data|elseif|fill|foreach|forvar|functions|listen|if|handle|postLoad|preLoad)$/) {
            $node->{$field} = $val;
        }
        elsif ($field eq 'else') {
            $node->{$field} = 1;
        }
        elsif ($field =~ /^on_(.*)/) {
            $node->{on}{$1} = $val;
        }
        elsif ($field =~ /^when_(.*)/) {
            $node->{when}{$1} = $val;
        }
        elsif ($field eq 'style') {
            my $style = $node->{attrs}{style} = {};
            for my $kv (split /\s*;\s*/, $val) {
                my ($k, $v) = split /\s*:\s*/, $kv;
                $style->{$k} = $v;
            }
        }
        elsif( $field ne 'contents' && $field ne 'fill_contents' ) {
            # is considered a property (and contents is handled elsewhere)
            $node->{attrs}{$field} = $val;
        }
    }
} #encode_attrs

sub build_node {
    my ($node_data) = @_;

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
        if (! defined($data)) {
            $data = {};
        } else {
            $data = { textContent => $data };
        }
    }

    if ($data->{contents}) {
        my $con = $node->{contents} = [];
        for my $con_data (@{$data->{contents}}) {
            push @$con, build_node( $con_data );
        }
    }
    
    if (my $fill_data = $data->{fill_contents}) {
        my $fill_con = $node->{fill_contents} = {};
        for my $fill_name (keys %{$data->{fill_contents}}) {
            my $con = $fill_con->{$fill_name} = [];
            for my $fill_con_data (@{$fill_data->{$fill_name}}) {
                push @$con, build_node( $fill_con_data );
            }
        }
    }

    encode_attrs( $node, $data );

    # get on_click, etc
    # get data, etc
    return $node;
} #build_node

sub make_error {
    my $filename = shift;
    my $err = "$@";
    return q~let filespaces = ~
             . to_json( { ERROR => {
                 recipes => {},
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
                          } } ) .";\nlet defaultFilename = \"ERROR\";";
}

sub to_string {
    my $txt = shift;

    $txt =~ s/\n/\\n/gs;
    $txt =~ s/\r/\\r/gs;
    $txt =~ s/"/\\"/gs;

    if ($txt =~ /^true$/i) {
        return "true";
    }
    elsif( $txt =~ /^false$/i) {
        return "false";
    }

    return "\"$txt\"";
}

sub to_json {
    my ($thing, $alphasort) = @_;
    if (ref $thing eq 'ARRAY') {
        return '[' . join( ',', map { to_json( $_, $alphasort) } @$thing ) . ']';
    }
    if (ref $thing eq 'HASH') {
        my @keys = $alphasort ? sort keys %$thing : keys %$thing;
        return '{' . join( ',', map { to_string($_) . ':' . to_json( $thing->{$_}, $alphasort ) } @keys ) . '}';
    }
    if ($thing =~ /^(\([^\)]*\)|[a-zA-Z]+)\s*=>\s*(.*)/s) {
        # TODO validate javascript?
        my ($args, $body) = ( $1, $2 );
        # snip off any trailing ; (common typo? maybe this, maybe not. TODO: consider removing this or adding a warning)
        $body =~ s/;\s*$//s; 
        if ($body !~ /^\{/) {
            # surround body with open and close parens for easy testing
            $body = "{return $body}";
        }
        return "$args=>$body";
    }
    if ($thing =~ /^\s*(async\s+)?function *\([^\)]*\)\s*\{.*\}/s) {
        return $thing;
    }
    if (looks_like_number($thing)) {
        # a number
        return $thing;
    }
    
    # escape the text
    return to_string($thing);

} #to_json


#
# 
#
sub yaml_to_js {
    my ($pkg,$yaml_root_directory,$filename, $alphasort, $include_tests) = @_;

    my $filespaces = {};

    my $js = '';
    eval {
        my $default_filename = load_namespace( $yaml_root_directory, $filename, $filespaces, undef, $default_yaml_loader, $include_tests );

        $js = "let filespaces = ".to_json( $filespaces, $alphasort ) . ";\n" .
            'let defaultFilename = '.to_string($default_filename).';';
    };
    if ($@) {
        $js = make_error($filename);
    }
    return $js;
}

sub load_namespace {
    my ( $root_directory, $filename, $filespaces, $root_namespace, $yaml_loader, $include_tests ) = @_;

    my $yaml_file = "$root_directory/$filename";

    # yes, return the name
    return $yaml_file if $filespaces->{$yaml_file};

    $yaml_loader //= $default_yaml_loader;

    my $yaml = $yaml_loader->( $yaml_file );

    if ($yaml) {

        my $namespace = { 
            namespaces => {},
            functions  => $yaml->{functions} || {},
            about      => $yaml->{about} || '',
            recipes    => {},
            data       => $yaml->{data} || {},
        };

        $filespaces->{$yaml_file} = $namespace;

        if (!$root_namespace) {
            $root_namespace = $namespace;

            # include any tests if there are any, but just for the root namespace
            $include_tests && $yaml->{test} && 
                ( $namespace->{test} = "async function() { $yaml->{test} }" );
        }

        # check for aliased imports
        if (my $imports = $yaml->{alias_namespaces}) {
            for my $ns (keys %$imports) {
                if ($ns =~ /\./) {
                    die "namespace may not contain '.' and got '$ns'";
                }
                my $imp_filename = $imports->{$ns};
                $namespace->{namespaces}{$ns} = load_namespace( $root_directory, "recipes/$imp_filename.yaml", $filespaces, $root_namespace, $yaml_loader );
            }
        }

        # check for imports directly to namespaces
        if (my $imports = $yaml->{import_namespaces}) {
            for my $ns (keys %$imports) {
                if ($ns =~ /\./) {
                    die "namespace may not contain '.' and got '$ns'";
                }
                my $imp_filename = $imports->{$ns};
                $namespace->{namespaces}{$ns} = load_namespace( $root_directory, "recipes/$imp_filename.yaml", $filespaces, $root_namespace, $yaml_loader );
            }
        }

        
        #
        # build the recipes
        #
        for my $recipe_name (keys %{$yaml->{recipes}}) {
            die "recipe '$recipe_name' in '$yaml_file' may not have a '.' in the name" if $recipe_name =~ /\./;
            my $recipe = $yaml->{recipes}{$recipe_name};
            $namespace->{recipes}{$recipe_name} = 
                build_recipe( $recipe_name, $yaml->{recipes}{$recipe_name}, $filename );
        }


        #
        # Attach css and javascript (both included and directly typed into
        # the yaml) to the root namespace which is the
        # one that would provide a body.
        #
        for my $thing (qw( css javascript javascript-module )) {
            if (ref $yaml->{include}{$thing} eq 'ARRAY') {
                push @{$root_namespace->{html}{head}{$thing}}, @{$yaml->{include}{$thing}};
            } 
            elsif ($yaml->{include}{$thing}) {
                push @{$root_namespace->{html}{head}{$thing}}, $yaml->{include}{$thing};
            }
        }
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


        my $page = $yaml->{page};
        my $body = $page->{body};

        if ($body) {

            $page->{javascript} && 
                ($root_namespace->{html}{head}{script} .= $page->{javascript});

            $page->{title} && 
                ($namespace->{html}{head}{title} = $page->{title});

            $namespace->{html}{body} = build_recipe( 'body', $body, $filename );
            for my $targ (qw( listen postLoad preLoad )) {
                if ($page->{$targ}) {
                    $namespace->{html}{body}{$targ} = $page->{$targ};
                }
            }
        } #if a body

        return $yaml_file;
    } #if yaml
} #load_namespace

1;
