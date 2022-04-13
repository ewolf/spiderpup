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

This shows how spiderpup builds html tags from its description.
Simple tags witout properties, like body in this example, can 
have a list of child tags placed inside of it. Simple tags
without child tags can be given text to place inside of them.

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

This example shows tags that contain properties and children.
The div tag placed inside the body is given the 'class' property
and the 'contents' property to hold child tags placed in it.
The h2 tag inside of it is given an explicit 'style'
and 'textContent' properties.

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

Components are resuable snippets that can contain
other components inside them. The components act like
html tags. In this example, the 'main' component
has the 'greeting' component included twice inside of it.

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

### internal content

This shows where a defined component places any contents given to it.
The 'with-specified-internal' component has a span inside of it
with the 'internalContent' property. Any contents given to the
component are placed within that span. The 'no-specified-internal'
component does not have a child with 'internalContent' so any 
content given to it is placed at the end.

http://localhost:3000/examples/internal.html

YAML file *.../spiderpup/www/recipes/examples/internal.yaml*

```
---
html:
  head:
    style: span { margin: 5px }
  body:
    - with-specified-internal:
      - span: IN THE
      - span: MIDDLE
    - no-specified-internal:
      - span: AFTER FINISH

components:
  with-specified-internal:
    - div:
        - span: first
        - span: 
            internalContent: 1
        - span: last
  no-specified-internal:
    - div:
        - span: start
        - span: finish
```

### includes

spiderpup recipes may include other recipes. Included recipes
must be in the www/include directory.

http://localhost:3000/examples/includes.html

YAML file *.../spiderpup/www/recipes/examples/includes.yaml*
```
---
import:
  - examples/impy

html:
  body:
    - myform:
        functions:
          foo: () => 2
```

YAML file *.../spiderpup/www/include/examples/impy.yaml*
```
---
import:
  - bar: examples/more_impy
  
components:
  myform:
    functions:
      foo: () => 1
    contents:
      - form: 
          - mydiv
  mydiv:
    - div:
        - bar.impydiv
```
YAML file *.../spiderpup/www/include/examples/more_impy.yaml*

```
---
components:
  impydiv:
    - div: my impy div
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
  head:
    style: >-
      .low { border: solid red 8px }
      .good { border: solid green 8px }
      .high { border: solid purple 8px }
    
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
          style: display: inline-block
          calculate:
            class: s => s.data.get('value') < 10 ? 'low' : s.data.get('value') > 35 ? 'high' : 'good'
          contents:
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
            forval: whereami
            calculate:
              textContent: s => 'hello ' + s.it.whereami + ' (' + s.idx.whereami + ')'
```

## handles

### element handles

http://localhost:3000/examples/attach_element.html

This introduces two things : element handles and state refresh.
When an element is given a handle with 'handle',
a reference to that element is put in the state variable's `el`
object, keyed with the handle given.

The state object can be made to refresh manually with the `refresh`
method.

YAML file *.../spiderpup/www/recipes/examples/attach_handles.yaml*.

```
---
html:
  body:
    - h1: hello handles
    - div:
        - input:
            type: text
            handle: textfield
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

Subcomponent state can be attached to a state object. In this example,
the `testapp` component has two `counter` components embedded in it.
Each instance of a component has its own state. The state of a subcomponent
can be attached in the `comp` object of the state. A testapp state (s)
here has references to its child components thru s.comp.A and s.comp.B.

YAML file *.../spiderpup/www/recipes/examples/attach_component.yaml*.
```
---
html:
  head:
    title: example
  body:
    - testapp:

components:
  testapp:
    data:
      count: 0
    contents:
      - div: 
          - h1: Test App
          - counter:
              handle: A
          - counter: 
              handle: B
              data:
                count: 1
          - div:
              calculate: 
                textContent: s => { const a = s.comp.A.data.get( 'count' ), b = s.comp.B.data.get( 'count' ); return a + ' + ' + b + ' = ' + (a+b) }
              
  counter:
    data:
      count: 0
    contents:
      - button:
          calculate:
            textContent: s => s.data.get( 'count' )
          on:
            click: >-
              (s,ev) => {
                 s.data.set( 'count', 1 + s.data.get( 'count' ) )
                 s.parent.refresh();
              }
          
```

## spiderpup state


