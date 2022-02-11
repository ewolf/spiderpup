# spiderpup project

server that renders YAML as reactive, componentized html

## description

Write YAML files, place them in the directory path corresponding
to a url path. Start the spiderpup server, giving it the directory
to use. Spiderpup now automaticaly serves the html and javascript 
described in the YAML files.

## tutorial

See https://github.com/ewolf/spiderpup/blob/main/doc/learning_spiderpup.md

**Spoiler** : the following YAML file translates into a page with a reactive 
button that shows how many times it is clicked.

```
---
html:
  body:
    - h1: Hello Events
    - button:
        calculate:
          textContent: s => 'clicked ' + s.data.get('count',0) + ' times'
        on:
          click: (s,ev) => s.data.set( 'count', 1 + s.data.get( 'count' ) )
        
```


## synopsis

```
$ cd spiderpup/scripts
$ PERL5LIB=../lib; morbo spiderpup
```

edit spiderpup/www/recipes/mypage.yaml

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



