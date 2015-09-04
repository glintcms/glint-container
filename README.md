# glint-container


glint container for blocks


# install

```bash
npm install glint-container
```

# use

> This Module is part of [glintcms](http://glintcms.com/).
> Please see the [documentation](https://github.com/glintcms/glintcms) for more info.


```js
var Container = require('glint-container');
var container = Container(configuration);

container.id(myId).load(function() {
console.log('glint loaded');
});
```


# attributes

## changed

## blocks

## adapter


# methods

all methods return `this` and are therefore chainable.
and they have two arguments: `function([fn ,] done)`

`fn(block, result)` is called on every block,
`done(err, content)` is called once the operation is done.

## preload
 loading parts without DOM manipulation

## load (Adapter::load -> Block[]::load)
 (either on server or browser depending on browser(true) or false)

## edit (Block[]::edit)
 - Container::load -> Container::edit

## save (Block[]::save -> Adapter::save)
 - save -> load

## cancel (noop)
 - load

## delete (Adapter::delete)
 - delete -> load

## hasChanged


# rendering

rendering (load) is done by default on the server.
editing, saving and deleting is always initiated in the browser.
blocks and widgets can be defined to render in the browser when needed.
however you can also override where the components (blocks and widgets) are rendered all together.
you can use this for example to let everything be rendered on the server,
when the site is being called by a bot, search engine, crawler or the like.

## rendering priorities
(0:low priority ... 3:high priority)

 0 render on server by default

 1 Block.render('browser') or
   Widget.render('browser')
   -> render these items in the browser

 2 Wrap.render('server') or
   Container.render('server')
   -> render ALL items on the server, e.g. when requested by a search engine.

 3 SpecificBlock.render('force:both') or
   Widget.render('force:both)
   -> when a Specific Block has this flag, it will always be rendered on both sides (server and browser)

 4 Same as priority 3 but with 'force:server' or 'force:client'
   -> render always on the server respectively in the browser



# test

```bash
npm test
```

# license

MIT

> sponsored by [intesso](http://intesso.com)
