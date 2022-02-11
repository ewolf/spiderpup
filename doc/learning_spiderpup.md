# learning spiderpup

This file teaches how to write spiderpup YAML by example.

To see the examples, start spiderpup and then you can click
the links.

```
$ cd spiderpup/scripts
$ morbo spiderpup
```

## hello world

http://localhost:3000/examples/hello_world.html

```
---
html:
  body: 
    - h1: hello world
    - h2: this is spiderpup
```

## hello again

http://localhost:3000/examples/hello_again.html

An element may contain a list as shown in the first example.
This second example shows how an element may have fields set
explicitly. Child elements are specified by the `contents` 
field.

The title of the page is set in the head section.

```
---
html:
  head:
    title: hello again
  body:
    - div:
        style: background-color: wheat;
        contents:
          - h1: hello world
          - h2: 
              textContent: this is spiderpup
              style: background-color: lightblue;
```

## components

http://localhost:3000/examples/components.html

This example shows how components can be defined and used and
reused.


```
---
html:
  body:
    - header:
    - greeting:
    - greeting:
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
  greeting:
    - div:
        - span: 'hello '
        - span: there
```

## components and state

http://localhost:3000/examples/components_and_state.html

Each component has its own state object attached to it.
The state has a data object attached to it. Components
can be defined with default data values. These defaults
can be overridden when the component is placed into the
dom.

The `calculate` section of an element has functions that
are called when the elements are placed or refreshed and
the values applied to the particular element attribute.
These functions take the component state as their argument.


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

## events and state

This example shows a button who's text displays how many times
it was clicked.

```
---
html:
  body:
    contents:
      - button:
          calculate:
            textContent: s => 'clicked ' + s.data.get('count',0) + ' times'
          events:
            click: (s,ev) => s.data.set( 'count', 1 + s.data.get( 'count' ) )
        
```

http://localhost:3000/examples/events.html

## calculations

http://localhost:3000/examples/calculations.html

## hello loops

```
---
html:
  body:
    - div:
        - h1: 
            foreach: s => [ "world", "galaxy", "universe" ]
            forval: where
            calculate:
              textContent: s => 'hello ' + s.it.where
```

http://localhost:3000/examples/hello_loops.html
