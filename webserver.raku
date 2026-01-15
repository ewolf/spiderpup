#!/usr/bin/env raku

use v6;
use JSON::Fast;

# Function that takes HTML text and returns a data structure
sub parse-html(Str $html --> Hash) is export {
    my %result = (
        doctype => Nil,
        elements => [],
        text-content => '',
    );

    # Extract doctype if present
    if $html ~~ /^ \s* '<!DOCTYPE' \s+ (<-[>]>+) '>' / {
        %result<doctype> = ~$0;
    }

    # Extract all tags with their attributes
    my @elements;
    my $remaining = $html;

    for $html.comb(/ '<' (<-[>\/\s]>+) (<-[>]>*) '>' /) -> $match {
        if $match ~~ / '<' (<-[>\/\s]>+) (<-[>]>*) '>' / {
            my $tag-name = ~$0;
            my $attr-str = ~$1;

            next if $tag-name.starts-with('!');  # Skip comments/doctype

            my %attrs;
            for $attr-str.comb(/ (\w+) '="' (<-["]>*) '"' /) -> $attr {
                if $attr ~~ / (\w+) '="' (<-["]>*) '"' / {
                    %attrs{~$0} = ~$1;
                }
            }

            @elements.push: %(
                tag => $tag-name.lc,
                attributes => %attrs,
            );
        }
    }
    %result<elements> = @elements;

    # Extract text content (strip all tags)
    %result<text-content> = $html.subst(/ '<' <-[>]>* '>' /, '', :g).trim;

    return %result;
}

# HTML content for the hello world page
my $hello-html = q:to/HTML/;
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to the Raku web server.</p>
</body>
</html>
HTML

# Simple HTTP server
sub run-server(Int $port = 5000) {
    my $listener = IO::Socket::INET.new(
        :listen,
        :localhost('0.0.0.0'),
        :localport($port),
    );

    say "Server running on http://localhost:$port";
    say "Press Ctrl+C to stop.";

    loop {
        my $conn = $listener.accept;

        start {
            CATCH { default { .say } }

            my $request = $conn.recv;

            # Parse the request line
            my $request-line = $request.lines[0] // '';
            my ($method, $path, $version) = $request-line.split(/\s+/);

            say "Request: $method $path";

            # Prepare response
            my $body = $hello-html;
            my $response = qq:to/HTTP/;
            HTTP/1.1 200 OK
            Content-Type: text/html; charset=utf-8
            Content-Length: {$body.encode.bytes}
            Connection: close

            $body
            HTTP

            $conn.print($response);
            $conn.close;
        }
    }
}

# Demo the parse-html function
sub MAIN(Bool :$demo = False) {
    if 1 {
      say "HI HI";
      my %x = parse-html( "<body className=\"woofy boofy\"><div>Hello World</div></body>" );
      say to-json(%x);
      exit;
      say "BYBY";
    }
    if $demo {
        say "Parsing hello-html:";
        my %parsed = parse-html($hello-html);
        say %parsed.raku;
        say "";
    }

    run-server(5000);
}
