# spiderpup project

server that transforms YAML into reactive html 

## synopsis

```
$ cd spiderpup/scripts
$ PERL5LIB=../lib; morbo spiderpup
```

edit spiderpup/www/recipes/mypage.yaml
edit spiderpup/www/css/mypage.css

open http://127.0.0.1:3000/mypage.html

## installation

### install mojolicious

* see https://www.mojolicious.org/
* `apt install libmojolicious-perl`

### install spiderpup

* `git clone git@github.com:ewolf/spiderpup.git`

### test

```
$ cd spiderpup/scripts
$ PERL5LIB=../lib; morbo spiderpup
```

You will see `Web application available at http://127.0.0.1:3000`
Navigate to that link to test.

### configure

The perl package `Spiderpup` must be in the perl path. 
Add it to the `PERL5LIB` environment variable

The web root directory is spiderpup's one configuration option.
The default is `../www`. It can be set the following ways:

* export SPIDERPUP=<directory>
* morbo spiderpup <directory>

The web root directory must have the following subdirectories:

* css
* js
* recipes
* resource
* html

The js directory must contain `spiderpup.js`.



