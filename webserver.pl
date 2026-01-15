#!/usr/bin/env perl

use strict;
use warnings;
use IO::Socket::INET;
use JSON::PP;
use File::Basename;
use File::Spec;

# Directory for page YAML files
my $PAGES_DIR = File::Spec->catdir(dirname(__FILE__), 'pages');

# Webserver root path prefix (default: empty)
my $WEBSERVER_ROOT = '';

# Simple YAML parser for our format:
#   - key: value (single line)
#   - key: | (multiline string)
#   - key: (nested map with indented key: value pairs)
sub parse_yaml {
    my ($content) = @_;
    my %result;

    my @lines = split /\n/, $content;
    my $current_key;
    my $mode = 'none';  # 'none', 'multiline', 'map'
    my @multiline_content;
    my %map_content;

    for my $line (@lines) {
        # Check for top-level key (no leading whitespace)
        if ($line =~ /^(\w+):\s*\|\s*$/) {
            # Multiline string: key: |
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content);
            $current_key = $1;
            $mode = 'multiline';
            @multiline_content = ();
        } elsif ($line =~ /^(\w+):\s*$/) {
            # Nested map: key: (nothing after)
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content);
            $current_key = $1;
            $mode = 'map';
            %map_content = ();
        } elsif ($line =~ /^(\w+):\s*(.+)$/) {
            # Single line: key: value
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content);
            $result{$1} = $2;
            $mode = 'none';
            $current_key = undef;
        } elsif ($mode eq 'multiline' && $line =~ /^  (.*)$/) {
            # Indented content for multiline
            push @multiline_content, $1;
        } elsif ($mode eq 'map' && $line =~ /^  (\w+):\s*(.*)$/) {
            # Indented key: value for nested map
            $map_content{$1} = $2;
        }
    }

    # Save final block
    _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content);

    return \%result;
}

sub _save_block {
    my ($result, $key, $mode, $multiline, $map) = @_;
    return unless defined $key;

    if ($mode eq 'multiline') {
        $result->{$key} = join("\n", @$multiline);
    } elsif ($mode eq 'map') {
        $result->{$key} = { %$map };
    }
}

# Extract condition functions from structure, replace with indices
sub extract_conditions {
    my ($node, $conditions) = @_;

    return unless ref $node eq 'HASH';

    # Handle if/elseif condition extraction
    if ($node->{tag} && ($node->{tag} eq 'if' || $node->{tag} eq 'elseif')) {
        if (exists $node->{attributes}{condition}) {
            my $condition = $node->{attributes}{condition};
            push @$conditions, $condition;
            $node->{attributes}{_conditionIndex} = $#$conditions;
            delete $node->{attributes}{condition};
        }
    }

    # Recurse into children (top-level uses 'elements', element nodes use 'children')
    my $children = $node->{children} // $node->{elements} // [];
    for my $child (@$children) {
        extract_conditions($child, $conditions);
    }
}

# Extract event handler functions from structure, replace with indices
sub extract_handlers {
    my ($node, $handlers) = @_;

    return unless ref $node eq 'HASH';

    # Handle event handler attributes (onClick, onMouseOver, etc.)
    if ($node->{attributes}) {
        for my $attr (keys %{$node->{attributes}}) {
            if ($attr =~ /^on[A-Z]/) {
                my $handler = $node->{attributes}{$attr};
                push @$handlers, { event => $attr, handler => $handler };
                $node->{attributes}{"_${attr}Index"} = $#$handlers;
                delete $node->{attributes}{$attr};
            }
        }
    }

    # Recurse into children (top-level uses 'elements', element nodes use 'children')
    my $children = $node->{children} // $node->{elements} // [];
    for my $child (@$children) {
        extract_handlers($child, $handlers);
    }
}

# Load a page from the pages directory
sub load_page {
    my ($path) = @_;

    # Normalize path: / or /index.html -> index
    $path =~ s|^/||;
    $path =~ s|\.html$||;
    $path =~ s|\.yaml$||;
    $path = 'index' if $path eq '' || $path eq 'index.html';

    my $yaml_file = File::Spec->catfile($PAGES_DIR, "$path.yaml");

    return undef unless -f $yaml_file;

    open my $fh, '<', $yaml_file or return undef;
    my $content = do { local $/; <$fh> };
    close $fh;

    return parse_yaml($content);
}

# Recursively resolve imports, loading each page only once
sub resolve_imports {
    my ($page_data, $loaded) = @_;
    $loaded //= {};

    my $imports = $page_data->{import} // {};

    for my $namespace (keys %$imports) {
        next if exists $loaded->{$namespace};  # Already loaded

        my $import_path = $imports->{$namespace};
        my $imported_page = load_page($import_path);

        if ($imported_page) {
            $loaded->{$namespace} = $imported_page;
            # Recursively resolve imports from this page
            resolve_imports($imported_page, $loaded);
        }
    }

    return $loaded;
}

# Directory for static files
my $STATIC_DIR = dirname(__FILE__);

# Generate JavaScript classes for all loaded pages
sub generate_js_classes {
    my ($loaded_pages) = @_;

    my @classes;

    for my $namespace (sort keys %$loaded_pages) {
        my $page = $loaded_pages->{$namespace};
        my $class_name = ucfirst($namespace);

        # Escape for JavaScript strings
        my $title = $page->{title} // '';
        my $html_raw = $page->{html} // '';
        my $html = $html_raw;
        $title =~ s/\\/\\\\/g; $title =~ s/'/\\'/g;
        $html =~ s/\\/\\\\/g; $html =~ s/'/\\'/g;
        $html =~ s/\n/\\n/g;

        # Parse HTML to structure
        my $structure = parse_html($html_raw);

        # Extract conditions and replace with indices
        my @conditions;
        extract_conditions($structure, \@conditions);

        # Extract event handlers and replace with indices
        my @handlers;
        extract_handlers($structure, \@handlers);

        my $structure_json = encode_json($structure);

        # Build conditions array as actual JS functions
        my $conditions_js = '[' . join(', ', @conditions) . ']';

        # Build handlers array as actual JS functions
        my @handler_entries;
        for my $h (@handlers) {
            push @handler_entries, "{ event: '$h->{event}', handler: $h->{handler} }";
        }
        my $handlers_js = '[' . join(', ', @handler_entries) . ']';

        # Build imports mapping (namespace -> ClassName)
        my $imports_obj = '{}';
        if ($page->{import} && keys %{$page->{import}}) {
            my @import_pairs;
            for my $imp_name (sort keys %{$page->{import}}) {
                my $imp_class = ucfirst($imp_name);
                push @import_pairs, "$imp_name: $imp_class";
            }
            $imports_obj = '{ ' . join(', ', @import_pairs) . ' }';
        }

        # Build vars object and generate get_/set_ methods
        my $vars_json = '{}';
        my @var_methods;
        if ($page->{vars} && keys %{$page->{vars}}) {
            $vars_json = encode_json($page->{vars});
            for my $var_name (sort keys %{$page->{vars}}) {
                push @var_methods, "    get_$var_name(defaultValue) { return this.get('$var_name', defaultValue); }";
                push @var_methods, "    set_$var_name(value) { return this.set('$var_name', value); }";
            }
        }

        # Build custom methods
        my @custom_methods;
        if ($page->{methods} && keys %{$page->{methods}}) {
            for my $method_name (sort keys %{$page->{methods}}) {
                my $method_code = $page->{methods}{$method_name};
                push @custom_methods, "    $method_name = $method_code;";
            }
        }

        my $methods_str = '';
        if (@var_methods || @custom_methods) {
            $methods_str = "\n" . join("\n", @var_methods, @custom_methods) . "\n";
        }

        push @classes, "class $class_name extends Module {\n    title = '$title';\n    html = '$html';\n    structure = $structure_json;\n    vars = $vars_json;\n    imports = $imports_obj;\n    conditions = $conditions_js;\n    handlers = $handlers_js;$methods_str}";
    }

    return join("\n\n", @classes);
}

# Build full HTML document from page data
sub build_html {
    my ($page_data, $page_name) = @_;
    $page_name //= 'page';

    my $title = $page_data->{title} // 'Untitled';
    my $class_name = ucfirst($page_name);

    # Resolve imports and generate JavaScript classes
    my $loaded_pages = resolve_imports($page_data);

    # Add the main page itself
    $loaded_pages->{$page_name} = $page_data;

    my $js_classes = generate_js_classes($loaded_pages);

    my $script = '';
    if ($js_classes) {
        $script = "<script>\n$js_classes\n</script>";
    }

    my $init_script = <<"INIT";
<script>
document.addEventListener('DOMContentLoaded', function() {
    const page = new $class_name();
    page.initUI();
});
</script>
INIT

    my $spiderpup_src = $WEBSERVER_ROOT ? "$WEBSERVER_ROOT/spiderpup.js" : "spiderpup.js";

    return <<"HTML";
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$title</title>
    <script src="$spiderpup_src"></script>
    $script
    $init_script
</head>
<body>
</body>
</html>
HTML
}

# Function that takes HTML text and returns a hierarchical data structure
sub parse_html {
    my ($html) = @_;

    my %result = (
        doctype => undef,
        elements => [],
    );

    # Extract doctype if present
    if ($html =~ /^\s*<!DOCTYPE\s+([^>]+)>/i) {
        $result{doctype} = $1;
    }

    # Self-closing tags
    my %void_tags = map { $_ => 1 } qw(area base br col embed hr img input link meta param source track wbr);

    # Parse HTML into hierarchical structure
    my @stack = (\%result);  # Stack of parent elements
    my $pos = 0;

    while ($html =~ /(<(?:[^>"']|"[^"]*"|'[^']*')+>|[^<]+)/g) {
        my $token = $1;

        if ($token =~ /^<\/(\w+)>$/) {
            # Closing tag - pop stack
            my $tag = lc($1);
            pop @stack if @stack > 1;
        }
        elsif ($token =~ /^<(\w+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>$/) {
            # Opening tag
            my $tag = lc($1);
            my $attr_str = $2 // '';
            my $self_close = $3;

            next if $tag =~ /^!/;  # Skip comments/doctype

            my %attrs;
            while ($attr_str =~ /(\w+)="([^"]*)"/g) {
                $attrs{$1} = $2;
            }

            my $element = {
                tag => $tag,
                attributes => \%attrs,
                children => [],
            };

            # Add to current parent's children
            my $parent = $stack[-1];
            push @{$parent->{elements} // $parent->{children}}, $element;

            # Push onto stack unless self-closing or void element
            unless ($self_close || $void_tags{$tag}) {
                push @stack, $element;
            }
        }
        elsif ($token !~ /^\s*$/) {
            # Text node (non-empty)
            my $text = $token;
            $text =~ s/^\s+|\s+$//g;
            if ($text ne '') {
                my $parent = $stack[-1];
                push @{$parent->{elements} // $parent->{children}}, {
                    type => 'text',
                    content => $text,
                };
            }
        }
    }

    return \%result;
}

# HTML content for the hello world page
my $hello_html = <<'HTML';
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to the Perl web server.</p>
</body>
</html>
HTML

# Simple HTTP server
sub run_server {
    my ($port) = @_;
    $port //= 5000;

    my $listener = IO::Socket::INET->new(
        LocalAddr => '0.0.0.0',
        LocalPort => $port,
        Proto     => 'tcp',
        Listen    => SOMAXCONN,
        Reuse     => 1,
    ) or die "Cannot create socket: $!";

    print "Server running on http://localhost:$port\n";
    print "Press Ctrl+C to stop.\n";

    while (my $conn = $listener->accept) {
        # Fork to handle concurrent connections (simpler than Raku's 'start')
        my $pid = fork();

        if (!defined $pid) {
            warn "Fork failed: $!";
            $conn->close;
            next;
        }

        if ($pid == 0) {
            # Child process
            $listener->close;  # Child doesn't need listener

            eval {
                my $request = '';
                $conn->recv($request, 8192);

                # Parse the request line
                my ($request_line) = split(/\r?\n/, $request, 2);
                $request_line //= '';
                my ($method, $path, $version) = split(/\s+/, $request_line);

                print "Request: $method $path\n";

                my $response;

                # Serve static JS files
                if ($path =~ /^\/(.+\.js)$/) {
                    my $js_file = File::Spec->catfile($STATIC_DIR, $1);
                    if (-f $js_file) {
                        open my $fh, '<', $js_file or die "Cannot open $js_file: $!";
                        my $body = do { local $/; <$fh> };
                        close $fh;
                        my $content_length = length($body);
                        $response = "HTTP/1.1 200 OK\r\n";
                        $response .= "Content-Type: application/javascript; charset=utf-8\r\n";
                        $response .= "Content-Length: $content_length\r\n";
                        $response .= "Connection: close\r\n";
                        $response .= "\r\n";
                        $response .= $body;
                    }
                }

                # Load page from YAML file
                if (!$response) {
                    my $page_data = load_page($path);

                    if (defined $page_data) {
                        # Get page name from path for the class name
                        my $page_name = $path;
                        $page_name =~ s|^/||;
                        $page_name =~ s|\.html$||;
                        $page_name =~ s|\.yaml$||;
                        $page_name = 'index' if $page_name eq '';

                        my $body = build_html($page_data, $page_name);
                        my $content_length = length($body);
                        $response = "HTTP/1.1 200 OK\r\n";
                        $response .= "Content-Type: text/html; charset=utf-8\r\n";
                        $response .= "Content-Length: $content_length\r\n";
                        $response .= "Connection: close\r\n";
                        $response .= "\r\n";
                        $response .= $body;
                        print STDERR Data::Dumper->Dump([$body]);
                    } else {
                        my $not_found = "<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>";
                        my $content_length = length($not_found);
                        $response = "HTTP/1.1 404 Not Found\r\n";
                        $response .= "Content-Type: text/html; charset=utf-8\r\n";
                        $response .= "Content-Length: $content_length\r\n";
                        $response .= "Connection: close\r\n";
                        $response .= "\r\n";
                        $response .= $not_found;
                    }
                }

                $conn->send($response);
            };
            if ($@) {
                warn "Error handling request: $@";
            }

            $conn->close;
            exit(0);  # Child exits
        }

        # Parent process
        $conn->close;  # Parent doesn't need this connection
    }
}

# Reap zombie child processes
$SIG{CHLD} = 'IGNORE';

# Demo the parse_html function
sub main {
    my $demo = grep { $_ eq '--demo' } @ARGV;

    # Parse --root argument
    for my $i (0 .. $#ARGV) {
        if ($ARGV[$i] eq '--root' && defined $ARGV[$i + 1]) {
            $WEBSERVER_ROOT = $ARGV[$i + 1];
        }
    }

    if ($demo) {
        print "Parsing hello_html:\n";
        my $parsed = parse_html($hello_html);
        use Data::Dumper;
        print Dumper($parsed);
        print "\n";
    }

    run_server(5000);
}

main();
