# Spiderpup

A lightweight YAML-based web framework with reactive components, written in Perl and JavaScript.

## Features

- **Declarative YAML components** - Define UI with simple YAML syntax
- **Reactive data binding** - Two-way binding, computed properties, watchers
- **Shorthand syntax** - `$var` for getters/setters, `@click` for events, implicit `this`
- **LESS compiler** - Variables, nesting, mixins, color functions, math
- **Component composition** - Imports, slots, refs, broadcast/receive
- **SPA routing** - Client-side navigation with route parameters
- **Transitions** - Animated conditional rendering
- **Developer experience** - Hot reload, error overlays, HTML caching

## Getting Started

### Running the Server

```bash
perl webserver.pl
```

The server runs on `http://localhost:5000` by default.

### Development Mode

Enable hot reload for automatic browser refresh on file changes:

```bash
SPIDERPUP_DEV=1 perl webserver.pl
```

### Project Structure

```
spiderpup/
├── webserver.pl      # Perl web server
├── spiderpup.js      # Client-side JavaScript runtime
└── pages/            # YAML page definitions
    ├── index.yaml    # Served at / or /index.html
    ├── foo.yaml      # Served at /foo or /foo.html
    └── ...
```

## Page Definition (YAML)

Each page is defined in a YAML file with the following fields:

### Basic Structure

```yaml
title: My Page Title
css: |
  button { background-color: blue; }
less: |
  @primary: #333;
  div {
    color: @primary;
    &:hover { color: red; }
  }
import:
  foo: /foo.yaml
  bar: /bar.yaml
vars:
  count: 0
  name: "World"
methods:
  increment: () => { $count = $count + 1 }
html: |
  <h1>Hello, {name}!</h1>
  <button @click="increment()">Click me</button>
```

### Fields Reference

| Field | Description |
|-------|-------------|
| `title` | Page title (appears in browser tab) |
| `css` | Raw CSS styles (scoped to the page) |
| `less` | LESS styles (compiled to CSS, scoped to the page) |
| `import` | Map of component namespaces to YAML file paths |
| `vars` | Reactive variables with initial values |
| `computed` | Derived values that auto-update when dependencies change |
| `watch` | Callbacks triggered when specific variables change |
| `methods` | JavaScript functions available to the page |
| `lifecycle` | Hooks for mount/destroy events (`onMount`, `onDestroy`) |
| `routes` | SPA route definitions (path → component mapping) |
| `html` | HTML template with special syntax |

## Styling

### CSS

Standard CSS in the `css` field is automatically scoped to the page namespace:

```yaml
css: |
  button { background-color: skyblue; }
  .highlight { color: red; }
```

### LESS

The `less` field supports a subset of LESS syntax:

#### Variables

Define variables with `@name: value;` and use them anywhere:

```less
@primary-color: #3498db;
@spacing: 10px;

div {
  color: @primary-color;
  padding: @spacing;
}
```

#### Nesting

Nest selectors for cleaner, more organized styles:

```less
nav {
  background: #333;

  ul {
    list-style: none;

    li {
      display: inline-block;
    }
  }
}
```

Compiles to:

```css
nav { background: #333; }
nav ul { list-style: none; }
nav ul li { display: inline-block; }
```

#### Parent Selector (&)

Reference the parent selector with `&`:

```less
button {
  background: blue;

  &:hover {
    background: darkblue;
  }

  &.active {
    background: green;
  }

  &-icon {
    margin-right: 5px;
  }
}
```

Compiles to:

```css
button { background: blue; }
button:hover { background: darkblue; }
button.active { background: green; }
button-icon { margin-right: 5px; }
```

#### Mixins

Define reusable style blocks with parameters:

```less
.border-radius(@r) {
  border-radius: @r;
}

.box-shadow(@x, @y, @blur, @color) {
  box-shadow: @x @y @blur @color;
}

.card {
  .border-radius(8px);
  .box-shadow(0, 2px, 4px, rgba(0,0,0,0.1));
}
```

#### Color Functions

Manipulate colors dynamically:

```less
@primary: #3498db;

.button {
  background: @primary;

  &:hover {
    background: darken(@primary, 10%);  // Darker shade
  }

  &:active {
    background: darken(@primary, 20%);
  }

  &.light {
    background: lighten(@primary, 30%);  // Lighter shade
  }

  &.blend {
    background: mix(@primary, #e74c3c, 50%);  // Blend two colors
  }
}
```

Available functions:
- `darken(@color, amount%)` - Decrease lightness
- `lighten(@color, amount%)` - Increase lightness
- `mix(@color1, @color2, weight%)` - Blend two colors

#### Math Operations

Perform calculations with units:

```less
@base: 10px;
@columns: 12;

.container {
  padding: @base * 2;        // 20px
  margin: @base + 5px;       // 15px
  width: 100% / @columns;    // 8.333...%
  font-size: @base * 1.5;    // 15px
}
```

Supports `+`, `-`, `*`, `/` with automatic unit preservation.

#### Combined Example

```less
@brand: #e74c3c;
@spacing: 10px;

.border-radius(@r) {
  border-radius: @r;
}

.card {
  border: 1px solid @brand;
  padding: @spacing * 2;
  .border-radius(8px);

  h2 {
    color: @brand;
  }

  &:hover {
    border-color: darken(@brand, 15%);
  }

  &.featured {
    background: lighten(@brand, 40%);
  }
}
```

## Reactive Variables

### Defining Variables

```yaml
vars:
  count: 0
  name: "Guest"
  items: ["apple", "banana", "cherry"]
```

### Using Variables in HTML

Interpolate variables with `{varName}`:

```yaml
html: |
  <p>Hello, {name}!</p>
  <p>Count: {count}</p>
```

### Accessing Variables in Methods

Use shorthand `$var` syntax or auto-generated getters/setters:

```yaml
methods:
  # Shorthand syntax
  increment: () => { $count = $count + 1 }
  reset: () => { $count = 0 }
  greet: () => alert('Hello, ' + $name)

  # Traditional syntax (also works)
  # increment: () => this.set_count(this.get_count() + 1)
```

### Two-Way Binding

Bind input values directly to variables with `bind`:

```yaml
vars:
  name: ""
  agreed: false

html: |
  <input bind="name" placeholder="Enter name"/>
  <input type="checkbox" bind="agreed"/>
  <p>Hello, {name}!</p>
```

Changes to the input automatically update the variable, and vice versa.

### Computed Properties

Define derived values that auto-update:

```yaml
vars:
  firstName: "John"
  lastName: "Doe"
  items: []

computed:
  fullName: () => `${$firstName} ${$lastName}`
  itemCount: () => $items.length
  isEmpty: () => $items.length === 0

html: |
  <h1>Welcome, {fullName}!</h1>
  <p>You have {itemCount} items</p>
```

### Watchers

React to variable changes:

```yaml
vars:
  count: 0
  searchQuery: ""

watch:
  count: (newVal, oldVal) => console.log(`Count changed: ${oldVal} → ${newVal}`)
  searchQuery: (newVal) => performSearch(newVal)

methods:
  performSearch: (query) => console.log('Searching for:', query)
```

### Class Binding

Dynamically toggle CSS classes:

```yaml
vars:
  isActive: false
  hasError: false

html: |
  <div class:active="() => $isActive"
       class:error="() => $hasError">
    Status indicator
  </div>
  <button @click="$isActive = !$isActive">
    Toggle
  </button>
```

### Style Binding

Dynamically set inline styles:

```yaml
vars:
  textColor: "blue"
  fontSize: 16

html: |
  <!-- Simple variable binding -->
  <p style:color="textColor">Colored text</p>

  <!-- Function binding -->
  <p style:fontSize="() => $fontSize + 'px'">Sized text</p>
```

## Event Handlers

Attach event handlers with `on[Event]` attributes:

```yaml
html: |
  <button onClick="() => this.increment()">Add</button>
  <button onClick="() => this.reset()">Reset</button>
  <input onInput="(e) => this.set_name(e.target.value)" />
```

The UI automatically refreshes after event handlers execute.

## Shorthand Syntax

Spiderpup provides shorthand syntax to reduce boilerplate and improve readability. All transformations happen at compile time, and the traditional syntax remains fully supported.

### Variable Shorthand (`$var`)

Use `$var` instead of `this.get_var()` and `$var = value` instead of `this.set_var(value)`:

```yaml
# Traditional syntax
methods:
  increment: () => this.set_count(this.get_count() + 1)
  double: () => this.set_count(this.get_count() * 2)

# Shorthand syntax
methods:
  increment: () => { $count = $count + 1 }
  double: () => { $count = $count * 2 }
```

Works in methods, computed properties, watchers, lifecycle hooks, conditions, and event handlers:

```yaml
computed:
  doubleCount: () => $count * 2
  greeting: () => "Hello, " + $name + "!"

watch:
  count: (newVal) => console.log("Count is now:", newVal)

html: |
  <if condition="() => $count > 10">
    <p>Count is high!</p>
  </if>
```

Complex assignments are supported:

```yaml
methods:
  addItem: () => { $items = [...$items, "New Item"] }
  reset: () => { $count = 0; $name = "Guest" }
```

### Event Shorthand (`@event`)

Use `@click` instead of `onClick="() => ..."`:

```yaml
# Traditional syntax
html: |
  <button onClick="() => this.increment()">+1</button>
  <button onClick="() => this.set_count(0)">Reset</button>

# Shorthand syntax
html: |
  <button @click="increment()">+1</button>
  <button @click="$count = 0">Reset</button>
```

The `@event` syntax:
- Converts `@click` to `onClick`, `@mouseover` to `onMouseover`, etc.
- Automatically wraps the value in `() =>` if not already an arrow function
- Combines well with `$var` and implicit `this`

All standard DOM events work: `@click`, `@input`, `@change`, `@mouseover`, `@keydown`, etc.

### Implicit `this`

Bare method calls are automatically prefixed with `this.`:

```yaml
# Traditional syntax
html: |
  <button onClick="() => this.increment()">+1</button>
  <button onClick="() => this.reset()">Reset</button>

# Shorthand syntax (implicit this)
html: |
  <button @click="increment()">+1</button>
  <button @click="reset()">Reset</button>
```

JavaScript globals (`console`, `Math`, `JSON`, `Date`, `fetch`, `Promise`, etc.) and arrow function parameters are not prefixed:

```yaml
methods:
  log: () => console.log("Count:", $count)  # console is not prefixed
  process: (items) => items.map(x => x * 2)  # items and x are not prefixed
```

### Combined Example

Before (traditional):

```yaml
vars:
  count: 0
  name: "World"

methods:
  increment: () => this.set_count(this.get_count() + 1)
  reset: () => this.set_count(0)

computed:
  greeting: () => "Hello, " + this.get_name()

html: |
  <p>{greeting}</p>
  <p>Count: {count}</p>
  <button onClick="() => this.increment()">+1</button>
  <button onClick="() => this.set_count(this.get_count() - 1)">-1</button>
  <button onClick="() => this.reset()">Reset</button>
  <input bind="name" />
  <if condition="() => this.get_count() > 5">
    <p>Count is high!</p>
  </if>
```

After (shorthand):

```yaml
vars:
  count: 0
  name: "World"

methods:
  increment: () => { $count = $count + 1 }
  reset: () => { $count = 0 }

computed:
  greeting: () => "Hello, " + $name

html: |
  <p>{greeting}</p>
  <p>Count: {count}</p>
  <button @click="increment()">+1</button>
  <button @click="$count = $count - 1">-1</button>
  <button @click="reset()">Reset</button>
  <input bind="name" />
  <if condition="() => $count > 5">
    <p>Count is high!</p>
  </if>
```

### Backward Compatibility

All traditional syntax continues to work:

```yaml
# You can mix styles freely
methods:
  increment: () => { $count = $count + 1 }                    # shorthand
  decrement: () => this.set_count(this.get_count() - 1)       # traditional

html: |
  <button @click="increment()">+1 (shorthand)</button>
  <button onClick="() => this.decrement()">-1 (traditional)</button>
```

## Control Flow

### Conditionals

Use `<if>`, `<elseif>`, and `<else>` tags:

```yaml
html: |
  <if condition="() => $count < 10">
    <p>Count is small</p>
  </if>
  <elseif condition="() => $count < 50">
    <p>Count is medium</p>
  </elseif>
  <else>
    <p>Count is large</p>
  </else>
```

### Transitions

Add animations when conditionals change:

```yaml
html: |
  <if condition="() => $isVisible" transition="fade">
    <div>This content fades in/out</div>
  </if>

  <if condition="() => $isOpen" transition="slide">
    <div>This content slides in/out</div>
  </if>
```

Built-in transitions: `fade`, `slide`

### Loops

Use `<for>` with static arrays or dynamic functions:

```yaml
html: |
  <!-- Static array -->
  <for items="[1, 2, 3]">
    <div textContent="(mod, item, idx) => `Item ${idx}: ${item}`"></div>
  </for>

  <!-- Dynamic from vars (shorthand) -->
  <for items="$items">
    <div textContent="(mod, item, idx) => item.toUpperCase()"></div>
  </for>

  <!-- Dynamic from vars (traditional) -->
  <for items="() => this.get_items()">
    <div textContent="(mod, item, idx) => item.toUpperCase()"></div>
  </for>
```

## Components

### Importing Components

```yaml
import:
  button: /components/button.yaml
  card: /components/card.yaml
```

### Using Components

Use the namespace as the tag name, passing vars as attributes:

```yaml
html: |
  <button label="Click me" color="blue" />
  <card title="My Card">
    <p>Card content here</p>
  </card>
```

### Component Definition

Components are just pages that receive attributes as vars:

```yaml
# components/button.yaml
title: Button Component
vars:
  label: "Button"
  color: "gray"
css: |
  button { padding: 10px 20px; }
html: |
  <button style="background-color: {color}">{label}</button>
```

### Slots

Pass content into components:

```yaml
# components/card.yaml
title: Card Component
vars:
  title: "Card"
html: |
  <div class="card">
    <h2>{title}</h2>
    <div class="card-content">
      <slot/>
    </div>
  </div>
```

Usage:

```yaml
import:
  card: /components/card.yaml

html: |
  <card title="My Card">
    <p>This content goes into the slot!</p>
    <button>Action</button>
  </card>
```

### Refs

Access DOM elements and component instances directly:

```yaml
vars:
  value: ""

methods:
  focusInput: () => this.refs.myInput.focus()
  clearInput: |
    () => {
      this.refs.myInput.value = '';
      this.refs.myInput.focus();
    }

html: |
  <input ref="myInput" bind="value"/>
  <button @click="focusInput()">Focus</button>
  <button @click="clearInput()">Clear</button>
```

For components, `ref` gives you the component instance:

```yaml
html: |
  <myComponent ref="comp"/>
  <button onClick="() => this.refs.comp.someMethod()">Call Method</button>
```

### Lifecycle Hooks

Execute code when components mount or unmount:

```yaml
lifecycle:
  onMount: |
    () => {
      console.log('Component mounted!');
      this.refs.myInput.focus();
    }
  onDestroy: |
    () => {
      console.log('Component destroyed!');
      // Cleanup timers, listeners, etc.
    }
```

### Broadcast / Receive

Enable communication between components using a pub/sub pattern:

```yaml
# Component A - broadcasts messages
methods:
  notifyAll: |
    () => {
      this.broadcast('user-updated', { id: 123, name: 'John' });
    }
  sendAlert: |
    () => {
      this.broadcast('alert', { type: 'warning', message: 'Something happened!' });
    }

html: |
  <button @click="notifyAll()">Notify All</button>
```

```yaml
# Component B - receives messages
lifecycle:
  onMount: |
    () => {
      this.receive('user-updated', (data, sender) => {
        console.log('User updated:', data);
        $userName = data.name;
        this.refresh();
      });

      this.receive('alert', (data) => {
        alert(data.message);
      });
    }
```

Key points:
- `broadcast(channel, data)` sends to all modules except the sender
- `receive(channel, callback)` registers a handler for a channel
- Callback receives `(data, senderModule)` arguments
- Multiple receivers can listen to the same channel
- Useful for cross-component state sync, notifications, events

### Event Bubbling

Emit events that propagate up the component hierarchy (like DOM events):

```yaml
# Child component - emits events
methods:
  handleClick: |
    () => {
      // Emit event that bubbles up to parents
      this.emit('item-selected', { id: 42, name: 'Example' });
    }
  handleDelete: |
    () => {
      this.emit('item-deleted', { id: 42 });
    }

html: |
  <button @click="handleClick()">Select</button>
  <button @click="handleDelete()">Delete</button>
```

```yaml
# Parent component - handles events from children
import:
  childItem: /components/child-item.yaml

lifecycle:
  onMount: |
    () => {
      // Handle event and allow it to continue bubbling
      this.on('item-selected', (event) => {
        console.log('Item selected:', event.data);
        // Event continues to bubble up
      });

      // Handle event and stop propagation
      this.on('item-deleted', (event) => {
        console.log('Item deleted:', event.data);
        event.stopPropagation();  // Stop bubbling here
        // Or: return false;      // Also stops propagation
      });
    }

html: |
  <div>
    <childItem/>
    <childItem/>
  </div>
```

Event object properties:
- `event.name` - The event name
- `event.data` - The data passed to emit()
- `event.source` - The module that emitted the event
- `event.stopPropagation()` - Stop the event from bubbling further

Methods:
- `emit(name, data)` - Emit an event that bubbles up
- `on(name, handler)` - Register an event handler
- `off(name, handler?)` - Remove event handler(s)

## Client-Side Routing

Build single-page applications with client-side navigation.

### Defining Routes

```yaml
title: My App

import:
  home: /pages/home.yaml
  about: /pages/about.yaml
  user: /pages/user.yaml

routes:
  /: home
  /about: about
  /user/:id: user

html: |
  <nav>
    <link to="/">Home</link>
    <link to="/about">About</link>
    <link to="/user/123">User 123</link>
  </nav>
  <router-view/>
```

### Route Parameters

Parameters in routes (`:id`) are passed as vars to the component:

```yaml
# pages/user.yaml
title: User Profile
vars:
  id: ""

lifecycle:
  onMount: () => console.log('Viewing user:', this.get_id())

html: |
  <h1>User Profile</h1>
  <p>User ID: {id}</p>
```

### Navigation Links

Use `<link to="...">` for client-side navigation (no page reload):

```yaml
html: |
  <link to="/about">Go to About</link>
  <link to="/user/456">View User 456</link>
```

## Complete Example

```yaml
title: Todo App
css: |
  .completed { text-decoration: line-through; }
less: |
  @primary: #3498db;

  .todo-app {
    max-width: 400px;

    input {
      border: 2px solid @primary;
      padding: 8px;
    }

    button {
      background: @primary;
      color: white;

      &:hover {
        background: darken(@primary, 10%);
      }
    }
  }
vars:
  todos: []
  newTodo: ""
methods:
  addTodo: |
    () => {
      const todo = $newTodo;
      if (todo) {
        $todos.push({ text: todo, done: false });
        $newTodo = '';
      }
    }
html: |
  <div class="todo-app">
    <h1>Todo List</h1>
    <input bind="newTodo" placeholder="Enter a todo" />
    <button @click="addTodo()">Add</button>
    <for items="$todos">
      <div textContent="(mod, item) => item.text"></div>
    </for>
  </div>
```

## Server Options

```bash
# Default (port 5000)
perl webserver.pl

# Development mode with hot reload
SPIDERPUP_DEV=1 perl webserver.pl

# With custom root path prefix
perl webserver.pl --root /myapp

# Demo mode (shows parsed HTML structure)
perl webserver.pl --demo
```

## Caching

Spiderpup automatically caches compiled HTML to improve performance:

- Cache stored in `/tmp/spiderpup_cache/`
- Tracks all YAML dependencies (including imports)
- Automatically invalidates when any referenced file changes
- Works across server restarts

## Error Handling

### Server-Side Errors

YAML parsing or compilation errors display a styled error overlay instead of crashing:

- Shows error message and location
- Styled overlay with dark theme
- Still allows hot reload to retry after fixes

### Client-Side Errors

Runtime JavaScript errors show a dismissible overlay:

- Catches uncaught exceptions
- Catches unhandled promise rejections
- Shows error message and stack trace
- Click "Dismiss" to close

## Comparison with Other Frameworks

| Feature | Spiderpup | React | Vue | BackdraftJS |
|---------|-----------|-------|-----|-------------|
| Template syntax | YAML + HTML | JSX | SFC | Pure JS |
| Virtual DOM | No | Yes | Yes | No |
| Build step | None | Required | Optional | None |
| File size | ~2KB JS | ~40KB | ~30KB | ~2KB |
| Styling | LESS built-in | External | Scoped CSS | External |
| Routing | Built-in | External | External | None |
| Hot reload | Built-in | External | Built-in | None |
