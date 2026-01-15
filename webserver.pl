#!/usr/bin/env perl

use strict;
use warnings;
use IO::Socket::INET;
use JSON::PP;
use File::Basename;
use File::Spec;

# Directory for page YAML files
my $PAGES_DIR = File::Spec->catdir(dirname(__FILE__), 'pages');

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

# Load a page from the pages directory
sub load_page {
    my ($path) = @_;

    # Normalize path: / or /index.html -> index
    $path =~ s|^/||;
    $path =~ s|\.html$||;
    $path = 'index' if $path eq '' || $path eq 'index.html';

    my $yaml_file = File::Spec->catfile($PAGES_DIR, "$path.yaml");

    return undef unless -f $yaml_file;

    open my $fh, '<', $yaml_file or return undef;
    my $content = do { local $/; <$fh> };
    close $fh;

    return parse_yaml($content);
}

# Build full HTML document from page data
sub build_html {
    my ($page_data) = @_;

    my $title = $page_data->{title} // 'Untitled';
    my $body  = $page_data->{html}  // '';

    return <<"HTML";
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$title</title>
</head>
<body>
$body</body>
</html>
HTML
}

# Function that takes HTML text and returns a data structure
sub parse_html {
    my ($html) = @_;

    my %result = (
        doctype => undef,
        elements => [],
        'text-content' => '',
    );

    # Extract doctype if present
    if ($html =~ /^\s*<!DOCTYPE\s+([^>]+)>/i) {
        $result{doctype} = $1;
    }

    # Extract all tags with their attributes
    my @elements;

    while ($html =~ /<([^\s>\/]+)([^>]*)>/g) {
        my $tag_name = $1;
        my $attr_str = $2 // '';

        next if $tag_name =~ /^!/;  # Skip comments/doctype

        my %attrs;
        while ($attr_str =~ /(\w+)="([^"]*)"/g) {
            $attrs{$1} = $2;
        }

        push @elements, {
            tag => lc($tag_name),
            attributes => \%attrs,
        };
    }
    $result{elements} = \@elements;

    # Extract text content (strip all tags)
    my $text = $html;
    $text =~ s/<[^>]*>//g;
    $text =~ s/^\s+|\s+$//g;
    $result{'text-content'} = $text;

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

                # Load page from YAML file
                my $page_data = load_page($path);
                my $response;

                if (defined $page_data) {
                    my $body = build_html($page_data);
                    my $content_length = length($body);
                    $response = "HTTP/1.1 200 OK\r\n";
                    $response .= "Content-Type: text/html; charset=utf-8\r\n";
                    $response .= "Content-Length: $content_length\r\n";
                    $response .= "Connection: close\r\n";
                    $response .= "\r\n";
                    $response .= $body;
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
