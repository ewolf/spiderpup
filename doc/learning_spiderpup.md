# learning spiderpup

This file teaches how to write spiderpup YAML by example.

To see the examples, start spiderpup and then you can click
the links.

```
$ cd spiderpup/scripts
$ morbo spiderpup
```

## spiderpup static basics

These examples show spiderpup transforming YAML into html. They
introduce spiderpup reusable components.

### hello world

http://localhost:3000/examples/hello_world.html

YAML file *.../spiderpup/www/recipes/examples/hello_world.yaml*.

```
---
html:
  body: 
    - h1: hello world
    - h2: this is spiderpup
```

### hello again

http://localhost:3000/examples/hello_again.html

YAML file *.../spiderpup/www/recipes/examples/hello_again.yaml*

```
---
html:
  head:
    title: hello again
    style: >
      .mainstyle {
         background-color: wheat;
      }
      
  body:
    - div:
        class: mainstyle
        contents:
          - h1: hello world
          - h2: 
              textContent: this is spiderpup
              style: background-color: lightblue;
```

### components

http://localhost:3000/examples/components.html

YAML file *.../spiderpup/www/recipes/examples/components.yaml*
```
---
html:
  head:
    title: hello again
  body:
    - header:
    - main:
    - footer:

components:
  header:
    - div:
        - h1: I am the title
        - h2: subtitle yay
  footer:
    - div:
        style: position: absolute; bottom: 0; font-size: x-large
        textContent: THIS IS THE END
  main:
    - div:
        # greet twice
        - greeting:
        - greeting:

  greeting:
    - div:
        - span: 'hello '
        - span: there
```

## spiderpup files

### default css and javascript

http://localhost:3000/examples/defaults.html

Spiderpup by default tries to load a css and a javascript
file that mirrors the target path. For this example the
target path is `/examples/default.html`. Spiderpup
tries to load `/js/examples/default.js` and `/css/examples/default.css`.


CSS file *.../spiderpup/www/css/examples/defaults.css*
```
div {
    background: yellow;
}

```

JS file *.../spiderpup/www/js/examples/defaults.js*
```
alert ('default javascript' );
```

YAML file *.../spiderpup/www/recipes/examples/defaults.yaml*
```
html:
  body:
    - div: /js/examples/defaults.js and /css/examples/defaults.css are loaded automatically
```

### additional css and javascript

http://localhost:3000/examples/head_additional.html

YAML file *.../spiderpup/www/recipes/examples/head_additional.yaml*
```
---
html:
  head:
    title: header additional
    css:
      - /css/examples/extra/head_additional_1.css
      - /css/examples/extra/head_additional_2.css
    javascript:
      - /js/examples/extra/head_additional_A.js
      - /js/examples/extra/head_additional_B.js
  body:
    - div: You can include javascript and css files in the header.

```

extra css `.../spiderpup/www/css/examples/extended/head_additional_1.css`

```
div {
    border: solid 3px black;
}

```

extra css `.../spiderpup/www/css/examples/extended/head_additional_2.css`

```
div {
    border: solid 3px black;
    background: lightgreen;
}

```

extra js `.../spiderpup/www/js/examples/extended/head_additional_A.js`
```
alert( "HELLO ADDITIONAL A" );
```

extra js `.../spiderpup/www/js/examples/extended/head_additional_B.js`
```
alert( "HELLO ADDITIONAL B" );
```

## spiderpup state basics

State is kept for the page and for each component placed 
on it. State data is used to calculate how the page appears.

### components and state data

http://localhost:3000/examples/components_and_state.html

Each instance of component has its own state object.
That state object has a data field that is populated with
a copy of the data from the component definition section.
That data can be overridden at component placement.

The instance state is passed to `calculate` functions as the
only argument.

YAML file *.../spiderpup/www/recipes/examples/components_and_state.yaml*
```
---
html:
  body:
    - greeting:
    - greeting:
        data:
          greeting: I override

components:
  greeting:
    data:
      greeting: Hello there
    contents:
      - div:
          calculate:
            textContent: s => 'greet ' + s.data.get( 'greeting' )
```

### events and state

http://localhost:3000/examples/events.html

This short example shows a button who's text displays how many times
it was clicked. `s.data.get` is with a field name and an optional
second argument which is a default value to set the field to if it
is not yet defined.

There is no component here; the body also gets a state object 
associated with it.

Whenever an event function is run and if there is a change to its
data, the page contents are recalculated.

Notice that the first argument to an event handler is always the 
state, followed by the event object.

YAML file *.../spiderpup/www/recipes/examples/events.yaml*
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

### components and functions

http://localhost:3000/examples/components_and_functions.html

Components can have functions attached to them. The functions can
be called from the state object's `fun` object. When called, the
state is automatically passed to them as the first argument.

This example shows a simple control to set a positive number for
pressure and temperature settings.

YAML file *.../spiderpup/www/recipes/examples/components_and_functions.yaml*
```
---
html:
  body:
    - NumberAdjuster:
        data:
          name: 'temperature'
    - NumberAdjuster:
        data:
          name: 'pressure'

components:
  NumberAdjuster:
    data:
      value: 0
      name: ''
    functions:
      inc: s => s.data.set( 'value', 1 + s.data.get('value') )
      dec: s => s.data.get( 'value' ) > 0 && s.data.set( 'value', s.data.get('value') - 1 )
    contents:
      - div:
          - button:
              textContent: '-'
              on:
                click: s => s.fun.dec()
          - span:
              style: margin: 0 5px
              calculate:
                textContent: s => s.data.get('name') + ': ' + s.data.get('value')
          - button:
              textContent: '+'
              on:
                click: s => s.fun.inc()
```

## spiderpup loops and branching

### if branching

http://localhost:3000/examples/if_branches.html

Elements can have if / elseif / else branching. 'if' and 'elseif'
are assigned functions that take the state as their first argument.

YAML file *.../spiderpup/www/recipes/examples/if_branches.yaml*
```
---
html:
  body:
    - NumberAdjuster:
        data:
          value: 15
          incVal: 5
          name: 'pressure'
          
components:
  NumberAdjuster:
    data:
      incVal: 1
      value: 0
      name: ''
    functions:
      inc: s => s.data.set( 'value', s.data.get('incVal') + s.data.get('value') )
      dec: >
        s => {
           s.data.set( 'value', s.data.get('value') - s.data.get('incVal') )
           if (s.data.get( 'value' ) < 0) s.data.set('value',0)
        }

    contents:
      - div:
          - button:
              textContent: '-'
              on:
                click: s => s.fun.dec(s)
          - span:
              style: margin: 0 5px
              calculate:
                textContent: s => s.data.get('name') + ': ' + s.data.get('value')
          - span:
              if: s => s.data.get('value') < 10
              textContent: too low
          - span:
              elseif: s => s.data.get('value') > 35
              textContent: too high
          - span:
              else:
              textContent: good enough
          - button:
              textContent: '+'
              on:
                click: s => s.fun.inc(s)
```

### loops

http://localhost:3000/examples/loops.html

An element can be looped. For this to happen, a 'foreach' function
that returns an array, and a 'forval' value to label the iteration
must be defined. That element will be placed once for each item in the
'foreach' array. Each time the element is placed, the state is updated
in two places. The array value is placed in `state.it[forval]` and the 
index is placed in `state.idx[forval]` as shown in the following example.

YAML file *.../spiderpup/www/recipes/examples/loops.yaml*.
```
---
html:
  body:
    - div:
        - h1: 
            foreach: s => [ "world", "galaxy", "universe" ]
            forval: where
            calculate:
              textContent: s => 'hello ' + s.it.where + '(' + s.idx.where + ')'
```

## handles

### element handles

http://localhost:3000/examples/element_handles.html

This introduces two things : element handles and state refresh.
When an element is given a handle with attach-el, 
a reference to that element is put in the state variable's `el`
object, keyed with the handle given.

The state object can be made to refresh manually with the `refresh`
method.

YAML file *.../spiderpup/www/recipes/examples/element_handles.yaml*.

```
---
html:
  body:
    - h1: hello handles
    - div:
        - input:
            type: text
            attach-el: textfield
            on:
              change: s => s.refresh()
        - button:
            textContent: click
            on:
              click: s => s.refresh()
        - div:
            calculate:
              textContent: s => s.el.textfield.value ? `you typed "${s.el.textfield.value}"` : ''

```


### component handles

http://localhost:3000/examples/attach_component.html



YAML file *.../spiderpup/www/recipes/examples/attach_component.yaml*.
```
---
html:
  body:
    - h1: hello handles
    - div:
        - input:
            type: text
            attach-el: textfield
            on:
              change: s => s.refresh();
        - div:
            calculate:
              textContent: s => s.el.textfield.value ? `you typed "${s.el.textfield.value}"` : ''
```

## spiderpup state


