/**
 * Module dependencies.
 */
var debug = require('debug')('glint-container');
var isBrowser = require('is-browser');
var defaults = require('defaults');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var eachSync = require('glint-util/each-sync');


/**
 * Expose Container element.
 */
exports = module.exports = Container;
inherits(Container, EventEmitter);

/**
 * Initialize a new `Container` element.
 */

function Container(blocks, adapter) {
  if (!(this instanceof Container)) return new Container(blocks, adapter);
  if (blocks) this.blocks(blocks);
  if (adapter) this.adapter(adapter);
  this.init();
}


/**
 * API functions.
 */
Container.prototype.api = Container.api = 'container';

/**
 * content {Object}
 */
Container.prototype.content;

/**
 * Use the given `plugin`.
 *
 * @param {Function} plugin
 * @returns {Object} instance
 * @api public
 */
Container.prototype.use = function(plugin) {
  plugin(this);
  return this;
};

['blocks', 'adapter', 'key', 'id', 'place', 'template', 'editable'].forEach(function(attribute) {
  Container.prototype[attribute] = function(value) {
    this.emit(attribute, value);
    if (typeof value !== 'undefined') {
      this['_' + attribute] = value;
      return this;
    }
    return this['_' + attribute];
  };
});

Container.prototype.load = function(context, done) {
  if (typeof context === 'function') done = context, context = undefined;
  done = done || noop, context = context || {};
  if ((this.loading || this.editingLoaded) && !this.transition) return done();

  this.emit('pre-load');

  var self = this;
  var id = this._templateLoaded || this._id;

  // 1. retrieve the content via adapter
  _load(id);
  function _load(id) {
    self._adapter.load(id, function(err, result) {
      if (err) {
        if (self._editable && !self._templateLoaded) {
          // 1.1. edge case: new document (id does not exist) -> load the template document
          self._templateLoaded = self._template;
          return _load(self._template);
        }
        if (self._templateLoaded) {
          // 1.2. even edgier case: no template document was found -> load empty object
          result = {};
        } else {
          return done(err);
        }
      }

      self._templateLoaded = undefined;
      self.loading = true;
      var content = self.content = defaults(result, context);
      debug('load', id, err, content);

      // merge missing blocks into content object with empty value
      Object.keys(self._blocks).forEach(function(key){
        if (!content[key]) content[key] = '';
      })

      // 2. load the content into the blocks
      Object.keys(content).forEach(function(key) {
        var block = self._blocks[key];
        if (!block || !typeof block.load == 'function') return;
        if (self.skip(block)) {
          if (!isBrowser) content[key] = '';
          return;
        }
        self.emit('load', key, content[key], self.block);
        content[key] = block.load(content[key]);
      });

      if (self.transition) self.reset();
      self.emit('post-load', self.content);
      done(null, self.content);
      self.loading = false;
    });
  }

  return this;
};

Container.prototype.edit = function(done) {
  done = done || noop;
  var self = this, id = this._id;
  if (this.editing) return done();
  this.editing = true;

  // 1. call load
  this.load(function(err, content) {
    // 2. edit
    self.emit('pre-edit');
    debug('edit', id, err, content);

    Object.keys(content).forEach(function(key) {
      var block = self._blocks[key];
      if (!block || !typeof block.edit == 'function') return;
      self.emit('edit', key, content[key]);
      block.edit();
    });

    self.emit('post-edit');
    done(null, self.content);
    self.editingLoaded = true;
    return self;
  });

  return this;
};

Container.prototype.save = function(done) {
  done = done || noop;
  if (this.transition || !this.editing) return done();
  this.transition = true;

  this.emit('pre-save');

  var self = this, id = this._id;
  var content = this.content;

  // 1. save the content from the block synchronously
  Object.keys(content).forEach(function(key) {
    var block = self._blocks[key];
    if (!block || !typeof block.save == 'function') return;
    self.emit('save', key, content[key]);
    content[key] = block.save();
  });

  // 2. store the content via the adapter
  this._adapter.save(id, content, function(err, content) {
    debug('save', id, err, content);

    // 3. load the stored content back
    self.load(function(err, content) {
      self.emit('post-save');
      done(err, content);
    });

  });

  return this;
};

Container.prototype.cancel = function(done) {
  done = done || noop;
  if (this.transition || !this.editing) return done();
  this.transition = true;

  this.emit('pre-cancel');

  var self = this, id = this._id;
  var content = this.content;
  debug('cancel', id, null, content);

  Object.keys(content).forEach(function(key) {
    var block = self._blocks[key];
    if (!block || !typeof block.cancel == 'function') return;
    self.emit('cancel', key, content[key]);
    block.cancel();
  });

  this.load(function(err, content) {
    self.emit('post-cancel');
    done(err, content);
  });


  return this;
};

Container.prototype.delete = function(done) {
  done = done || noop;

  if (this.transition || !this.editing) return done();
  this.transition = true;

  this.emit('pre-delete');

  var self = this, id = this._id;

  // delete the content via the adapter
  this._adapter.delete(id, function(err, content) {
    debug('delete', id, err, content);
    self.emit('delete', undefined, content);
    self.load(function(err, content) {
      self.emit('post-delete');
      done(err, content);
    });

  });

  return this;
};

/**
 * Helper Functions
 */

Container.prototype.init = function() {

  // initialize member variables with default values
  this._template = this._template || '__template__';
  this._editable = typeof this._editable !== 'undefined' ? this._editable : false;

  /**
   * The `editing` attribute is not a very sophisticated implementation, but rather simple.
   * It is:
   *
   *  - set to {true} after: `edit`
   *  - set to {false} after: `load`, `save`, `delete`, `cancel`
   *
   * @type {boolean}
   */
  this.editing = false;

  // set blocks id's.
  this.on('blocks', function(controllers) {
    if (!controllers) return;
    Object.keys(controllers).forEach(function(key) {
      var controller = controllers[key];
      var id = controller.id();
      if (!id) controller.id(key);
    });
  });
};

Container.prototype.skip = function skip(item) {
  if (!item) return false;
  var p1 = (typeof item.place == 'function') ? item.place() : undefined;
  var p2 = this._place || process.env.GLINT_PLACE || 'server';
  var p3 = (item.block && typeof item.block.place == 'function') ? item.block.place() : undefined;

  // general rules
  if (p3 == 'force:both') return false;

  if (!isBrowser) {

    // server rules
    if (p3 == 'force:server') return false;
    if (p3 == 'force:browser') return true;

    if (p2 == 'browser') return true;
    if (p2 == 'server') return false;
    if (p1 == 'browser') return true;

  } else {

    // browser rules
    if (this.editing) return false;
    if (p3 == 'force:server') return true;
    if (p3 == 'force:browser') return false;
    if (p2 == 'server') return true;
    if (p2 == 'browser') return false;
    if (p1 == 'server') return true;

  }

  // default don't skip
  return false;
};

Container.prototype.reset = function reset() {
  this.transition = this.editing = this.editingLoaded = false;
  this._templateLoaded = undefined;
};

function noop() {
};
