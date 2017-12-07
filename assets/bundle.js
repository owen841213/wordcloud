(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":3}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
'use strict';

/* global View, WordCloud, __ */

var CanvasView = function CanvasView(opts) {
  this.load(opts, {
    name: 'canvas',
    element: 'wc-canvas',
    canvasElement: 'wc-canvas-canvas',
    hoverElement: 'wc-canvas-hover',
    hoverLabelElement: 'wc-canvas-hover-label'
  });

  window.addEventListener('resize', this);
  this.canvasElement.addEventListener('wordcloudstop', this);

  this.documentWidth = window.innerWidth;
  this.documentHeight = window.innerHeight;

  var style = this.canvasElement.style;
  ['transform',
   'webkitTransform',
   'msTransform',
   'oTransform'].some((function findTransformProperty(prop) {
    if (!(prop in style)) {
      return false;
    }

    this.cssTransformProperty = prop;
    return true;
  }).bind(this));

  this.idleOption = {
    fontFamily: 'Times, serif',
    color: 'rgba(255, 255, 255, 0.8)',
    rotateRatio: 0.5,
    backgroundColor: 'transparent',
    wait: 75,
    list: (function generateLoveList() {
      var list = [];
      var nums = [5, 4, 3, 2, 2];
      // This list of the word "Love" in language of the world was taken from
      // the Language links of entry "Cloud" in English Wikipedia,
      // with duplicate spelling removed.
      var words = ('Arai,Awan,Bodjal,Boira,Bulud,Bulut,Caad,Chmura,Clood,' +
        'Cloud,Cwmwl,Dampog,Debesis,Ewr,Felhő,Hodei,Hûn,Koumoul,Leru,Lipata,' +
        'Mixtli,Moln,Mây,Méga,Mākoņi,Neul,Niula,Nivulu,Nor,Nouage,Nuage,Nube,' +
        'Nubes,Nubia,Nubo,Nuvem,Nuvi,Nuvia,Nuvola,Nwaj,Nívol,Nóvvla,Nùvoła,' +
        'Nùvula,Núvol,Nûl,Nûlêye,Oblaci,Oblak,Phuyu,Pil\'v,Pilv,Pilvi,Qinaya,' +
        'Rahona,Rakun,Retë,Scamall,Sky,Ský,Swarken,Ulap,Vo\'e,Wingu,Wolcen,' +
        'Wolk,Wolke,Wollek,Wulke,dilnu,Νέφος,Абр,Болот,Болытлар,Булут,' +
        'Бұлттар,Воблакі,Облак,Облака,Хмара,Үүл,Ամպ,וואלקן,ענן,' +
        'ابر,بادل,بدل,سحاب,ورېځ,ھەور,ܥܢܢܐ,' +
        'ढग,बादल,सुपाँय्,মেঘ,ਬੱਦਲ,વાદળ,முகில்,' +
        'మేఘం,മേഘം,เมฆ,སྤྲིན།,ღრუბელი,ᎤᎶᎩᎸ,ᓄᕗᔭᖅ,云,雲,구름').split(',');

      nums.forEach(function(n) {
        words.forEach(function(w) {
          list.push([w, n]);
        });
      });

      return list;
    })()
  };
};
CanvasView.prototype = new View();
CanvasView.prototype.TILT_DEPTH = 10;
CanvasView.prototype.beforeShow =
CanvasView.prototype.beforeHide = function cv_beforeShowHide(state, nextState) {
  switch (nextState) {
    case this.app.UI_STATE_SOURCE_DIALOG:
      if (state == this.app.UI_STATE_ABOUT_DIALOG) {
        break;
      }
      this.drawIdleCloud();
      break;

    case this.app.UI_STATE_LOADING:
    case this.app.UI_STATE_WORKING:
      this.empty();
      break;
  }
};
CanvasView.prototype.handleEvent = function cv_handleEvent(evt) {
  switch (evt.type) {
    case 'resize':
      this.documentWidth = window.innerWidth;
      this.documentHeight = window.innerHeight;

      break;

    case 'wordclouddrawn':
      if (evt.detail.drawn) {
        break;
      }

      // Stop the draw.
      evt.preventDefault();

      break;

    case 'wordcloudstop':
      this.canvasElement.removeEventListener('wordclouddrawn', this);

      break;

    case 'mousemove':
      var hw = this.documentWidth / 2;
      var hh = this.documentHeight / 2;
      var x = - (hw - evt.pageX) / hw * this.TILT_DEPTH;
      var y = (hh - evt.pageY) / hh * this.TILT_DEPTH;

      this.canvasElement.style[this.cssTransformProperty] =
        'scale(1.2) translateZ(0) rotateX(' + y + 'deg) rotateY(' + x + 'deg)';

      break;
  }
};
CanvasView.prototype.setDimension = function cv_setDimension(width, height) {
  var el = this.canvasElement;
  width = width ? width : this.documentWidth;
  height = height ? height : this.documentHeight;
  el.setAttribute('width', width);
  el.setAttribute('height', height);
  this.element.style.marginLeft = (- width / 2) + 'px';
  this.element.style.marginTop = (- height / 2) + 'px';
};
CanvasView.prototype.draw = function cv_draw(option) {
  // Have generic font selected based on UI language
  this.canvasElement.lang = '';

  this.hoverElement.setAttribute('hidden', true);
  option.hover = this.handleHover.bind(this);
  // edit by Owen 2017/12/6
  option.click = this.handleClick.bind(this);
  // edit by Owen 2017/12/6

  WordCloud(this.canvasElement, option);
};
CanvasView.prototype.handleHover = function cv_handleHover(item,
                                                           dimension, evt) {
  var el = this.hoverElement;
  if (!item) {
    el.setAttribute('hidden', true);

    return;
  }

  el.removeAttribute('hidden');
  el.style.left = dimension.x + 'px';
  el.style.top = dimension.y + 'px';
  el.style.width = dimension.w + 'px';
  el.style.height = dimension.h + 'px';

  this.hoverDimension = dimension;

  this.hoverLabelElement.setAttribute(
    'data-l10n-args', JSON.stringify({ word: '哈哈', count: item[1] }));
  __(this.hoverLabelElement);
};

// edit by Owen 2017/12/6
CanvasView.prototype.handleClick = function cv_handleClick(item) {
    window.alert(item[0]);

    var edge = require('edge').func('C:\\Users\\Larry\\Desktop\\Testing\\Testing\\bin\\Debug\\Testing.dll');
    var payload = {
        aString: 'WTF'
    };
    console.log('-----> In node.js:');
    console.log(payload);

    edge(payload, function (error, result) {
        if (error) throw error;
    });
};
// edit by Owen 2017/12/6

CanvasView.prototype.drawIdleCloud = function cv_drawIdleCloud() {
  var el = this.canvasElement;
  var width = this.documentWidth;
  var height = this.documentHeight;

  // Only enable the rotation effect on non-touch capable browser.
  if (!('ontouchstart' in window)) {
    document.addEventListener('mousemove', this);
  }

  this.canvasElement.style[this.cssTransformProperty] = 'scale(1.2)';

  this.setDimension(width, height);
  this.idleOption.gridSize = Math.round(16 * width / 1024);
  this.idleOption.weightFactor = function weightFactor(size) {
    return Math.pow(size, 2.3) * width / 1024;
  };

  // Make sure Latin characters looks correct for non-English the UI language
  el.lang = 'en';

  // As soon as there is one word cannot be fit,
  // stop the draw entirely.
  el.addEventListener('wordclouddrawn', this);

  WordCloud(el, this.idleOption);
  this.hoverElement.setAttribute('hidden', true);
};
CanvasView.prototype.empty = function cv_empty() {
  document.removeEventListener('mousemove', this);
  this.canvasElement.style[this.cssTransformProperty] = '';

  WordCloud(this.canvasElement, {
    backgroundColor: 'transparent'
  });
};

},{"edge":5}],5:[function(require,module,exports){
(function (process,__dirname){
var fs = require('fs')
    , path = require('path')
    , builtEdge = path.resolve(__dirname, '../build/Release/' + (process.env.EDGE_USE_CORECLR || !fs.existsSync(path.resolve(__dirname, '../build/Release/edge_nativeclr.node')) ? 'edge_coreclr.node' : 'edge_nativeclr.node'))
    , edge;

var versionMap = [
    [ /^4\./, '4.1.1' ],
    [ /^5\./, '5.1.0' ],
    [ /^6\./, '6.4.0' ],
    [ /^7\./, '7.10.0' ],
];

function determineVersion() {
    for (var i in versionMap) {
        if (process.versions.node.match(versionMap[i][0])) {
            return versionMap[i][1];
        }
    }

    throw new Error('The edge module has not been pre-compiled for node.js version ' + process.version +
        '. You must build a custom version of edge.node. Please refer to https://github.com/tjanczuk/edge ' +
        'for building instructions.');
}
var edgeNative;
if (process.env.EDGE_NATIVE) {
    edgeNative = process.env.EDGE_NATIVE;
}
else if (fs.existsSync(builtEdge)) {
    edgeNative = builtEdge;
}
else if (process.platform === 'win32') {
    edgeNative = path.resolve(__dirname, './native/' + process.platform + '/' + process.arch + '/' + determineVersion() + '/' + (process.env.EDGE_USE_CORECLR ? 'edge_coreclr' : 'edge_nativeclr'));
}
else {
    throw new Error('The edge native module is not available at ' + builtEdge 
        + '. You can use EDGE_NATIVE environment variable to provide alternate location of edge.node. '
        + 'If you need to build edge.node, follow build instructions for your platform at https://github.com/tjanczuk/edge');
}
if (process.env.EDGE_DEBUG) {
    console.log('Load edge native library from: ' + edgeNative);
}
if (edgeNative.match(/edge_coreclr\.node$/i)) {
    // Propagate the choice between desktop and coreclr to edge-cs; this is used in deciding
    // how to compile literal C# at https://github.com/tjanczuk/edge-cs/blob/master/lib/edge-cs.js
    process.env.EDGE_USE_CORECLR = 1;
}
if (process.env.EDGE_USE_CORECLR && !process.env.EDGE_BOOTSTRAP_DIR && fs.existsSync(path.join(__dirname, 'bootstrap', 'bin', 'Release', 'netcoreapp1.0', 'bootstrap.dll'))) {
    process.env.EDGE_BOOTSTRAP_DIR = path.join(__dirname, 'bootstrap', 'bin', 'Release', 'netcoreapp1.0');
}

process.env.EDGE_NATIVE = edgeNative;
edge = require(edgeNative);

exports.func = function(language, options) {
    if (!options) {
        options = language;
        language = 'cs';
    }

    if (typeof options === 'string') {
        if (options.match(/\.dll$/i)) {
            options = { assemblyFile: options };
        }
        else {
            options = { source: options };
        }
    }
    else if (typeof options === 'function') {
        var originalPrepareStackTrace = Error.prepareStackTrace;
        var stack;
        try {
            Error.prepareStackTrace = function(error, stack) {
                return stack;
            };
            stack = new Error().stack;
        }
        finally
        {
            Error.prepareStackTrace = originalPrepareStackTrace;
        }
        
        options = { source: options, jsFileName: stack[1].getFileName(), jsLineNumber: stack[1].getLineNumber() };
    }
    else if (typeof options !== 'object') {
        throw new Error('Specify the source code as string or provide an options object.');
    }

    if (typeof language !== 'string') {
        throw new Error('The first argument must be a string identifying the language compiler to use.');
    }
    else if (!options.assemblyFile) {
        var compilerName = 'edge-' + language.toLowerCase();
        var compiler;
        try {
            compiler = require(compilerName);
        }
        catch (e) {
            throw new Error("Unsupported language '" + language + "'. To compile script in language '" + language +
                "' an npm module '" + compilerName + "' must be installed.");
        }

        try {
            options.compiler = compiler.getCompiler();
        }
        catch (e) {
            throw new Error("The '" + compilerName + "' module required to compile the '" + language + "' language " +
                "does not contain getCompiler() function.");
        }

        if (typeof options.compiler !== 'string') {
            throw new Error("The '" + compilerName + "' module required to compile the '" + language + "' language " +
                "did not specify correct compiler package name or assembly.");
        }

        if (process.env.EDGE_USE_CORECLR) {
            options.bootstrapDependencyManifest = compiler.getBootstrapDependencyManifest();
        }
    }

    if (!options.assemblyFile && !options.source) {
        throw new Error('Provide DLL or source file name or .NET script literal as a string parmeter, or specify an options object '+
            'with assemblyFile or source string property.');
    }
    else if (options.assemblyFile && options.source) {
        throw new Error('Provide either an asseblyFile or source property, but not both.');
    }

    if (typeof options.source === 'function') {
        var match = options.source.toString().match(/[^]*\/\*([^]*)\*\/\s*\}$/);
        if (match) {
            options.source = match[1];
        }
        else {
            throw new Error('If .NET source is provided as JavaScript function, function body must be a /* ... */ comment.');
        }
    }

    if (options.references !== undefined) {
        if (!Array.isArray(options.references)) {
            throw new Error('The references property must be an array of strings.');
        }

        options.references.forEach(function (ref) {
            if (typeof ref !== 'string') {
                throw new Error('The references property must be an array of strings.');
            }
        });
    }

    if (options.assemblyFile) {
        if (!options.typeName) {
            var matched = options.assemblyFile.match(/([^\\\/]+)\.dll$/i);
            if (!matched) {
                throw new Error('Unable to determine the namespace name based on assembly file name. ' +
                    'Specify typeName parameter as a namespace qualified CLR type name of the application class.');
            }

            options.typeName = matched[1] + '.Startup';
        }
    }
    else if (!options.typeName) {
        options.typeName = "Startup";
    }

    if (!options.methodName) {
        options.methodName = 'Invoke';
    }

    return edge.initializeClrFunc(options);
};

}).call(this,require('_process'),"/..\\..\\..\\node_modules\\edge\\lib")
},{"_process":3,"fs":1,"path":2}]},{},[4]);
