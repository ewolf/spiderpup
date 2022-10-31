Current things to do:

* deicde on how to serialize handles for foreach
  thinking that they should simply be serialized

* event propagation: make sure an event is only
  handled once by a handler to discorage infinite loops

* decide if dynamic component should be a thing
   (am thinking not)

* a page that takes a spiderpup yaml and builds it on the page
  - how about iframes. can they refresh each other?
    yes with messages, @whee

* error messages rather than a 500

* navigation help, for example, a login page url
    - maybe not part of spiderpup yet, but could be in 
      recipes. spiderpup can be agnostic about this
      but maybe there will be traditions to follow
      
    - like window popstate and hashchange events
      
* transition fades and stuff
      
* test file uploads / downloads
    - in app for avatars, for example

* bottle up the filespaces / namespaces better
   this should correspond to a top level component, maybe

* startup script to directory that makes a configuration
  if there isn't one in that directory

* program to set up object store with an app to edit
  chapters and lessons

* rewrite howto docs after things work

* more explanations in gotchas
  - weed out semicolons at the end of '() => something;'
  - better error messages
  - bind functions to components

* better name for internal content?

* POD and other documentation

* more automated tests

* ~~versioning with imports and serving?~~
  - **not gonna**
  - ~~like, import between versions x and y~~
  - ~~versions are stored in directories~~
  - ~~the HEAD symlinks to the one to be used~~

* write full description of state

* get working on madyote

* add tests

