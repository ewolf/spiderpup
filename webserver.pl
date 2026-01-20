#!/usr/bin/env perl

use strict;
use warnings;
use IO::Socket::INET;
use JSON::PP;
use File::Basename;
use File::Spec;

# Color helper functions for LESS
sub hex_to_rgb {
    my ($hex) = @_;
    $hex =~ s/^#//;
    if (length($hex) == 3) {
        $hex = join('', map { $_ . $_ } split //, $hex);
    }
    return (
        hex(substr($hex, 0, 2)),
        hex(substr($hex, 2, 2)),
        hex(substr($hex, 4, 2))
    );
}

sub rgb_to_hex {
    my ($r, $g, $b) = @_;
    $r = 0 if $r < 0; $r = 255 if $r > 255;
    $g = 0 if $g < 0; $g = 255 if $g > 255;
    $b = 0 if $b < 0; $b = 255 if $b > 255;
    return sprintf("#%02x%02x%02x", int($r), int($g), int($b));
}

sub rgb_to_hsl {
    my ($r, $g, $b) = @_;
    $r /= 255; $g /= 255; $b /= 255;
    my $max = ($r > $g) ? (($r > $b) ? $r : $b) : (($g > $b) ? $g : $b);
    my $min = ($r < $g) ? (($r < $b) ? $r : $b) : (($g < $b) ? $g : $b);
    my ($h, $s, $l) = (0, 0, ($max + $min) / 2);

    if ($max != $min) {
        my $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
        if ($max == $r) {
            $h = (($g - $b) / $d + ($g < $b ? 6 : 0)) / 6;
        } elsif ($max == $g) {
            $h = (($b - $r) / $d + 2) / 6;
        } else {
            $h = (($r - $g) / $d + 4) / 6;
        }
    }
    return ($h, $s, $l);
}

sub hsl_to_rgb {
    my ($h, $s, $l) = @_;
    my ($r, $g, $b);

    if ($s == 0) {
        $r = $g = $b = $l;
    } else {
        my $hue2rgb = sub {
            my ($p, $q, $t) = @_;
            $t += 1 if $t < 0;
            $t -= 1 if $t > 1;
            return $p + ($q - $p) * 6 * $t if $t < 1/6;
            return $q if $t < 1/2;
            return $p + ($q - $p) * (2/3 - $t) * 6 if $t < 2/3;
            return $p;
        };
        my $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        my $p = 2 * $l - $q;
        $r = $hue2rgb->($p, $q, $h + 1/3);
        $g = $hue2rgb->($p, $q, $h);
        $b = $hue2rgb->($p, $q, $h - 1/3);
    }
    return (int($r * 255 + 0.5), int($g * 255 + 0.5), int($b * 255 + 0.5));
}

sub less_darken {
    my ($color, $amount) = @_;
    $amount =~ s/%//;
    $amount /= 100;
    my @rgb = hex_to_rgb($color);
    my ($h, $s, $l) = rgb_to_hsl(@rgb);
    $l = $l - $amount;
    $l = 0 if $l < 0;
    return rgb_to_hex(hsl_to_rgb($h, $s, $l));
}

sub less_lighten {
    my ($color, $amount) = @_;
    $amount =~ s/%//;
    $amount /= 100;
    my @rgb = hex_to_rgb($color);
    my ($h, $s, $l) = rgb_to_hsl(@rgb);
    $l = $l + $amount;
    $l = 1 if $l > 1;
    return rgb_to_hex(hsl_to_rgb($h, $s, $l));
}

sub less_mix {
    my ($color1, $color2, $weight) = @_;
    $weight //= '50%';
    $weight =~ s/%//;
    $weight /= 100;
    my @rgb1 = hex_to_rgb($color1);
    my @rgb2 = hex_to_rgb($color2);
    my @result = (
        $rgb1[0] * $weight + $rgb2[0] * (1 - $weight),
        $rgb1[1] * $weight + $rgb2[1] * (1 - $weight),
        $rgb1[2] * $weight + $rgb2[2] * (1 - $weight)
    );
    return rgb_to_hex(@result);
}

# Evaluate LESS math operations
sub evaluate_less_math {
    my ($expr) = @_;

    # Extract unit from first number
    my $unit = '';
    if ($expr =~ /(\d+(?:\.\d+)?)(px|em|rem|%|vh|vw|pt)/) {
        $unit = $2;
    }

    # Remove units for calculation
    my $calc = $expr;
    $calc =~ s/(px|em|rem|%|vh|vw|pt)//g;

    # Evaluate respecting precedence: * / before + -
    # Simple approach: split by + and -, evaluate each term
    $calc =~ s/\s+//g;

    # Handle multiplication and division first within each term
    my $eval_term = sub {
        my ($term) = @_;
        # Split by * and /
        my @parts = split /([*\/])/, $term;
        my $result = shift @parts;
        while (@parts >= 2) {
            my $op = shift @parts;
            my $val = shift @parts;
            if ($op eq '*') {
                $result *= $val;
            } elsif ($op eq '/') {
                $result = $val != 0 ? $result / $val : 0;
            }
        }
        return $result;
    };

    # Split by + and -, keeping operators
    my @tokens = split /([+-])/, $calc;
    my $result = $eval_term->(shift @tokens);

    while (@tokens >= 2) {
        my $op = shift @tokens;
        my $val = $eval_term->(shift @tokens);
        if ($op eq '+') {
            $result += $val;
        } elsif ($op eq '-') {
            $result -= $val;
        }
    }

    # Round to reasonable precision
    $result = int($result * 1000 + 0.5) / 1000;
    $result = int($result) if $result == int($result);

    return $result . $unit;
}

# Simple LESS compiler supporting variables, nesting, & parent selector, mixins, color functions, and math
sub compile_less {
    my ($less) = @_;
    my %variables;
    my %mixins;

    # First pass: extract and remove mixin definitions
    # Mixin format: .name(@param1, @param2) { body }
    while ($less =~ /(\.[a-zA-Z][\w-]*)\s*\(([^)]*)\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g) {
        my ($name, $params, $body) = ($1, $2, $3);
        my @param_names = map { s/^\s+|\s+$//gr } split /,/, $params;
        $mixins{$name} = { params => \@param_names, body => $body };
    }
    # Remove mixin definitions from source
    $less =~ s/\.[a-zA-Z][\w-]*\s*\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}//g;

    # Second pass: extract variables (@name: value;)
    while ($less =~ /(@[\w-]+)\s*:\s*([^;]+);/g) {
        $variables{$1} = $2;
    }
    # Remove variable declarations
    $less =~ s/@[\w-]+\s*:\s*[^;]+;\s*//g;

    # Substitute variables
    for my $var (keys %variables) {
        my $val = $variables{$var};
        $less =~ s/\Q$var\E/$val/g;
    }

    # Expand mixin calls: .name(args);
    for my $mixin_name (keys %mixins) {
        my $mixin = $mixins{$mixin_name};
        my $escaped_name = quotemeta($mixin_name);
        while ($less =~ /$escaped_name\s*\(([^)]*)\)\s*;/g) {
            my $args_str = $1;
            my @args = map { s/^\s+|\s+$//gr } split /,/, $args_str;
            my $expanded = $mixin->{body};
            # Substitute parameters
            for my $i (0 .. $#{$mixin->{params}}) {
                my $param = $mixin->{params}[$i];
                my $arg = $args[$i] // '';
                $expanded =~ s/\Q$param\E/$arg/g;
            }
            $less =~ s/$escaped_name\s*\([^)]*\)\s*;/$expanded/;
        }
    }

    # Process color functions: darken(@color, 10%), lighten(), mix()
    while ($less =~ /darken\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i) {
        my ($color, $amount) = ($1, $2);
        $color =~ s/^\s+|\s+$//g;
        $amount =~ s/^\s+|\s+$//g;
        my $result = less_darken($color, $amount);
        $less =~ s/darken\s*\(\s*[^,]+\s*,\s*[^)]+\s*\)/$result/i;
    }
    while ($less =~ /lighten\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i) {
        my ($color, $amount) = ($1, $2);
        $color =~ s/^\s+|\s+$//g;
        $amount =~ s/^\s+|\s+$//g;
        my $result = less_lighten($color, $amount);
        $less =~ s/lighten\s*\(\s*[^,]+\s*,\s*[^)]+\s*\)/$result/i;
    }
    while ($less =~ /mix\s*\(\s*([^,]+)\s*,\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/i) {
        my ($color1, $color2, $weight) = ($1, $2, $3);
        $color1 =~ s/^\s+|\s+$//g;
        $color2 =~ s/^\s+|\s+$//g;
        $weight = $weight ? do { $weight =~ s/^\s+|\s+$//g; $weight } : '50%';
        my $result = less_mix($color1, $color2, $weight);
        $less =~ s/mix\s*\(\s*[^,]+\s*,\s*[^,)]+(?:\s*,\s*[^)]+)?\s*\)/$result/i;
    }

    # Process math operations in property values
    # Match: property: value with math operators;
    $less =~ s/:\s*([^;{}]+(?:[+\-*\/][^;{}]+)+);/': ' . evaluate_less_math($1) . ';'/ge;

    # Parse and flatten nested rules
    return _flatten_less($less, '');
}

sub _flatten_less {
    my ($block, $parent_selector) = @_;
    my @output;
    my $depth = 0;
    my $current_selector = '';
    my $current_block = '';
    my $properties = '';
    my $pos = 0;

    # Tokenize: split into selector{...} chunks and properties
    while ($block =~ /\G\s*(?:([^{};]+?)\s*\{|([^{};]+;)|\})/gc) {
        if (defined $1) {
            # Opening a new block with selector
            if ($depth == 0) {
                $current_selector = $1;
                $current_selector =~ s/^\s+|\s+$//g;
                $current_block = '';
            } else {
                $current_block .= "$1 {";
            }
            $depth++;
        } elsif (defined $2) {
            # A property
            if ($depth == 0) {
                $properties .= $2;
            } elsif ($depth == 1) {
                $current_block .= $2;
            } else {
                $current_block .= $2;
            }
        } else {
            # Closing brace
            $depth--;
            if ($depth == 0 && $current_selector ne '') {
                # Resolve full selector
                my $full_selector;
                if ($current_selector =~ /&/) {
                    $full_selector = $current_selector;
                    $full_selector =~ s/&/$parent_selector/g;
                } elsif ($parent_selector) {
                    $full_selector = "$parent_selector $current_selector";
                } else {
                    $full_selector = $current_selector;
                }

                # Extract direct properties vs nested blocks
                my $direct_props = '';
                my $nested = '';
                my $inner_depth = 0;
                my $temp = '';

                for my $char (split //, $current_block) {
                    if ($char eq '{') {
                        $inner_depth++;
                        $temp .= $char;
                    } elsif ($char eq '}') {
                        $inner_depth--;
                        $temp .= $char;
                        if ($inner_depth == 0) {
                            $nested .= $temp;
                            $temp = '';
                        }
                    } elsif ($inner_depth > 0) {
                        $temp .= $char;
                    } elsif ($char eq ';') {
                        $direct_props .= $temp . ';';
                        $temp = '';
                    } else {
                        $temp .= $char;
                    }
                }
                # Remaining temp without semicolon might be selector start
                $nested = $temp . $nested if $temp =~ /\S/;

                # Output direct properties
                if ($direct_props =~ /\S/) {
                    push @output, "$full_selector { $direct_props }";
                }

                # Recursively process nested blocks
                if ($nested =~ /\S/) {
                    push @output, _flatten_less($nested, $full_selector);
                }

                $current_selector = '';
                $current_block = '';
            } elsif ($depth > 0) {
                $current_block .= '}';
            }
        }
    }

    # Handle any top-level properties (no selector)
    if ($properties =~ /\S/ && $parent_selector) {
        unshift @output, "$parent_selector { $properties }";
    } elsif ($properties =~ /\S/) {
        unshift @output, $properties;
    }

    return join("\n", @output);
}

# Directory for page YAML files
my $PAGES_DIR = File::Spec->catdir(dirname(__FILE__), 'pages');

# Webserver root path prefix (default: empty)
my $WEBSERVER_ROOT = '';

# Track file modification times for hot reload
my %file_mtimes;
my $last_change_time = 0;

# HTML compilation cache directory
my $CACHE_DIR = File::Spec->catdir(File::Spec->tmpdir(), 'spiderpup_cache');
mkdir $CACHE_DIR unless -d $CACHE_DIR;

sub update_file_mtimes {
    my $changed = 0;
    opendir(my $dh, $PAGES_DIR) or return 0;
    while (my $file = readdir($dh)) {
        next unless $file =~ /\.yaml$/;
        my $path = File::Spec->catfile($PAGES_DIR, $file);
        my $mtime = (stat($path))[9];
        if (!exists $file_mtimes{$path} || $file_mtimes{$path} != $mtime) {
            $file_mtimes{$path} = $mtime;
            $changed = 1;
        }
    }
    closedir($dh);
    if ($changed) {
        $last_change_time = time();
    }
    return $changed;
}

# Check if dev mode is enabled
sub is_dev_mode {
    return $ENV{SPIDERPUP_DEV} ? 1 : 0;
}

# Get cache file paths for a page
sub get_cache_paths {
    my ($page_name) = @_;
    my $safe_name = $page_name;
    $safe_name =~ s/[^a-zA-Z0-9_-]/_/g;
    return (
        html => File::Spec->catfile($CACHE_DIR, "$safe_name.html"),
        meta => File::Spec->catfile($CACHE_DIR, "$safe_name.meta"),
    );
}

# Collect all YAML files referenced by a page (including imports recursively)
sub collect_yaml_files {
    my ($page_data, $page_name, $collected) = @_;
    $collected //= {};

    # Add this page
    my $yaml_file = File::Spec->catfile($PAGES_DIR, "$page_name.yaml");
    if (-f $yaml_file) {
        $collected->{$yaml_file} = (stat($yaml_file))[9];
    }

    # Recursively collect imports
    my $imports = $page_data->{import} // {};
    for my $namespace (keys %$imports) {
        my $import_file = File::Spec->catfile($PAGES_DIR, "$namespace.yaml");
        next if exists $collected->{$import_file};
        my $import_path = $imports->{$namespace};
        my $imported_page = load_page($import_path);
        if ($imported_page) {
            collect_yaml_files($imported_page, $namespace, $collected);
        }
    }

    return $collected;
}

# Check if cached HTML is still valid (file-based)
sub is_cache_valid {
    my ($page_name, $page_data) = @_;
    my %paths = get_cache_paths($page_name);

    # Check if cache files exist
    return 0 unless -f $paths{html} && -f $paths{meta};

    # Read metadata (stored mtimes)
    open my $fh, '<', $paths{meta} or return 0;
    my $meta_content = do { local $/; <$fh> };
    close $fh;

    my $cached_mtimes;
    eval { $cached_mtimes = decode_json($meta_content); };
    return 0 if $@ || !$cached_mtimes;

    # Get current mtimes for all referenced files
    my $current_mtimes = collect_yaml_files($page_data, $page_name);

    # Check if file sets match and mtimes are unchanged
    return 0 if keys %$cached_mtimes != keys %$current_mtimes;

    for my $file (keys %$cached_mtimes) {
        return 0 unless exists $current_mtimes->{$file};
        return 0 if $current_mtimes->{$file} != $cached_mtimes->{$file};
    }

    return 1;
}

# Get cached HTML or build and cache it (file-based)
sub get_cached_html {
    my ($page_data, $page_name) = @_;
    my %paths = get_cache_paths($page_name);

    # Check cache validity
    if (is_cache_valid($page_name, $page_data)) {
        # Read cached HTML
        open my $fh, '<', $paths{html} or goto BUILD;
        my $html = do { local $/; <$fh> };
        close $fh;
        return $html;
    }

    BUILD:
    # Build HTML
    my $html = build_html($page_data, $page_name);

    # Collect all referenced YAML files and their mtimes
    my $mtimes = collect_yaml_files($page_data, $page_name);

    # Write cache files
    eval {
        open my $html_fh, '>', $paths{html} or die "Cannot write $paths{html}: $!";
        print $html_fh $html;
        close $html_fh;

        open my $meta_fh, '>', $paths{meta} or die "Cannot write $paths{meta}: $!";
        print $meta_fh encode_json($mtimes);
        close $meta_fh;
    };
    warn "Cache write failed: $@" if $@;

    return $html;
}

# Simple YAML parser for our format:
#   - key: value (single line)
#   - key: | (multiline string)
#   - key: (nested map with indented key: value pairs)
sub parse_yaml {
    my ($content) = @_;
    my %result;

    my @lines = split /\n/, $content;
    my $current_key;
    my $mode = 'none';  # 'none', 'multiline', 'map', 'array'
    my @multiline_content;
    my %map_content;
    my @array_content;

    for my $line (@lines) {
        # Check for top-level key (no leading whitespace)
        # Allow hyphenated keys like import-css, import-js
        if ($line =~ /^([\w-]+):\s*\|\s*$/) {
            # Multiline string: key: |
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content, \@array_content);
            $current_key = $1;
            $mode = 'multiline';
            @multiline_content = ();
        } elsif ($line =~ /^([\w-]+):\s*$/) {
            # Nested map or array: key: (nothing after)
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content, \@array_content);
            $current_key = $1;
            $mode = 'map';  # Will switch to 'array' if we see '- ' entries
            %map_content = ();
            @array_content = ();
        } elsif ($line =~ /^([\w-]+):\s*(.+)$/) {
            # Single line: key: value
            _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content, \@array_content);
            $result{$1} = $2;
            $mode = 'none';
            $current_key = undef;
        } elsif ($mode eq 'multiline' && $line =~ /^  (.*)$/) {
            # Indented content for multiline
            push @multiline_content, $1;
        } elsif (($mode eq 'map' || $mode eq 'array') && $line =~ /^  -\s+(.*)$/) {
            # Array item: - value
            $mode = 'array';
            push @array_content, $1;
        } elsif ($mode eq 'map' && $line =~ /^  (.+?):\s+(.*)$/) {
            # Indented key: value for nested map (keys can contain /, :, etc. for routes)
            # Use non-greedy match and require space after colon to handle keys like /path/:id
            my ($key, $val) = ($1, $2);
            # Parse JSON arrays/objects
            if ($val =~ /^\[.*\]$/ || $val =~ /^\{.*\}$/) {
                eval { $val = decode_json($val); };
            }
            $map_content{$key} = $val;
        }
    }

    # Save final block
    _save_block(\%result, $current_key, $mode, \@multiline_content, \%map_content, \@array_content);

    return \%result;
}

sub _save_block {
    my ($result, $key, $mode, $multiline, $map, $array) = @_;
    return unless defined $key;

    if ($mode eq 'multiline') {
        $result->{$key} = join("\n", @$multiline);
    } elsif ($mode eq 'array') {
        $result->{$key} = [ @$array ];
    } elsif ($mode eq 'map') {
        $result->{$key} = { %$map };
    }
}

# JavaScript globals (don't prefix with this.)
my %js_globals = map { $_ => 1 } qw(
    console Math JSON Date Array Object String Number Boolean
    parseInt parseFloat isNaN isFinite undefined null true false
    window document setTimeout setInterval clearTimeout clearInterval
    fetch Promise Error event target Map Set Symbol RegExp
    Infinity NaN arguments this
);

# Extract parameter names from arrow function syntax
sub extract_arrow_params {
    my ($expr) = @_;
    my %params;

    # Match arrow functions: (param1, param2) => or param =>
    while ($expr =~ /\(([^)]*)\)\s*=>/g) {
        my $param_str = $1;
        for my $param (split /,/, $param_str) {
            $param =~ s/^\s+|\s+$//g;
            $param =~ s/\s*=.*//;  # Remove default values
            $params{$param} = 1 if $param =~ /^\w+$/;
        }
    }
    # Single param without parens: x =>
    while ($expr =~ /\b(\w+)\s*=>/g) {
        $params{$1} = 1;
    }

    return \%params;
}

# Transform $var syntax to this.get_var() / this.set_var()
sub transform_dollar_vars {
    my ($expr) = @_;
    return $expr unless defined $expr;

    # Track positions to avoid transforming inside strings
    my @protected_ranges;

    # Find string literals (both single and double quoted)
    while ($expr =~ /(['"])(?:[^\\]|\\.)*?\1/g) {
        push @protected_ranges, [$-[0], $+[0]];
    }
    # Find template literals
    while ($expr =~ /`(?:[^\\`]|\\.)*`/g) {
        push @protected_ranges, [$-[0], $+[0]];
    }

    my $is_protected = sub {
        my ($pos) = @_;
        for my $range (@protected_ranges) {
            return 1 if $pos >= $range->[0] && $pos < $range->[1];
        }
        return 0;
    };

    # Process assignments: $var = value (but not == or ===)
    # Need to handle complex RHS with nested $vars
    my $result = '';
    my $pos = 0;

    while ($expr =~ /\$(\w+)\s*=(?!=)/g) {
        my $var_name = $1;
        my $match_start = $-[0];
        my $match_end = $+[0];

        if (!$is_protected->($match_start)) {
            # Find the end of the assignment (semicolon, comma, or closing paren/bracket at depth 0)
            my $rhs_start = $match_end;
            my $depth = 0;
            my $rhs_end = length($expr);

            for my $i ($rhs_start .. length($expr) - 1) {
                my $char = substr($expr, $i, 1);
                if ($char eq '(' || $char eq '[' || $char eq '{') {
                    $depth++;
                } elsif ($char eq ')' || $char eq ']' || $char eq '}') {
                    if ($depth == 0) {
                        $rhs_end = $i;
                        last;
                    }
                    $depth--;
                } elsif (($char eq ';' || $char eq ',') && $depth == 0) {
                    $rhs_end = $i;
                    last;
                }
            }

            my $rhs = substr($expr, $rhs_start, $rhs_end - $rhs_start);
            # Recursively transform $vars in RHS
            $rhs = transform_dollar_vars($rhs);

            $result .= substr($expr, $pos, $match_start - $pos);
            $result .= "this.set_$var_name($rhs)";
            $pos = $rhs_end;

            # Reset regex position
            pos($expr) = $pos;
        }
    }
    $result .= substr($expr, $pos);
    $expr = $result;

    # Process reads: $var (not followed by =)
    $expr =~ s/\$(\w+)(?!\s*=(?!=))/this.get_$1()/g;

    return $expr;
}

# Add implicit this. prefix to bare method calls
sub add_implicit_this {
    my ($expr, $local_vars) = @_;
    return $expr unless defined $expr;
    $local_vars //= {};

    # Track string positions to avoid transforming inside strings
    my @protected_ranges;
    while ($expr =~ /(['"])(?:[^\\]|\\.)*?\1/g) {
        push @protected_ranges, [$-[0], $+[0]];
    }
    while ($expr =~ /`(?:[^\\`]|\\.)*`/g) {
        push @protected_ranges, [$-[0], $+[0]];
    }

    my $is_protected = sub {
        my ($pos) = @_;
        for my $range (@protected_ranges) {
            return 1 if $pos >= $range->[0] && $pos < $range->[1];
        }
        return 0;
    };

    # Replace bare method calls: word( but not after . or preceded by known contexts
    my $result = '';
    my $last_end = 0;

    while ($expr =~ /\b(\w+)\s*\(/g) {
        my $name = $1;
        my $match_start = $-[1];
        my $match_end = $+[0];

        next if $is_protected->($match_start);

        # Check what precedes this identifier
        my $before = substr($expr, 0, $match_start);

        # Skip if preceded by . (already a method call on something)
        next if $before =~ /\.\s*$/;

        # Skip if preceded by 'new '
        next if $before =~ /\bnew\s+$/;

        # Skip if preceded by 'function '
        next if $before =~ /\bfunction\s+$/;

        # Skip JS globals
        next if $js_globals{$name};

        # Skip local variables (arrow params, for loop vars)
        next if $local_vars->{$name};

        # Skip if already has this.
        next if $before =~ /\bthis\.\s*$/;

        # Add this. prefix
        $result .= substr($expr, $last_end, $match_start - $last_end);
        $result .= "this.$name(";
        $last_end = $match_end;
    }

    $result .= substr($expr, $last_end);
    return $result;
}

# Main transformation function that applies all shorthand transformations
sub transform_expression {
    my ($expr) = @_;
    return $expr unless defined $expr && $expr =~ /\S/;

    my $local_vars = extract_arrow_params($expr);
    $expr = transform_dollar_vars($expr);
    $expr = add_implicit_this($expr, $local_vars);
    return $expr;
}

# Extract condition functions from structure, replace with indices
sub extract_conditions {
    my ($node, $conditions) = @_;

    return unless ref $node eq 'HASH';

    # Handle if/elseif condition extraction
    if ($node->{tag} && ($node->{tag} eq 'if' || $node->{tag} eq 'elseif')) {
        if (exists $node->{attributes}{condition}) {
            my $condition = transform_expression($node->{attributes}{condition});
            push @$conditions, $condition;
            $node->{attributes}{_conditionIndex} = $#$conditions;
            delete $node->{attributes}{condition};
        }
        # Preserve transition attribute
        if (exists $node->{attributes}{transition}) {
            $node->{attributes}{_transition} = $node->{attributes}{transition};
            delete $node->{attributes}{transition};
        }
    }

    # Handle link tag with to attribute
    if ($node->{tag} && $node->{tag} eq 'link') {
        if (exists $node->{attributes}{to}) {
            $node->{attributes}{_to} = $node->{attributes}{to};
            delete $node->{attributes}{to};
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

    # Handle event handler attributes (onClick, onMouseOver, etc.) and textContent functions
    if ($node->{attributes}) {
        for my $attr (keys %{$node->{attributes}}) {
            if ($attr =~ /^on[A-Z]/ || $attr eq 'textContent') {
                my $handler = transform_expression($node->{attributes}{$attr});
                push @$handlers, { event => $attr, handler => $handler };
                $node->{attributes}{"_${attr}Index"} = $#$handlers;
                delete $node->{attributes}{$attr};
            }
            # Handle bind attribute for two-way binding
            elsif ($attr eq 'bind') {
                my $var_name = $node->{attributes}{$attr};
                $node->{attributes}{_bind} = $var_name;
                delete $node->{attributes}{$attr};
            }
            # Handle ref attribute
            elsif ($attr eq 'ref') {
                $node->{attributes}{_ref} = $node->{attributes}{$attr};
                delete $node->{attributes}{$attr};
            }
            # Handle class:* bindings (class:active="condition")
            elsif ($attr =~ /^class:(.+)$/) {
                my $class_name = $1;
                my $condition = transform_expression($node->{attributes}{$attr});
                push @$handlers, { event => "class:$class_name", handler => $condition };
                $node->{attributes}{"_class:${class_name}Index"} = $#$handlers;
                delete $node->{attributes}{$attr};
            }
            # Handle style:* bindings (style:color="varName" or style:color="() => expr")
            elsif ($attr =~ /^style:(.+)$/) {
                my $style_prop = $1;
                my $value = $node->{attributes}{$attr};
                # Wrap simple variable names in a getter function
                if ($value !~ /^\s*\(/ && $value !~ /=>/) {
                    $value = "() => this.get_$value()";
                } else {
                    $value = transform_expression($value);
                }
                push @$handlers, { event => "style:$style_prop", handler => $value };
                $node->{attributes}{"_style:${style_prop}Index"} = $#$handlers;
                delete $node->{attributes}{$attr};
            }
            # Handle slot attribute for named slots (on content elements)
            elsif ($attr eq 'slot') {
                $node->{attributes}{_slot} = $node->{attributes}{$attr};
                delete $node->{attributes}{$attr};
            }
            # Handle dynamic function-based attributes (e.g., class="(module) => ...")
            elsif ($node->{attributes}{$attr} =~ /^\s*\(.*?\)\s*=>/ ||
                   $node->{attributes}{$attr} =~ /^\s*function\s*\(/) {
                my $func = transform_expression($node->{attributes}{$attr});
                push @$handlers, { event => "attr:$attr", handler => $func };
                $node->{attributes}{"_attr:${attr}Index"} = $#$handlers;
                delete $node->{attributes}{$attr};
            }
        }
    }

    # Handle slot tag's name attribute for named slots
    if ($node->{tag} && $node->{tag} eq 'slot') {
        if (exists $node->{attributes}{name}) {
            $node->{attributes}{_slotName} = $node->{attributes}{name};
            delete $node->{attributes}{name};
        }
    }

    # Recurse into children (top-level uses 'elements', element nodes use 'children')
    my $children = $node->{children} // $node->{elements} // [];
    for my $child (@$children) {
        extract_handlers($child, $handlers);
    }
}

# Extract loop items from structure, replace with indices
sub extract_loops {
    my ($node, $loops) = @_;

    return unless ref $node eq 'HASH';

    # Handle for loop items extraction
    if ($node->{tag} && $node->{tag} eq 'for') {
        if (exists $node->{attributes}{items}) {
            my $items = transform_expression($node->{attributes}{items});
            push @$loops, $items;
            $node->{attributes}{_itemsIndex} = $#$loops;
            delete $node->{attributes}{items};
        }
    }

    # Recurse into children (top-level uses 'elements', element nodes use 'children')
    my $children = $node->{children} // $node->{elements} // [];
    for my $child (@$children) {
        extract_loops($child, $loops);
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
        # Convert namespace to valid JS class name (remove hyphens, camelCase)
        my $class_name = $namespace;
        $class_name =~ s/-(.)/\U$1/g;  # Convert kebab-case to camelCase
        $class_name = ucfirst($class_name);

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

        # Extract loop items and replace with indices
        my @loops;
        extract_loops($structure, \@loops);

        my $structure_json = encode_json($structure);

        # Build conditions array as actual JS functions
        my $conditions_js = '[' . join(', ', @conditions) . ']';

        # Build handlers array as actual JS functions
        my @handler_entries;
        for my $h (@handlers) {
            push @handler_entries, "{ event: '$h->{event}', handler: $h->{handler} }";
        }
        my $handlers_js = '[' . join(', ', @handler_entries) . ']';

        # Build loops array (items can be arrays or functions)
        my $loops_js = '[' . join(', ', @loops) . ']';

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
                my $method_code = transform_expression($page->{methods}{$method_name});
                push @custom_methods, "    $method_name = $method_code;";
            }
        }

        # Build computed property getters
        my @computed_methods;
        if ($page->{computed} && keys %{$page->{computed}}) {
            for my $computed_name (sort keys %{$page->{computed}}) {
                my $computed_code = transform_expression($page->{computed}{$computed_name});
                push @computed_methods, "    get_$computed_name() { return ($computed_code).call(this); }";
            }
        }

        # Build watchers object
        my $watchers_js = '{}';
        if ($page->{watch} && keys %{$page->{watch}}) {
            my @watcher_pairs;
            for my $watch_name (sort keys %{$page->{watch}}) {
                my $watch_code = transform_expression($page->{watch}{$watch_name});
                push @watcher_pairs, "$watch_name: $watch_code";
            }
            $watchers_js = '{ ' . join(', ', @watcher_pairs) . ' }';
        }

        # Build lifecycle hooks
        my @lifecycle_methods;
        if ($page->{lifecycle} && keys %{$page->{lifecycle}}) {
            for my $hook_name (sort keys %{$page->{lifecycle}}) {
                my $hook_code = transform_expression($page->{lifecycle}{$hook_name});
                push @lifecycle_methods, "    $hook_name = $hook_code;";
            }
        }

        my $methods_str = '';
        if (@var_methods || @custom_methods || @computed_methods || @lifecycle_methods) {
            $methods_str = "\n" . join("\n", @var_methods, @custom_methods, @computed_methods, @lifecycle_methods) . "\n";
        }

        # Build routes config (only for main page usually)
        my $routes_js = 'null';
        if ($page->{routes} && keys %{$page->{routes}}) {
            my @route_entries;
            for my $route_path (sort keys %{$page->{routes}}) {
                my $component_name = $page->{routes}{$route_path};
                # Convert component name to valid JS class name
                my $component_class = $component_name;
                $component_class =~ s/-(.)/\U$1/g;
                $component_class = ucfirst($component_class);
                # Convert route params like :id to regex groups
                my $pattern = $route_path;
                my @param_names;
                while ($pattern =~ /:(\w+)/g) {
                    push @param_names, $1;
                }
                $pattern =~ s#:(\w+)#([^/]+)#g;
                # Escape forward slashes for JavaScript regex
                $pattern =~ s#/#\\/#g;
                $pattern = "^$pattern\$";
                my $params_js = '[' . join(', ', map { "'$_'" } @param_names) . ']';
                push @route_entries, "{ path: '$route_path', pattern: /$pattern/, component: $component_class, params: $params_js }";
            }
            $routes_js = '[' . join(', ', @route_entries) . ']';
        }

        push @classes, "class $class_name extends Module {\n    title = '$title';\n    html = '$html';\n    structure = $structure_json;\n    vars = $vars_json;\n    imports = $imports_obj;\n    conditions = $conditions_js;\n    handlers = $handlers_js;\n    loops = $loops_js;\n    watchers = $watchers_js;\n    routes = $routes_js;$methods_str}";
    }

    return join("\n\n", @classes);
}

# Generate CSS with class-scoped selectors for all loaded pages
sub generate_css {
    my ($loaded_pages) = @_;

    my @css_blocks;

    for my $namespace (sort keys %$loaded_pages) {
        my $page = $loaded_pages->{$namespace};
        my $css = $page->{css} // '';
        my $less = $page->{less};

        # Compile LESS to CSS and append
        if ($less) {
            eval {
                $css .= compile_less($less);
            };
            warn "LESS compilation failed for $namespace: $@" if $@;
        }

        next unless $css;

        # Scope each CSS rule with the namespace class
        # Simple approach: wrap in .namespace { ... }
        $css =~ s/^\s+//;
        $css =~ s/\s+$//;
        push @css_blocks, ".$namespace { $css }";
    }

    return join("\n", @css_blocks);
}

# Collect external CSS and JS imports from all loaded pages (with deduplication)
sub collect_external_assets {
    my ($loaded_pages) = @_;

    my %seen_css;
    my %seen_js;
    my @css_files;
    my @js_files;

    for my $namespace (sort keys %$loaded_pages) {
        my $page = $loaded_pages->{$namespace};

        # Collect CSS imports
        my $import_css = $page->{'import-css'} // [];
        for my $css_file (@$import_css) {
            next if $seen_css{$css_file}++;
            push @css_files, $css_file;
        }

        # Collect JS imports
        my $import_js = $page->{'import-js'} // [];
        for my $js_file (@$import_js) {
            next if $seen_js{$js_file}++;
            push @js_files, $js_file;
        }
    }

    return (\@css_files, \@js_files);
}

# Build full HTML document from page data
sub build_html {
    my ($page_data, $page_name) = @_;
    $page_name //= 'page';

    my $title = $page_data->{title} // 'Untitled';
    # Convert page name to valid JS class name (kebab-case to CamelCase)
    my $class_name = $page_name;
    $class_name =~ s/-(.)/\U$1/g;
    $class_name = ucfirst($class_name);

    # Resolve imports and generate JavaScript classes
    my $loaded_pages = resolve_imports($page_data);

    # Add the main page itself
    $loaded_pages->{$page_name} = $page_data;

    my $js_classes = generate_js_classes($loaded_pages);
    my $css = generate_css($loaded_pages);
    my ($external_css, $external_js) = collect_external_assets($loaded_pages);

    my $script = '';
    if ($js_classes) {
        $script = "<script>\n$js_classes\n</script>";
    }

    my $style = '';
    if ($css) {
        $style = "<style>\n$css\n</style>";
    }

    # Generate link tags for external CSS
    my $css_links = '';
    for my $css_file (@$external_css) {
        $css_links .= qq{    <link rel="stylesheet" href="$css_file">\n};
    }

    # Generate script tags for external JS
    my $js_scripts = '';
    for my $js_file (@$external_js) {
        $js_scripts .= qq{    <script src="$js_file"></script>\n};
    }

    # Hot reload script for dev mode
    my $hot_reload_script = '';
    if (is_dev_mode()) {
        $hot_reload_script = <<"HOTRELOAD";
<script>
(function() {
    let lastChangeTime = 0;
    async function checkForChanges() {
        try {
            const res = await fetch('/__spiderpup_check');
            const data = await res.json();
            if (lastChangeTime && data.changed > lastChangeTime) {
                console.log('[Spiderpup] Changes detected, reloading...');
                location.reload();
            }
            lastChangeTime = data.changed;
        } catch (e) {
            console.warn('[Spiderpup] Hot reload check failed:', e);
        }
        setTimeout(checkForChanges, 1000);
    }
    checkForChanges();
})();
</script>
HOTRELOAD
    }

    my $init_script = <<"INIT";
<script>
document.addEventListener('DOMContentLoaded', function() {
    const page = new $class_name();
    page.pageName = '$page_name';
    document.body.classList.add('$page_name');
    page.initUI();
});
</script>
$hot_reload_script
INIT

    my $spiderpup_src = $WEBSERVER_ROOT ? "$WEBSERVER_ROOT/spiderpup.js" : "spiderpup.js";

    return <<"HTML";
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$title</title>
$css_links    $style
$js_scripts    <script src="$spiderpup_src"></script>
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

        if ($token =~ /^<\/([\w-]+)>$/) {
            # Closing tag - pop stack (supports hyphenated tags)
            my $tag = lc($1);
            pop @stack if @stack > 1;
        }
        elsif ($token =~ /^<([\w-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>$/) {
            # Opening tag (supports hyphenated tags like router-view)
            my $tag = lc($1);
            my $attr_str = $2 // '';
            my $self_close = $3;

            next if $tag =~ /^!/;  # Skip comments/doctype

            my %attrs;
            # Match attribute names with colons and @ (for class:*, style:*, @click, etc.)
            while ($attr_str =~ /([\w:@]+)="([^"]*)"/g) {
                my ($attr, $value) = ($1, $2);
                # Handle @event shorthand: @click -> onClick
                if ($attr =~ /^@(\w+)$/) {
                    $attr = "on" . ucfirst($1);
                    # Wrap in arrow function if not already
                    $value = "() => $value" unless $value =~ /^\s*\(.*?\)\s*=>/;
                }
                $attrs{$attr} = $value;
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

                # Hot reload check endpoint
                if ($path eq '/__spiderpup_check') {
                    update_file_mtimes();
                    my $json = encode_json({ changed => $last_change_time });
                    my $content_length = length($json);
                    $response = "HTTP/1.1 200 OK\r\n";
                    $response .= "Content-Type: application/json\r\n";
                    $response .= "Content-Length: $content_length\r\n";
                    $response .= "Cache-Control: no-cache\r\n";
                    $response .= "Connection: close\r\n";
                    $response .= "\r\n";
                    $response .= $json;
                    $conn->send($response);
                    $conn->close;
                    exit(0);
                }

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
                    my $page_data;
                    my $load_error;

                    eval {
                        $page_data = load_page($path);
                    };
                    $load_error = $@ if $@;

                    if ($load_error) {
                        # Return error overlay HTML
                        my $escaped_error = $load_error;
                        $escaped_error =~ s/&/&amp;/g;
                        $escaped_error =~ s/</&lt;/g;
                        $escaped_error =~ s/>/&gt;/g;
                        $escaped_error =~ s/\n/<br>/g;

                        my $error_html = <<"ERRORHTML";
<!DOCTYPE html>
<html>
<head>
    <title>Spiderpup Error</title>
    <style>
        .sp-error-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            font-family: monospace;
            padding: 40px;
            overflow: auto;
            z-index: 99999;
        }
        .sp-error-title {
            color: #ff6b6b;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .sp-error-message {
            background: #1a1a2e;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ff6b6b;
            white-space: pre-wrap;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="sp-error-overlay">
        <div class="sp-error-title">⚠️ Spiderpup Compilation Error</div>
        <div class="sp-error-message">$escaped_error</div>
    </div>
</body>
</html>
ERRORHTML
                        my $content_length = length($error_html);
                        $response = "HTTP/1.1 500 Internal Server Error\r\n";
                        $response .= "Content-Type: text/html; charset=utf-8\r\n";
                        $response .= "Content-Length: $content_length\r\n";
                        $response .= "Connection: close\r\n";
                        $response .= "\r\n";
                        $response .= $error_html;
                    } elsif (defined $page_data) {
                        # Get page name from path for the class name
                        my $page_name = $path;
                        $page_name =~ s|^/||;
                        $page_name =~ s|\.html$||;
                        $page_name =~ s|\.yaml$||;
                        $page_name = 'index' if $page_name eq '';

                        my $body;
                        eval {
                            $body = get_cached_html($page_data, $page_name);
                        };
                        if ($@) {
                            my $escaped_error = $@;
                            $escaped_error =~ s/&/&amp;/g;
                            $escaped_error =~ s/</&lt;/g;
                            $escaped_error =~ s/>/&gt;/g;
                            $escaped_error =~ s/\n/<br>/g;

                            $body = <<"ERRORHTML";
<!DOCTYPE html>
<html>
<head>
    <title>Spiderpup Error</title>
    <style>
        .sp-error-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            font-family: monospace;
            padding: 40px;
            overflow: auto;
            z-index: 99999;
        }
        .sp-error-title {
            color: #ff6b6b;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .sp-error-message {
            background: #1a1a2e;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ff6b6b;
            white-space: pre-wrap;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="sp-error-overlay">
        <div class="sp-error-title">⚠️ Spiderpup Build Error</div>
        <div class="sp-error-message">$escaped_error</div>
    </div>
</body>
</html>
ERRORHTML
                        }

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
