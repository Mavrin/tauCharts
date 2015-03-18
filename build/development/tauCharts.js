/*! taucharts - v0.3.22 - 2015-03-18
* https://github.com/TargetProcess/tauCharts
* Copyright (c) 2015 Taucraft Limited; Licensed Apache License 2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'd3'],function(_,d3){return factory(_, d3);});
    } else if (typeof module === "object" && module.exports) {
        var _ = require('underscore');
        var d3 = require('d3');
        module.exports = factory(_, d3);
    } else {
        root.tauCharts = factory(root._, root.d3);
    }
}(this, function (_, d3) {/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../node_modules/almond/almond", function(){});

define('utils/utils-dom',["exports"], function (exports) {
    

    /**
     * Internal method to return CSS value for given element and property
     */
    var tempDiv = document.createElement("div");

    var utilsDom = {
        appendTo: function (el, container) {
            var node;
            if (el instanceof Node) {
                node = el;
            } else {
                tempDiv.insertAdjacentHTML("afterbegin", el);
                node = tempDiv.childNodes[0];
            }
            container.appendChild(node);
            return node;
        },
        getScrollbarWidth: function () {
            var div = document.createElement("div");
            div.style.overflow = "scroll";
            div.style.visibility = "hidden";
            div.style.position = "absolute";
            div.style.width = "100px";
            div.style.height = "100px";

            document.body.appendChild(div);

            var r = div.offsetWidth - div.clientWidth;

            document.body.removeChild(div);

            return r;
        },

        getStyle: function (el, prop) {
            return window.getComputedStyle(el, undefined).getPropertyValue(prop);
        },

        getStyleAsNum: function (el, prop) {
            return parseInt(this.getStyle(el, prop) || 0, 10);
        },

        getContainerSize: function (el) {
            var pl = this.getStyleAsNum(el, "padding-left");
            var pr = this.getStyleAsNum(el, "padding-right");
            var pb = this.getStyleAsNum(el, "padding-bottom");
            var pt = this.getStyleAsNum(el, "padding-top");

            var borderWidthT = this.getStyleAsNum(el, "border-top-width");
            var borderWidthL = this.getStyleAsNum(el, "border-left-width");
            var borderWidthR = this.getStyleAsNum(el, "border-right-width");
            var borderWidthB = this.getStyleAsNum(el, "border-bottom-width");

            var bw = borderWidthT + borderWidthL + borderWidthR + borderWidthB;

            var rect = el.getBoundingClientRect();

            return {
                width: rect.width - pl - pr - 2 * bw,
                height: rect.height - pb - pt - 2 * bw
            };
        },

        getAxisTickLabelSize: function (text) {
            var tmpl = ["<svg class=\"graphical-report__svg\">", "<g class=\"graphical-report__cell cell\">", "<g class=\"x axis\">", "<g class=\"tick\"><text><%= xTick %></text></g>", "</g>",
            //'<g class="y axis">',
            //'<g class="tick"><text><%= xTick %></text></g>',
            //'</g>',
            "</g>", "</svg>"].join("");

            var compiled = _.template(tmpl);

            var div = document.createElement("div");
            div.style.position = "absolute";
            div.style.visibility = "hidden";
            div.style.width = "100px";
            div.style.height = "100px";
            div.style.border = "1px solid green";
            document.body.appendChild(div);

            div.innerHTML = compiled({ xTick: text });

            var textNode = d3.select(div).selectAll(".x.axis .tick text")[0][0];

            var size = {
                width: 0,
                height: 0
            };

            // Internet Explorer, Firefox 3+, Google Chrome, Opera 9.5+, Safari 4+
            var rect = textNode.getBoundingClientRect();
            size.width = rect.right - rect.left;
            size.height = rect.bottom - rect.top;

            var avgLetterSize = text.length !== 0 ? size.width / text.length : 0;
            size.width = size.width + 1.5 * avgLetterSize;

            document.body.removeChild(div);

            return size;
        }
    };
    exports.utilsDom = utilsDom;
    exports.__esModule = true;
});
define('dsl-reader',["exports"], function (exports) {
    

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    var DSLReader = exports.DSLReader = (function () {
        function DSLReader(domainMixin, UnitsRegistry) {
            this.domain = domainMixin;
            this.UnitsRegistry = UnitsRegistry;
        }

        _prototypeProperties(DSLReader, null, {
            buildGraph: {
                value: function buildGraph(spec) {
                    var _this = this;
                    var buildRecursively = function (unit) {
                        return _this.UnitsRegistry.get(unit.type).walk(_this.domain.mix(unit), buildRecursively);
                    };
                    return buildRecursively(spec.unit);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            calcLayout: {
                value: function calcLayout(graph, size) {
                    graph.options = { top: 0, left: 0, width: size.width, height: size.height };

                    var fnTraverseLayout = function (root) {
                        if (!root.$matrix) {
                            return root;
                        }

                        var options = root.options;
                        var padding = root.guide.padding;

                        var innerW = options.width - (padding.l + padding.r);
                        var innerH = options.height - (padding.t + padding.b);

                        var nRows = root.$matrix.sizeR();
                        var nCols = root.$matrix.sizeC();

                        var cellW = innerW / nCols;
                        var cellH = innerH / nRows;

                        var calcLayoutStrategy;
                        if (root.guide.split) {
                            calcLayoutStrategy = {
                                calcHeight: function (cellHeight, rowIndex, elIndex, lenIndex) {
                                    return cellHeight / lenIndex;
                                },
                                calcTop: function (cellHeight, rowIndex, elIndex, lenIndex) {
                                    return (rowIndex + 1) * (cellHeight / lenIndex) * elIndex;
                                }
                            };
                        } else {
                            calcLayoutStrategy = {
                                calcHeight: function (cellHeight, rowIndex, elIndex, lenIndex) {
                                    return cellHeight;
                                },
                                calcTop: function (cellHeight, rowIndex, elIndex, lenIndex) {
                                    return rowIndex * cellH;
                                }
                            };
                        }

                        root.childUnits = root.childUnits || [];
                        root.$matrix.iterate(function (iRow, iCol, subNodes) {
                            var len = subNodes.length;
                            subNodes.forEach(function (subNode, i) {
                                subNode.options = {
                                    width: cellW,
                                    left: iCol * cellW,
                                    height: calcLayoutStrategy.calcHeight(cellH, iRow, i, len),
                                    top: calcLayoutStrategy.calcTop(cellH, iRow, i, len)
                                };
                                root.childUnits.push(subNode);
                                fnTraverseLayout(subNode);
                            });
                        });

                        return root;
                    };

                    return fnTraverseLayout(graph);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            renderGraph: {
                value: function renderGraph(styledGraph, target, xIterator) {
                    var _this = this;
                    var iterator = xIterator || function (x) {
                        return x;
                    };
                    styledGraph.options.container = target;
                    var renderRecursively = function (unit) {
                        var unitMeta = _this.domain.mix(unit);
                        var subSpace = _this.UnitsRegistry.get(unit.type).draw(unitMeta);

                        var children = unit.childUnits || [];
                        children.forEach(function (child) {
                            child.options = _.extend({ container: subSpace }, child.options);
                            child.parentUnit = unit;
                            renderRecursively(child);
                        });

                        iterator(unitMeta);
                    };
                    styledGraph.parentUnit = null;
                    renderRecursively(styledGraph);
                    return styledGraph.options.container;
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return DSLReader;
    })();
    exports.__esModule = true;
});
define('const',["exports"], function (exports) {
  

  var CSS_PREFIX = exports.CSS_PREFIX = "graphical-report__";
  exports.__esModule = true;
});
define('api/balloon',["exports", "../const"], function (exports, _const) {
    

    var CSS_PREFIX = _const.CSS_PREFIX;
    // jshint ignore: start
    var classes = function (el) {
        return {
            add: function (name) {
                el.classList.add(name);
            },
            remove: function (name) {
                el.classList.remove(name);
            }
        };
    };


    var indexOf = function (arr, obj) {
        return arr.indexOf(obj);
    };

    /**
     * Globals.
     */
    var win = window;
    var doc = win.document;
    var body = doc.body;
    var docEl = doc.documentElement;
    var verticalPlaces = ["top", "bottom"];

    /**
     * Poor man's shallow object extend.
     *
     * @param {Object} a
     * @param {Object} b
     *
     * @return {Object}
     */
    function extend(a, b) {
        for (var key in b) {
            // jshint ignore:line
            a[key] = b[key];
        }
        return a;
    }

    /**
     * Checks whether object is window.
     *
     * @param {Object} obj
     *
     * @return {Boolean}
     */
    function isWin(obj) {
        return obj && obj.setInterval != null;
    }

    /**
     * Returns element's object with `left`, `top`, `bottom`, `right`, `width`, and `height`
     * properties indicating the position and dimensions of element on a page.
     *
     * @param {Element} element
     *
     * @return {Object}
     */
    function position(element) {
        var winTop = win.pageYOffset || docEl.scrollTop;
        var winLeft = win.pageXOffset || docEl.scrollLeft;
        var box = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };

        if (isWin(element)) {
            box.width = win.innerWidth || docEl.clientWidth;
            box.height = win.innerHeight || docEl.clientHeight;
        } else if (docEl.contains(element) && element.getBoundingClientRect != null) {
            extend(box, element.getBoundingClientRect());
            // width & height don't exist in <IE9
            box.width = box.right - box.left;
            box.height = box.bottom - box.top;
        } else {
            return box;
        }

        box.top = box.top + winTop - docEl.clientTop;
        box.left = box.left + winLeft - docEl.clientLeft;
        box.right = box.left + box.width;
        box.bottom = box.top + box.height;

        return box;
    }
    /**
     * Parse integer from strings like '-50px'.
     *
     * @param {Mixed} value
     *
     * @return {Integer}
     */
    function parsePx(value) {
        return 0 | Math.round(String(value).replace(/[^\-0-9.]/g, ""));
    }

    /**
     * Get computed style of element.
     *
     * @param {Element} element
     *
     * @type {String}
     */
    var style = win.getComputedStyle;

    /**
     * Returns transition duration of element in ms.
     *
     * @param {Element} element
     *
     * @return {Integer}
     */
    function transitionDuration(element) {
        var duration = String(style(element, transitionDuration.propName));
        var match = duration.match(/([0-9.]+)([ms]{1,2})/);
        if (match) {
            duration = Number(match[1]);
            if (match[2] === "s") {
                duration *= 1000;
            }
        }
        return 0 | duration;
    }
    transitionDuration.propName = (function () {
        var element = doc.createElement("div");
        var names = ["transitionDuration", "webkitTransitionDuration"];
        var value = "1s";
        for (var i = 0; i < names.length; i++) {
            element.style[names[i]] = value;
            if (element.style[names[i]] === value) {
                return names[i];
            }
        }
    })();
    var objectCreate = Object.create;
    /**
     * Tooltip construnctor.
     *
     * @param {String|Element} content
     * @param {Object}         options
     *
     * @return {Tooltip}
     */
    function Tooltip(content, options) {
        if (!(this instanceof Tooltip)) {
            return new Tooltip(content, options);
        }
        this.hidden = 1;
        this.options = extend(objectCreate(Tooltip.defaults), options);
        this._createElement();
        if (content) {
            this.content(content);
        }
    }

    /**
     * Creates a tooltip element.
     *
     * @return {Void}
     */
    Tooltip.prototype._createElement = function () {
        this.element = doc.createElement("div");
        this.classes = classes(this.element);
        this.classes.add(this.options.baseClass);
        var propName;
        for (var i = 0; i < Tooltip.classTypes.length; i++) {
            propName = Tooltip.classTypes[i] + "Class";
            if (this.options[propName]) {
                this.classes.add(this.options[propName]);
            }
        }
    };

    /**
     * Changes tooltip's type class type.
     *
     * @param {String} name
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.type = function (name) {
        return this.changeClassType("type", name);
    };

    /**
     * Changes tooltip's effect class type.
     *
     * @param {String} name
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.effect = function (name) {
        return this.changeClassType("effect", name);
    };

    /**
     * Changes class type.
     *
     * @param {String} propName
     * @param {String} newClass
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.changeClassType = function (propName, newClass) {
        propName += "Class";
        if (this.options[propName]) {
            this.classes.remove(this.options[propName]);
        }
        this.options[propName] = newClass;
        if (newClass) {
            this.classes.add(newClass);
        }
        return this;
    };

    /**
     * Updates tooltip's dimensions.
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.updateSize = function () {
        if (this.hidden) {
            this.element.style.visibility = "hidden";
            body.appendChild(this.element);
        }
        this.width = this.element.offsetWidth;
        this.height = this.element.offsetHeight;
        if (this.spacing == null) {
            this.spacing = this.options.spacing != null ? this.options.spacing : parsePx(style(this.element, "top"));
        }
        if (this.hidden) {
            body.removeChild(this.element);
            this.element.style.visibility = "";
        } else {
            this.position();
        }
        return this;
    };

    /**
     * Change tooltip content.
     *
     * When tooltip is visible, its size is automatically
     * synced and tooltip correctly repositioned.
     *
     * @param {String|Element} content
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.content = function (content) {
        if (typeof content === "object") {
            this.element.innerHTML = "";
            this.element.appendChild(content);
        } else {
            this.element.innerHTML = content;
        }
        this.updateSize();
        return this;
    };

    /**
     * Pick new place tooltip should be displayed at.
     *
     * When the tooltip is visible, it is automatically positioned there.
     *
     * @param {String} place
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.place = function (place) {
        this.options.place = place;
        if (!this.hidden) {
            this.position();
        }
        return this;
    };

    /**
     * Attach tooltip to an element.
     *
     * @param {Element} element
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.attach = function (element) {
        this.attachedTo = element;
        if (!this.hidden) {
            this.position();
        }
        return this;
    };

    /**
     * Detach tooltip from element.
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.detach = function () {
        this.hide();
        this.attachedTo = null;
        return this;
    };

    /**
     * Pick the most reasonable place for target position.
     *
     * @param {Object} target
     *
     * @return {Tooltip}
     */
    Tooltip.prototype._pickPlace = function (target) {
        if (!this.options.auto) {
            return this.options.place;
        }
        var winPos = position(win);
        var place = this.options.place.split("-");
        var spacing = this.spacing;

        if (~indexOf(verticalPlaces, place[0])) {
            if (target.top - this.height - spacing <= winPos.top) {
                place[0] = "bottom";
            } else if (target.bottom + this.height + spacing >= winPos.bottom) {
                place[0] = "top";
            }
            switch (place[1]) {
                case "left":
                    if (target.right - this.width <= winPos.left) {
                        place[1] = "right";
                    }
                    break;
                case "right":
                    if (target.left + this.width >= winPos.right) {
                        place[1] = "left";
                    }
                    break;
                default:
                    if (target.left + target.width / 2 + this.width / 2 >= winPos.right) {
                        place[1] = "left";
                    } else if (target.right - target.width / 2 - this.width / 2 <= winPos.left) {
                        place[1] = "right";
                    }
            }
        } else {
            if (target.left - this.width - spacing <= winPos.left) {
                place[0] = "right";
            } else if (target.right + this.width + spacing >= winPos.right) {
                place[0] = "left";
            }
            switch (place[1]) {
                case "top":
                    if (target.bottom - this.height <= winPos.top) {
                        place[1] = "bottom";
                    }
                    break;
                case "bottom":
                    if (target.top + this.height >= winPos.bottom) {
                        place[1] = "top";
                    }
                    break;
                default:
                    if (target.top + target.height / 2 + this.height / 2 >= winPos.bottom) {
                        place[1] = "top";
                    } else if (target.bottom - target.height / 2 - this.height / 2 <= winPos.top) {
                        place[1] = "bottom";
                    }
            }
        }

        return place.join("-");
    };

    /**
     * Position the element to an element or a specific coordinates.
     *
     * @param {Integer|Element} x
     * @param {Integer}         y
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.position = function (x, y) {
        if (this.attachedTo) {
            x = this.attachedTo;
        }
        if (x == null && this._p) {
            x = this._p[0];
            y = this._p[1];
        } else {
            this._p = arguments;
        }
        var target = typeof x === "number" ? {
            left: 0 | x,
            right: 0 | x,
            top: 0 | y,
            bottom: 0 | y,
            width: 0,
            height: 0
        } : position(x);
        var spacing = this.spacing;
        var newPlace = this._pickPlace(target);

        // Add/Change place class when necessary
        if (newPlace !== this.curPlace) {
            if (this.curPlace) {
                this.classes.remove(this.curPlace);
            }
            this.classes.add(newPlace);
            this.curPlace = newPlace;
        }

        // Position the tip
        var top, left;
        switch (this.curPlace) {
            case "top":
                top = target.top - this.height - spacing;
                left = target.left + target.width / 2 - this.width / 2;
                break;
            case "top-left":
                top = target.top - this.height - spacing;
                left = target.right - this.width;
                break;
            case "top-right":
                top = target.top - this.height - spacing;
                left = target.left;
                break;

            case "bottom":
                top = target.bottom + spacing;
                left = target.left + target.width / 2 - this.width / 2;
                break;
            case "bottom-left":
                top = target.bottom + spacing;
                left = target.right - this.width;
                break;
            case "bottom-right":
                top = target.bottom + spacing;
                left = target.left;
                break;

            case "left":
                top = target.top + target.height / 2 - this.height / 2;
                left = target.left - this.width - spacing;
                break;
            case "left-top":
                top = target.bottom - this.height;
                left = target.left - this.width - spacing;
                break;
            case "left-bottom":
                top = target.top;
                left = target.left - this.width - spacing;
                break;

            case "right":
                top = target.top + target.height / 2 - this.height / 2;
                left = target.right + spacing;
                break;
            case "right-top":
                top = target.bottom - this.height;
                left = target.right + spacing;
                break;
            case "right-bottom":
                top = target.top;
                left = target.right + spacing;
                break;
        }

        // Set tip position & class
        this.element.style.top = Math.round(top) + "px";
        this.element.style.left = Math.round(left) + "px";

        return this;
    };

    /**
     * Show the tooltip.
     *
     * @param {Integer|Element} x
     * @param {Integer}         y
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.show = function (x, y) {
        x = this.attachedTo ? this.attachedTo : x;

        // Clear potential ongoing animation
        clearTimeout(this.aIndex);

        // Position the element when requested
        if (x != null) {
            this.position(x, y);
        }

        // Stop here if tip is already visible
        if (this.hidden) {
            this.hidden = 0;
            body.appendChild(this.element);
        }

        // Make tooltip aware of window resize
        if (this.attachedTo) {
            this._aware();
        }

        // Trigger layout and kick in the transition
        if (this.options.inClass) {
            if (this.options.effectClass) {
                void this.element.clientHeight;
            }
            this.classes.add(this.options.inClass);
        }

        return this;
    };
    Tooltip.prototype.getElement = function (x, y) {
        return this.element;
    };

    /**
     * Hide the tooltip.
     *
     * @return {Tooltip}
     */
    Tooltip.prototype.hide = function () {
        if (this.hidden) {
            return;
        }

        var self = this;
        var duration = 0;

        // Remove .in class and calculate transition duration if any
        if (this.options.inClass) {
            this.classes.remove(this.options.inClass);
            if (this.options.effectClass) {
                duration = transitionDuration(this.element);
            }
        }

        // Remove tip from window resize awareness
        if (this.attachedTo) {
            this._unaware();
        }

        // Remove the tip from the DOM when transition is done
        clearTimeout(this.aIndex);
        this.aIndex = setTimeout(function () {
            self.aIndex = 0;
            body.removeChild(self.element);
            self.hidden = 1;
        }, duration);

        return this;
    };

    Tooltip.prototype.toggle = function (x, y) {
        return this[this.hidden ? "show" : "hide"](x, y);
    };

    Tooltip.prototype.destroy = function () {
        clearTimeout(this.aIndex);
        this._unaware();
        if (!this.hidden) {
            body.removeChild(this.element);
        }
        this.element = this.options = null;
    };

    /**
     * Make the tip window resize aware.
     *
     * @return {Void}
     */
    Tooltip.prototype._aware = function () {
        var index = indexOf(Tooltip.winAware, this);
        if (! ~index) {
            Tooltip.winAware.push(this);
        }
    };

    /**
     * Remove the window resize awareness.
     *
     * @return {Void}
     */
    Tooltip.prototype._unaware = function () {
        var index = indexOf(Tooltip.winAware, this);
        if (~index) {
            Tooltip.winAware.splice(index, 1);
        }
    };

    /**
     * Handles repositioning of tooltips on window resize.
     *
     * @return {Void}
     */
    Tooltip.reposition = (function () {
        var rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (fn) {
            return setTimeout(fn, 17);
        };
        var rIndex;

        function requestReposition() {
            if (rIndex || !Tooltip.winAware.length) {
                return;
            }
            rIndex = rAF(reposition);
        }

        function reposition() {
            rIndex = 0;
            var tip;
            for (var i = 0, l = Tooltip.winAware.length; i < l; i++) {
                tip = Tooltip.winAware[i];
                tip.position();
            }
        }

        return requestReposition;
    })();
    Tooltip.winAware = [];

    // Bind winAware repositioning to window resize event
    window.addEventListener("resize", Tooltip.reposition);
    window.addEventListener("scroll", Tooltip.reposition);

    /**
     * Array with dynamic class types.
     *
     * @type {Array}
     */
    Tooltip.classTypes = ["type", "effect"];

    /**
     * Default options for Tooltip constructor.
     *
     * @type {Object}
     */
    Tooltip.defaults = {
        baseClass: CSS_PREFIX + "tooltip", // Base tooltip class name.
        typeClass: null, // Type tooltip class name.
        effectClass: null, // Effect tooltip class name.
        inClass: "in", // Class used to transition stuff in.
        place: "top", // Default place.
        spacing: null, // Gap between target and tooltip.
        auto: 0 // Whether to automatically adjust place to fit into window.
    };

    exports.Tooltip = Tooltip;
    exports.__esModule = true;
});
define('event',["exports"], function (exports) {
    

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    var NULL_HANDLER = {};
    var events = {};


    /**
     * Creates new type of event or returns existing one, if it was created before.
     * @param {string} eventName
     * @return {function(..eventArgs)}
     */
    function createDispatcher(eventName) {
        var eventFunction = events[eventName];

        if (!eventFunction) {
            eventFunction = function () {
                var cursor = this;
                var args;
                var fn;
                var i = 0;
                while (cursor = cursor.handler) {
                    // jshint ignore:line
                    // callback call
                    fn = cursor.callbacks[eventName];
                    if (typeof fn === "function") {
                        if (!args) {
                            // it should be better for browser optimizations
                            // (instead of [this].concat(slice.call(arguments)))
                            args = [this];
                            for (i = 0; i < arguments.length; i++) {
                                args.push(arguments[i]);
                            }
                        }

                        fn.apply(cursor.context, args);
                    }

                    // any event callback call
                    fn = cursor.callbacks["*"];
                    if (typeof fn === "function") {
                        if (!args) {
                            // it should be better for browser optimizations
                            // (instead of [this].concat(slice.call(arguments)))
                            args = [this];
                            for (i = 0; i < arguments.length; i++) {
                                args.push(arguments[i]);
                            }
                        }

                        fn.call(cursor.context, {
                            sender: this,
                            type: eventName,
                            args: args
                        });
                    }
                }
            };

            events[eventName] = eventFunction;
        }

        return eventFunction;
    }

    /**
     * Base class for event dispatching. It provides interface for instance
     * to add and remove handler for desired events, and call it when event happens.
     * @class
     */

    var Emitter = (function () {
        /**
         * @constructor
         */
        function Emitter() {
            this.handler = null;
            this.emit_destroy = createDispatcher("destroy");
        }

        _prototypeProperties(Emitter, null, {
            addHandler: {

                /**
                 * Adds new event handler to object.
                 * @param {object} callbacks Callback set.
                 * @param {object=} context Context object.
                 */
                value: function addHandler(callbacks, context) {
                    context = context || this;
                    // add handler
                    this.handler = {
                        callbacks: callbacks,
                        context: context,
                        handler: this.handler
                    };
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            on: {
                value: function on(name, callback, context) {
                    var obj = {};
                    obj[name] = callback;
                    this.addHandler(obj, context);
                    return obj;
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            fire: {
                value: function fire(name, data) {
                    createDispatcher.call(this, name).call(this, data);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            removeHandler: {

                /**
                 * Removes event handler set from object. For this operation parameters
                 * must be the same (equivalent) as used for addHandler method.
                 * @param {object} callbacks Callback set.
                 * @param {object=} context Context object.
                 */
                value: function removeHandler(callbacks, context) {
                    var cursor = this;
                    var prev;

                    context = context || this;

                    // search for handler and remove it
                    while ((prev = cursor, cursor = cursor.handler)) {
                        // jshint ignore:line
                        if (cursor.callbacks === callbacks && cursor.context === context) {
                            // make it non-callable
                            cursor.callbacks = NULL_HANDLER;

                            // remove from list
                            prev.handler = cursor.handler;

                            return;
                        }
                    }


                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            destroy: {

                /**
                 * @destructor
                 */
                value: function destroy() {
                    // fire object destroy event handlers
                    this.emit_destroy();
                    // drop event handlers if any
                    this.handler = null;
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return Emitter;
    })();

    //
    // export names
    //
    exports.Emitter = Emitter;
    exports.__esModule = true;
});
define('utils/utils',["exports"], function (exports) {
    

    var traverseJSON = function (srcObject, byProperty, fnSelectorPredicates, funcTransformRules) {
        var rootRef = funcTransformRules(fnSelectorPredicates(srcObject), srcObject);

        (rootRef[byProperty] || []).forEach(function (unit) {
            return traverseJSON(unit, byProperty, fnSelectorPredicates, funcTransformRules);
        });

        return rootRef;
    };

    var utils = {
        clone: function (obj) {
            return JSON.parse(JSON.stringify(obj));
        },
        isArray: function (obj) {
            return Array.isArray(obj);
        },

        autoScale: function (domain) {
            var m = 10;

            var low = Math.min.apply(null, domain);
            var top = Math.max.apply(null, domain);

            if (low === top) {
                var k = top >= 0 ? -1 : 1;
                var d = top || 1;
                top = top - k * d / m;
            }

            var extent = [low, top];
            var span = extent[1] - extent[0];
            var step = Math.pow(10, Math.floor(Math.log(span / m) / Math.LN10));
            var err = m / span * step;

            var correction = [[0.15, 10], [0.35, 5], [0.75, 2], [1, 1], [2, 1]];

            var i = -1;
            while (err > correction[++i][0]) {}

            step *= correction[i][1];

            extent[0] = Math.floor(extent[0] / step) * step;
            extent[1] = Math.ceil(extent[1] / step) * step;

            var deltaLow = low - extent[0];
            var deltaTop = extent[1] - top;

            var limit = step / 2;

            if (low >= 0) {
                // include 0 by default
                extent[0] = 0;
            } else {
                var koeffLow = deltaLow <= limit ? step : 0;
                extent[0] = extent[0] - koeffLow;
            }

            if (top <= 0) {
                // include 0 by default
                extent[1] = 0;
            } else {
                var koeffTop = deltaTop <= limit ? step : 0;
                extent[1] = extent[1] + koeffTop;
            }

            return [parseFloat(extent[0].toFixed(15)), parseFloat(extent[1].toFixed(15))];
        },

        traverseJSON: traverseJSON
    };

    exports.utils = utils;
    exports.__esModule = true;
});
define('formatter-registry',["exports", "d3"], function (exports, _d3) {
    

    /* jshint ignore:start */
    var d3 = _d3;
    /* jshint ignore:end */
    var FORMATS_MAP = {

        "x-num-auto": function (x) {
            var v = parseFloat(x.toFixed(2));
            return Math.abs(v) < 1 ? v.toString() : d3.format("s")(v);
        },

        percent: function (x) {
            var v = parseFloat((x * 100).toFixed(2));
            return v.toString() + "%";
        },

        day: d3.time.format("%d-%b-%Y"),

        "day-short": d3.time.format("%d-%b"),

        week: d3.time.format("%d-%b-%Y"),

        "week-short": d3.time.format("%d-%b"),

        month: function (x) {
            var d = new Date(x);
            var m = d.getMonth();
            var formatSpec = m === 0 ? "%B, %Y" : "%B";
            return d3.time.format(formatSpec)(x);
        },

        "month-short": function (x) {
            var d = new Date(x);
            var m = d.getMonth();
            var formatSpec = m === 0 ? "%b '%y" : "%b";
            return d3.time.format(formatSpec)(x);
        },

        "month-year": d3.time.format("%B, %Y"),

        quarter: function (x) {
            var d = new Date(x);
            var m = d.getMonth();
            var q = (m - m % 3) / 3;
            return "Q" + (q + 1) + " " + d.getFullYear();
        },

        year: d3.time.format("%Y"),

        "x-time-auto": null
    };

    var FormatterRegistry = {

        get: function (formatAlias, nullOrUndefinedAlias) {
            var nullAlias = nullOrUndefinedAlias || "";

            var identity = function (x) {
                return (x === null || typeof x === "undefined" ? nullAlias : x).toString();
            };

            var hasFormat = FORMATS_MAP.hasOwnProperty(formatAlias);
            var formatter = hasFormat ? FORMATS_MAP[formatAlias] : identity;

            if (hasFormat) {
                formatter = FORMATS_MAP[formatAlias];
            }

            if (!hasFormat && formatAlias) {
                formatter = function (v) {
                    var f = _.isDate(v) ? d3.time.format(formatAlias) : d3.format(formatAlias);
                    return f(v);
                };
            }

            if (!hasFormat && !formatAlias) {
                formatter = identity;
            }

            return formatter;
        },

        add: function (formatAlias, formatter) {
            FORMATS_MAP[formatAlias] = formatter;
        }
    };

    exports.FormatterRegistry = FormatterRegistry;
    exports.__esModule = true;
});
define('utils/utils-draw',["exports", "../utils/utils", "../formatter-registry", "underscore", "d3"], function (exports, _utilsUtils, _formatterRegistry, _underscore, _d3) {
    

    var utils = _utilsUtils.utils;
    var FormatterRegistry = _formatterRegistry.FormatterRegistry;
    /* jshint ignore:start */
    var _ = _underscore;
    var d3 = _d3;
    /* jshint ignore:end */

    var translate = function (left, top) {
        return "translate(" + left + "," + top + ")";
    };
    var rotate = function (angle) {
        return "rotate(" + angle + ")";
    };
    var getOrientation = function (scaleOrient) {
        return _.contains(["bottom", "top"], scaleOrient.toLowerCase()) ? "h" : "v";
    };

    var d3getComputedTextLength = _.memoize(function (d3Text) {
        return d3Text.node().getComputedTextLength();
    }, function (d3Text) {
        return d3Text.node().textContent.length;
    });

    var cutText = function (textString, widthLimit, getComputedTextLength) {
        getComputedTextLength = getComputedTextLength || d3getComputedTextLength;

        textString.each(function () {
            var textD3 = d3.select(this);
            var tokens = textD3.text().split(/\s+/);

            var stop = false;
            var parts = tokens.reduce(function (memo, t, i) {
                if (stop) {
                    return memo;
                }

                var text = i > 0 ? [memo, t].join(" ") : t;
                var len = getComputedTextLength(textD3.text(text));
                if (len < widthLimit) {
                    memo = text;
                } else {
                    var available = Math.floor(widthLimit / len * text.length);
                    memo = text.substr(0, available - 4) + "...";
                    stop = true;
                }

                return memo;
            }, "");

            textD3.text(parts);
        });
    };

    var wrapText = function (textNode, widthLimit, linesLimit, tickLabelFontHeight, isY, getComputedTextLength) {
        getComputedTextLength = getComputedTextLength || d3getComputedTextLength;

        var addLine = function (targetD3, text, lineHeight, x, y, dy, lineNumber) {
            var dyNew = lineNumber * lineHeight + dy;
            return targetD3.append("tspan").attr("x", x).attr("y", y).attr("dy", dyNew + "em").text(text);
        };

        textNode.each(function () {
            var textD3 = d3.select(this),
                tokens = textD3.text().split(/\s+/),
                lineHeight = 1.1,
                // ems
            x = textD3.attr("x"),
                y = textD3.attr("y"),
                dy = parseFloat(textD3.attr("dy"));

            textD3.text(null);
            var tempSpan = addLine(textD3, null, lineHeight, x, y, dy, 0);

            var stopReduce = false;
            var tokensCount = tokens.length - 1;
            var lines = tokens.reduce(function (memo, next, i) {
                if (stopReduce) {
                    return memo;
                }

                var isLimit = memo.length === linesLimit || i === tokensCount;
                var last = memo[memo.length - 1];
                var text = last !== "" ? last + " " + next : next;
                var tLen = getComputedTextLength(tempSpan.text(text));
                var over = tLen > widthLimit;

                if (over && isLimit) {
                    var available = Math.floor(widthLimit / tLen * text.length);
                    memo[memo.length - 1] = text.substr(0, available - 4) + "...";
                    stopReduce = true;
                }

                if (over && !isLimit) {
                    memo.push(next);
                }

                if (!over) {
                    memo[memo.length - 1] = text;
                }

                return memo;
            }, [""]).filter(function (l) {
                return l.length > 0;
            });

            y = isY ? -1 * (lines.length - 1) * Math.floor(tickLabelFontHeight * 0.5) : y;
            lines.forEach(function (text, i) {
                return addLine(textD3, text, lineHeight, x, y, dy, i);
            });

            tempSpan.remove();
        });
    };

    var decorateAxisTicks = function (nodeScale, x, size) {
        var selection = nodeScale.selectAll(".tick line");

        var sectorSize = size / selection[0].length;
        var offsetSize = sectorSize / 2;

        var isHorizontal = "h" === getOrientation(x.guide.scaleOrient);

        if (x.scaleType === "ordinal" || x.scaleType === "period") {
            var key = isHorizontal ? "x" : "y";
            var val = isHorizontal ? offsetSize : -offsetSize;

            selection.attr(key + "1", val).attr(key + "2", val);
        }
    };

    var fixAxisTickOverflow = function (nodeScale, x) {
        var isHorizontal = "h" === getOrientation(x.guide.scaleOrient);

        if (isHorizontal && x.scaleType === "time") {
            var timeTicks = nodeScale.selectAll(".tick")[0];
            if (timeTicks.length < 2) {
                return;
            }

            var tick0 = parseFloat(timeTicks[0].attributes.transform.value.replace("translate(", ""));
            var tick1 = parseFloat(timeTicks[1].attributes.transform.value.replace("translate(", ""));

            var tickStep = tick1 - tick0;

            var maxTextLn = 0;
            var iMaxTexts = -1;
            var timeTexts = nodeScale.selectAll(".tick text")[0];
            timeTexts.forEach(function (textNode, i) {
                var innerHTML = textNode.textContent || "";
                var textLength = innerHTML.length;
                if (textLength > maxTextLn) {
                    maxTextLn = textLength;
                    iMaxTexts = i;
                }
            });

            if (iMaxTexts >= 0) {
                var rect = timeTexts[iMaxTexts].getBoundingClientRect();
                // 2px from each side
                if (tickStep - rect.width < 8) {
                    nodeScale.classed({ "graphical-report__d3-time-overflown": true });
                }
            }
        }
    };

    var fixAxisBottomLine = function (nodeScale, x, size) {
        var selection = nodeScale.selectAll(".tick line");

        var isHorizontal = "h" === getOrientation(x.guide.scaleOrient);

        if (isHorizontal) {
            return;
        }

        var doApply = false;
        var tickOffset = -1;

        if (x.scaleType === "time") {
            doApply = true;
            tickOffset = 0;
        } else if (x.scaleType === "ordinal" || x.scaleType === "period") {
            doApply = true;
            var sectorSize = size / selection[0].length;
            var offsetSize = sectorSize / 2;
            tickOffset = -offsetSize;
        }

        if (doApply) {
            var tickGroupClone = nodeScale.select(".tick").node().cloneNode(true);
            nodeScale.append(function () {
                return tickGroupClone;
            }).attr("transform", translate(0, size - tickOffset));
        }
    };

    var decorateAxisLabel = function (nodeScale, x) {
        var orient = getOrientation(x.guide.scaleOrient);
        var koeff = "h" === orient ? 1 : -1;
        var labelTextNode = nodeScale.append("text").attr("transform", rotate(x.guide.label.rotate)).attr("class", x.guide.label.cssClass).attr("x", koeff * x.guide.size * 0.5).attr("y", koeff * x.guide.label.padding).style("text-anchor", x.guide.label.textAnchor);

        var delimiter = " > ";
        var tags = x.guide.label.text.split(delimiter);
        var tLen = tags.length;
        tags.forEach(function (token, i) {
            labelTextNode.append("tspan").attr("class", "label-token label-token-" + i).text(token);

            if (i < tLen - 1) {
                labelTextNode.append("tspan").attr("class", "label-token-delimiter label-token-delimiter-" + i).text(delimiter);
            }
        });

        if (x.guide.label.dock === "right") {
            var box = nodeScale.selectAll("path.domain").node().getBBox();
            labelTextNode.attr("x", orient === "h" ? box.width : 0);
        } else if (x.guide.label.dock === "left") {
            var box = nodeScale.selectAll("path.domain").node().getBBox();
            labelTextNode.attr("x", orient === "h" ? 0 : -box.height);
        }
    };

    var decorateTickLabel = function (nodeScale, x) {
        var isHorizontal = "h" === getOrientation(x.guide.scaleOrient);

        var angle = x.guide.rotate;

        var ticks = nodeScale.selectAll(".tick text");
        ticks.attr("transform", rotate(angle)).style("text-anchor", x.guide.textAnchor);

        if (angle === 90) {
            var dy = parseFloat(ticks.attr("dy")) / 2;
            ticks.attr("x", 9).attr("y", 0).attr("dy", "" + dy + "em");
        }

        if (x.guide.tickFormatWordWrap) {
            ticks.call(wrapText, x.guide.tickFormatWordWrapLimit, x.guide.tickFormatWordWrapLines, x.guide.$maxTickTextH, !isHorizontal);
        } else {
            ticks.call(cutText, x.guide.tickFormatWordWrapLimit);
        }
    };

    var fnDrawDimAxis = function (x, AXIS_POSITION, size) {
        var container = this;
        if (x.scaleDim) {
            var axisScale = d3.svg.axis().scale(x.scaleObj).orient(x.guide.scaleOrient);

            var formatter = FormatterRegistry.get(x.guide.tickFormat, x.guide.tickFormatNullAlias);
            if (formatter !== null) {
                axisScale.ticks(Math.round(size / x.guide.density));
                axisScale.tickFormat(formatter);
            }

            var nodeScale = container.append("g").attr("class", x.guide.cssClass).attr("transform", translate.apply(null, AXIS_POSITION)).call(axisScale);

            decorateAxisTicks(nodeScale, x, size);
            decorateTickLabel(nodeScale, x);
            decorateAxisLabel(nodeScale, x);

            fixAxisTickOverflow(nodeScale, x);
        }
    };

    var fnDrawGrid = function (node, H, W) {
        var container = this;

        var grid = container.append("g").attr("class", "grid").attr("transform", translate(0, 0));

        var linesOptions = (node.guide.showGridLines || "").toLowerCase();
        if (linesOptions.length > 0) {
            var gridLines = grid.append("g").attr("class", "grid-lines");

            if (linesOptions.indexOf("x") > -1 && node.x.scaleDim) {
                var x = node.x;
                var xGridAxis = d3.svg.axis().scale(x.scaleObj).orient(x.guide.scaleOrient).tickSize(H);

                var formatter = FormatterRegistry.get(x.guide.tickFormat);
                if (formatter !== null) {
                    xGridAxis.ticks(Math.round(W / x.guide.density));
                    xGridAxis.tickFormat(formatter);
                }

                var xGridLines = gridLines.append("g").attr("class", "grid-lines-x").call(xGridAxis);

                decorateAxisTicks(xGridLines, x, W);

                var firstXGridLine = xGridLines.select("g.tick");
                if (firstXGridLine.node() && firstXGridLine.attr("transform") !== "translate(0,0)") {
                    var zeroNode = firstXGridLine.node().cloneNode(true);
                    gridLines.node().appendChild(zeroNode);
                    d3.select(zeroNode).attr("class", "border").attr("transform", translate(0, 0)).select("line").attr("x1", 0).attr("x2", 0);
                }
            }

            if (linesOptions.indexOf("y") > -1 && node.y.scaleDim) {
                var y = node.y;
                var yGridAxis = d3.svg.axis().scale(y.scaleObj).orient(y.guide.scaleOrient).tickSize(-W);

                var formatter = FormatterRegistry.get(y.guide.tickFormat);
                if (formatter !== null) {
                    yGridAxis.ticks(Math.round(H / y.guide.density));
                    yGridAxis.tickFormat(formatter);
                }

                var yGridLines = gridLines.append("g").attr("class", "grid-lines-y").call(yGridAxis);

                decorateAxisTicks(yGridLines, y, H);
                fixAxisBottomLine(yGridLines, y, H);
            }

            // TODO: make own axes and grid instead of using d3's in such tricky way
            gridLines.selectAll("text").remove();
        }

        return grid;
    };

    var extendLabel = function (guide, dimension, extend) {
        guide[dimension] = _.defaults(guide[dimension] || {}, {
            label: ""
        });
        guide[dimension].label = _.isObject(guide[dimension].label) ? guide[dimension].label : { text: guide[dimension].label };
        guide[dimension].label = _.defaults(guide[dimension].label, extend || {}, {
            padding: 32,
            rotate: 0,
            textAnchor: "middle",
            cssClass: "label",
            dock: null
        });

        return guide[dimension];
    };
    var extendAxis = function (guide, dimension, extend) {
        guide[dimension] = _.defaults(guide[dimension], extend || {}, {
            padding: 0,
            density: 30,
            rotate: 0,
            tickPeriod: null,
            tickFormat: null,
            autoScale: true
        });
        guide[dimension].tickFormat = guide[dimension].tickFormat || guide[dimension].tickPeriod;
        return guide[dimension];
    };

    var applyNodeDefaults = function (node) {
        node.options = node.options || {};
        node.guide = node.guide || {};
        node.guide.padding = _.defaults(node.guide.padding || {}, { l: 0, b: 0, r: 0, t: 0 });

        node.guide.x = extendLabel(node.guide, "x");
        node.guide.x = extendAxis(node.guide, "x", {
            cssClass: "x axis",
            scaleOrient: "bottom",
            textAnchor: "middle"
        });

        node.guide.y = extendLabel(node.guide, "y", { rotate: -90 });
        node.guide.y = extendAxis(node.guide, "y", {
            cssClass: "y axis",
            scaleOrient: "left",
            textAnchor: "end"
        });

        node.guide.size = extendLabel(node.guide, "size");
        node.guide.color = extendLabel(node.guide, "color");


        return node;
    };

    /* jshint ignore:start */
    var utilsDraw = {
        translate: translate,
        rotate: rotate,
        getOrientation: getOrientation,
        fnDrawDimAxis: fnDrawDimAxis,
        fnDrawGrid: fnDrawGrid,
        applyNodeDefaults: applyNodeDefaults,
        cutText: cutText,
        wrapText: wrapText
    };
    /* jshint ignore:end */

    exports.utilsDraw = utilsDraw;
    exports.__esModule = true;
});
define('spec-engine-factory',["exports", "./utils/utils", "./utils/utils-draw", "./formatter-registry", "./utils/utils-dom"], function (exports, _utilsUtils, _utilsUtilsDraw, _formatterRegistry, _utilsUtilsDom) {
    

    var utils = _utilsUtils.utils;
    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var FormatterRegistry = _formatterRegistry.FormatterRegistry;
    var utilsDom = _utilsUtilsDom.utilsDom;


    function extendGuide(guide, targetUnit, dimension, properties) {
        var guide_dim = guide.hasOwnProperty(dimension) ? guide[dimension] : {};
        _.each(properties, function (prop) {
            _.extend(targetUnit.guide[dimension][prop], guide_dim[prop]);
        });
        _.extend(targetUnit.guide[dimension], _.omit.apply(_, [guide_dim].concat[properties]));
    }

    var applyCustomProps = function (targetUnit, customUnit) {
        var guide = customUnit.guide || {};
        var config = {
            x: ["label"],
            y: ["label"],
            size: ["label"],
            color: ["label"],
            padding: []
        };

        _.each(config, function (properties, name) {
            extendGuide(guide, targetUnit, name, properties);
        });
        _.extend(targetUnit.guide, _.omit.apply(_, [guide].concat(_.keys(config))));
        return targetUnit;
    };

    var inheritProps = function (childUnit, root) {
        childUnit.guide = childUnit.guide || {};
        childUnit.guide.padding = childUnit.guide.padding || { l: 0, t: 0, r: 0, b: 0 };

        // leaf elements should inherit coordinates properties
        if (!childUnit.hasOwnProperty("unit")) {
            childUnit = _.defaults(childUnit, root);
            childUnit.guide = _.defaults(childUnit.guide, utils.clone(root.guide));
            childUnit.guide.x = _.defaults(childUnit.guide.x, utils.clone(root.guide.x));
            childUnit.guide.y = _.defaults(childUnit.guide.y, utils.clone(root.guide.y));
        }

        return childUnit;
    };

    var createSelectorPredicates = function (root) {
        var children = root.unit || [];

        var isLeaf = !root.hasOwnProperty("unit");
        var isLeafParent = !children.some(function (c) {
            return c.hasOwnProperty("unit");
        });

        return {
            type: root.type,
            isLeaf: isLeaf,
            isLeafParent: !isLeaf && isLeafParent
        };
    };

    var getMaxTickLabelSize = function (domainValues, formatter, fnCalcTickLabelSize, axisLabelLimit) {
        if (domainValues.length === 0) {
            return { width: 0, height: 0 };
        }

        if (formatter === null) {
            var size = fnCalcTickLabelSize("TauChart Library");
            size.width = axisLabelLimit * 0.625; // golden ratio
            return size;
        }

        var maxXTickText = _.max(domainValues, function (x) {
            return formatter(x).toString().length;
        });

        // d3 sometimes produce fractional ticks on wide space
        // so we intentionally add fractional suffix
        // to foresee scale density issues
        var suffix = _.isNumber(maxXTickText) ? ".00" : "";

        return fnCalcTickLabelSize(formatter(maxXTickText) + suffix);
    };

    var getTickFormat = function (dim, meta, defaultFormats) {
        var dimType = dim.dimType;
        var scaleType = dim.scaleType;
        var specifier = "*";

        var key = [dimType, scaleType, specifier].join(":");
        var tag = [dimType, scaleType].join(":");
        return defaultFormats[key] || defaultFormats[tag] || defaultFormats[dimType] || null;
    };


    var calcUnitGuide = function (unit, meta, settings, allowXVertical, allowYVertical, inlineLabels) {
        var dimX = meta.dimension(unit.x);
        var dimY = meta.dimension(unit.y);

        var isXContinues = dimX.dimType === "measure";
        var isYContinues = dimY.dimType === "measure";

        var xDensityPadding = settings.hasOwnProperty("xDensityPadding:" + dimX.dimType) ? settings["xDensityPadding:" + dimX.dimType] : settings.xDensityPadding;

        var yDensityPadding = settings.hasOwnProperty("yDensityPadding:" + dimY.dimType) ? settings["yDensityPadding:" + dimY.dimType] : settings.yDensityPadding;

        var xMeta = meta.scaleMeta(unit.x, unit.guide.x);
        var xValues = xMeta.values;
        var yMeta = meta.scaleMeta(unit.y, unit.guide.y);
        var yValues = yMeta.values;

        unit.guide.x.tickFormat = unit.guide.x.tickFormat || getTickFormat(dimX, xMeta, settings.defaultFormats);
        unit.guide.y.tickFormat = unit.guide.y.tickFormat || getTickFormat(dimY, yMeta, settings.defaultFormats);

        if (["day", "week", "month"].indexOf(unit.guide.x.tickFormat) >= 0) {
            unit.guide.x.tickFormat += "-short";
        }

        if (["day", "week", "month"].indexOf(unit.guide.y.tickFormat) >= 0) {
            unit.guide.y.tickFormat += "-short";
        }

        var xIsEmptyAxis = xValues.length === 0;
        var yIsEmptyAxis = yValues.length === 0;

        var maxXTickSize = getMaxTickLabelSize(xValues, FormatterRegistry.get(unit.guide.x.tickFormat, unit.guide.x.tickFormatNullAlias), settings.getAxisTickLabelSize, settings.xAxisTickLabelLimit);

        var maxYTickSize = getMaxTickLabelSize(yValues, FormatterRegistry.get(unit.guide.y.tickFormat, unit.guide.y.tickFormatNullAlias), settings.getAxisTickLabelSize, settings.yAxisTickLabelLimit);


        var xAxisPadding = settings.xAxisPadding;
        var yAxisPadding = settings.yAxisPadding;

        var isXVertical = allowXVertical ? !isXContinues : false;
        var isYVertical = allowYVertical ? !isYContinues : false;

        unit.guide.x.padding = xIsEmptyAxis ? 0 : xAxisPadding;
        unit.guide.y.padding = yIsEmptyAxis ? 0 : yAxisPadding;

        unit.guide.x.rotate = isXVertical ? +90 : 0;
        unit.guide.x.textAnchor = isXVertical ? "start" : unit.guide.x.textAnchor;

        unit.guide.y.rotate = isYVertical ? -90 : 0;
        unit.guide.y.textAnchor = isYVertical ? "middle" : unit.guide.y.textAnchor;

        var xTickWidth = xIsEmptyAxis ? 0 : settings.xTickWidth;
        var yTickWidth = yIsEmptyAxis ? 0 : settings.yTickWidth;

        unit.guide.x.tickFormatWordWrapLimit = settings.xAxisTickLabelLimit;
        unit.guide.y.tickFormatWordWrapLimit = settings.yAxisTickLabelLimit;


        var xTickBox = isXVertical ? { w: maxXTickSize.height, h: maxXTickSize.width } : { h: maxXTickSize.height, w: maxXTickSize.width };

        if (maxXTickSize.width > settings.xAxisTickLabelLimit) {
            unit.guide.x.tickFormatWordWrap = true;
            unit.guide.x.tickFormatWordWrapLines = settings.xTickWordWrapLinesLimit;

            var guessLinesCount = Math.ceil(maxXTickSize.width / settings.xAxisTickLabelLimit);
            var koeffLinesCount = Math.min(guessLinesCount, settings.xTickWordWrapLinesLimit);
            var textLinesHeight = koeffLinesCount * maxXTickSize.height;

            if (isXVertical) {
                xTickBox.h = settings.xAxisTickLabelLimit;
                xTickBox.w = textLinesHeight;
            } else {
                xTickBox.h = textLinesHeight;
                xTickBox.w = settings.xAxisTickLabelLimit;
            }
        }


        var yTickBox = isYVertical ? { w: maxYTickSize.height, h: maxYTickSize.width } : { h: maxYTickSize.height, w: maxYTickSize.width };

        if (maxYTickSize.width > settings.yAxisTickLabelLimit) {
            unit.guide.y.tickFormatWordWrap = true;
            unit.guide.y.tickFormatWordWrapLines = settings.yTickWordWrapLinesLimit;

            var guessLinesCount = Math.ceil(maxYTickSize.width / settings.yAxisTickLabelLimit);
            var koeffLinesCount = Math.min(guessLinesCount, settings.yTickWordWrapLinesLimit);
            var textLinesHeight = koeffLinesCount * maxYTickSize.height;

            if (isYVertical) {
                yTickBox.w = textLinesHeight;
                yTickBox.h = settings.yAxisTickLabelLimit;
            } else {
                yTickBox.w = settings.yAxisTickLabelLimit;
                yTickBox.h = textLinesHeight;
            }
        }

        var xFontH = xTickWidth + xTickBox.h;
        var yFontW = yTickWidth + yTickBox.w;

        var xFontLabelHeight = settings.xFontLabelHeight;
        var yFontLabelHeight = settings.yFontLabelHeight;

        var distToXAxisLabel = settings.distToXAxisLabel;
        var distToYAxisLabel = settings.distToYAxisLabel;

        unit.guide.x.density = xTickBox.w + xDensityPadding * 2;
        unit.guide.y.density = yTickBox.h + yDensityPadding * 2;

        if (!inlineLabels) {
            unit.guide.x.label.padding = +xFontLabelHeight + (unit.guide.x.label.text ? xFontH + distToXAxisLabel : 0);
            unit.guide.y.label.padding = -xFontLabelHeight + (unit.guide.y.label.text ? yFontW + distToYAxisLabel : 0);

            var xLabelPadding = unit.guide.x.label.text ? unit.guide.x.label.padding + xFontLabelHeight : xFontH;
            var yLabelPadding = unit.guide.y.label.text ? unit.guide.y.label.padding + yFontLabelHeight : yFontW;

            unit.guide.padding.b = xAxisPadding + xLabelPadding - xTickWidth;
            unit.guide.padding.l = yAxisPadding + yLabelPadding;

            unit.guide.padding.b = unit.guide.x.hide ? 0 : unit.guide.padding.b;
            unit.guide.padding.l = unit.guide.y.hide ? 0 : unit.guide.padding.l;
        } else {
            var pd = (xAxisPadding - xFontLabelHeight) / 2;
            unit.guide.x.label.padding = 0 + xFontLabelHeight - distToXAxisLabel + pd;
            unit.guide.y.label.padding = 0 - distToYAxisLabel + pd;

            unit.guide.x.label.cssClass += " inline";
            unit.guide.x.label.dock = "right";
            unit.guide.x.label.textAnchor = "end";

            unit.guide.y.label.cssClass += " inline";
            unit.guide.y.label.dock = "right";
            unit.guide.y.label.textAnchor = "end";

            //unit.guide.x.label.dock = 'left';
            //unit.guide.x.label.textAnchor = 'start';
            //unit.guide.y.label.dock = 'left';
            //unit.guide.y.label.textAnchor = 'start';

            unit.guide.padding.b = xAxisPadding + xFontH;
            unit.guide.padding.l = yAxisPadding + yFontW;

            unit.guide.padding.b = unit.guide.x.hide ? 0 : unit.guide.padding.b;
            unit.guide.padding.l = unit.guide.y.hide ? 0 : unit.guide.padding.l;
        }

        unit.guide.x.tickFontHeight = maxXTickSize.height;
        unit.guide.y.tickFontHeight = maxYTickSize.height;

        unit.guide.x.$minimalDomain = xValues.length;
        unit.guide.y.$minimalDomain = yValues.length;

        unit.guide.x.$maxTickTextW = maxXTickSize.width;
        unit.guide.x.$maxTickTextH = maxXTickSize.height;

        unit.guide.y.$maxTickTextW = maxYTickSize.width;
        unit.guide.y.$maxTickTextH = maxYTickSize.height;

        return unit;
    };


    var SpecEngineTypeMap = {

        NONE: function (srcSpec, meta, settings) {
            var spec = utils.clone(srcSpec);
            fnTraverseSpec(utils.clone(spec.unit), spec.unit, function (selectorPredicates, unit) {
                unit.guide.x.tickFontHeight = settings.getAxisTickLabelSize("X").height;
                unit.guide.y.tickFontHeight = settings.getAxisTickLabelSize("Y").height;

                unit.guide.x.tickFormatWordWrapLimit = settings.xAxisTickLabelLimit;
                unit.guide.y.tickFormatWordWrapLimit = settings.yAxisTickLabelLimit;

                return unit;
            });
            return spec;
        },

        "BUILD-LABELS": function (srcSpec, meta, settings) {
            var spec = utils.clone(srcSpec);

            var xLabels = [];
            var yLabels = [];
            var xUnit = null;
            var yUnit = null;

            utils.traverseJSON(spec.unit, "unit", createSelectorPredicates, function (selectors, unit) {
                if (selectors.isLeaf) {
                    return unit;
                }

                if (!xUnit && unit.x) xUnit = unit;
                if (!yUnit && unit.y) yUnit = unit;

                unit.guide = unit.guide || {};

                unit.guide.x = unit.guide.x || { label: "" };
                unit.guide.y = unit.guide.y || { label: "" };

                unit.guide.x.label = _.isObject(unit.guide.x.label) ? unit.guide.x.label : { text: unit.guide.x.label };
                unit.guide.y.label = _.isObject(unit.guide.y.label) ? unit.guide.y.label : { text: unit.guide.y.label };

                if (unit.x) {
                    unit.guide.x.label.text = unit.guide.x.label.text || unit.x;
                }

                if (unit.y) {
                    unit.guide.y.label.text = unit.guide.y.label.text || unit.y;
                }

                var x = unit.guide.x.label.text;
                if (x) {
                    xLabels.push(x);
                    unit.guide.x.tickFormatNullAlias = unit.guide.x.hasOwnProperty("tickFormatNullAlias") ? unit.guide.x.tickFormatNullAlias : "No " + x;
                    unit.guide.x.label.text = "";
                }

                var y = unit.guide.y.label.text;
                if (y) {
                    yLabels.push(y);
                    unit.guide.y.tickFormatNullAlias = unit.guide.y.hasOwnProperty("tickFormatNullAlias") ? unit.guide.y.tickFormatNullAlias : "No " + y;
                    unit.guide.y.label.text = "";
                }

                return unit;
            });

            if (xUnit) {
                xUnit.guide.x.label.text = xLabels.join(" > ");
            }

            if (yUnit) {
                yUnit.guide.y.label.text = yLabels.join(" > ");
            }

            return spec;
        },

        "BUILD-GUIDE": function (srcSpec, meta, settings) {
            var spec = utils.clone(srcSpec);
            fnTraverseSpec(utils.clone(spec.unit), spec.unit, function (selectorPredicates, unit) {
                if (selectorPredicates.isLeaf) {
                    return unit;
                }

                if (selectorPredicates.isLeafParent && !unit.guide.hasOwnProperty("showGridLines")) {
                    unit.guide.showGridLines = "xy";
                }

                var isFacetUnit = !selectorPredicates.isLeaf && !selectorPredicates.isLeafParent;
                if (isFacetUnit) {
                    // unit is a facet!
                    unit.guide.x.cssClass += " facet-axis";
                    unit.guide.y.cssClass += " facet-axis";
                }

                var dimX = meta.dimension(unit.x);
                var dimY = meta.dimension(unit.y);

                var isXContinues = dimX.dimType === "measure";
                var isYContinues = dimY.dimType === "measure";

                var xDensityPadding = settings.hasOwnProperty("xDensityPadding:" + dimX.dimType) ? settings["xDensityPadding:" + dimX.dimType] : settings.xDensityPadding;

                var yDensityPadding = settings.hasOwnProperty("yDensityPadding:" + dimY.dimType) ? settings["yDensityPadding:" + dimY.dimType] : settings.yDensityPadding;

                var xMeta = meta.scaleMeta(unit.x, unit.guide.x);
                var xValues = xMeta.values;
                var yMeta = meta.scaleMeta(unit.y, unit.guide.y);
                var yValues = yMeta.values;


                unit.guide.x.tickFormat = unit.guide.x.tickFormat || getTickFormat(dimX, xMeta, settings.defaultFormats);
                unit.guide.y.tickFormat = unit.guide.y.tickFormat || getTickFormat(dimY, yMeta, settings.defaultFormats);

                var xIsEmptyAxis = xValues.length === 0;
                var yIsEmptyAxis = yValues.length === 0;

                var maxXTickSize = getMaxTickLabelSize(xValues, FormatterRegistry.get(unit.guide.x.tickFormat, unit.guide.x.tickFormatNullAlias), settings.getAxisTickLabelSize, settings.xAxisTickLabelLimit);

                var maxYTickSize = getMaxTickLabelSize(yValues, FormatterRegistry.get(unit.guide.y.tickFormat, unit.guide.y.tickFormatNullAlias), settings.getAxisTickLabelSize, settings.yAxisTickLabelLimit);


                var xAxisPadding = selectorPredicates.isLeafParent ? settings.xAxisPadding : 0;
                var yAxisPadding = selectorPredicates.isLeafParent ? settings.yAxisPadding : 0;

                var isXVertical = !isFacetUnit && (!!dimX.dimType && dimX.dimType !== "measure");

                unit.guide.x.padding = xIsEmptyAxis ? 0 : xAxisPadding;
                unit.guide.y.padding = yIsEmptyAxis ? 0 : yAxisPadding;

                unit.guide.x.rotate = isXVertical ? 90 : 0;
                unit.guide.x.textAnchor = isXVertical ? "start" : unit.guide.x.textAnchor;

                var xTickWidth = xIsEmptyAxis ? 0 : settings.xTickWidth;
                var yTickWidth = yIsEmptyAxis ? 0 : settings.yTickWidth;

                unit.guide.x.tickFormatWordWrapLimit = settings.xAxisTickLabelLimit;
                unit.guide.y.tickFormatWordWrapLimit = settings.yAxisTickLabelLimit;

                var maxXTickH = isXVertical ? maxXTickSize.width : maxXTickSize.height;

                if (!isXContinues && maxXTickH > settings.xAxisTickLabelLimit) {
                    maxXTickH = settings.xAxisTickLabelLimit;
                }

                if (!isXVertical && maxXTickSize.width > settings.xAxisTickLabelLimit) {
                    unit.guide.x.tickFormatWordWrap = true;
                    unit.guide.x.tickFormatWordWrapLines = settings.xTickWordWrapLinesLimit;
                    maxXTickH = settings.xTickWordWrapLinesLimit * maxXTickSize.height;
                }

                var maxYTickW = maxYTickSize.width;
                if (!isYContinues && maxYTickW > settings.yAxisTickLabelLimit) {
                    maxYTickW = settings.yAxisTickLabelLimit;
                    unit.guide.y.tickFormatWordWrap = true;
                    unit.guide.y.tickFormatWordWrapLines = settings.yTickWordWrapLinesLimit;
                }

                var xFontH = xTickWidth + maxXTickH;
                var yFontW = yTickWidth + maxYTickW;

                var xFontLabelHeight = settings.xFontLabelHeight;
                var yFontLabelHeight = settings.yFontLabelHeight;

                var distToXAxisLabel = settings.distToXAxisLabel;
                var distToYAxisLabel = settings.distToYAxisLabel;


                var xTickLabelW = Math.min(settings.xAxisTickLabelLimit, isXVertical ? maxXTickSize.height : maxXTickSize.width);
                unit.guide.x.density = xTickLabelW + xDensityPadding * 2;

                var guessLinesCount = Math.ceil(maxYTickSize.width / settings.yAxisTickLabelLimit);
                var koeffLinesCount = Math.min(guessLinesCount, settings.yTickWordWrapLinesLimit);
                var yTickLabelH = Math.min(settings.yAxisTickLabelLimit, koeffLinesCount * maxYTickSize.height);
                unit.guide.y.density = yTickLabelH + yDensityPadding * 2;


                unit.guide.x.label.padding = unit.guide.x.label.text ? xFontH + distToXAxisLabel : 0;
                unit.guide.y.label.padding = unit.guide.y.label.text ? yFontW + distToYAxisLabel : 0;


                var xLabelPadding = unit.guide.x.label.text ? unit.guide.x.label.padding + xFontLabelHeight : xFontH;
                var yLabelPadding = unit.guide.y.label.text ? unit.guide.y.label.padding + yFontLabelHeight : yFontW;


                unit.guide.padding.b = xAxisPadding + xLabelPadding;
                unit.guide.padding.l = yAxisPadding + yLabelPadding;

                unit.guide.padding.b = unit.guide.x.hide ? 0 : unit.guide.padding.b;
                unit.guide.padding.l = unit.guide.y.hide ? 0 : unit.guide.padding.l;

                unit.guide.x.tickFontHeight = maxXTickSize.height;
                unit.guide.y.tickFontHeight = maxYTickSize.height;

                unit.guide.x.$minimalDomain = xValues.length;
                unit.guide.y.$minimalDomain = yValues.length;

                unit.guide.x.$maxTickTextW = maxXTickSize.width;
                unit.guide.x.$maxTickTextH = maxXTickSize.height;

                unit.guide.y.$maxTickTextW = maxYTickSize.width;
                unit.guide.y.$maxTickTextH = maxYTickSize.height;

                return unit;
            });
            return spec;
        },

        "BUILD-COMPACT": function (srcSpec, meta, settings) {
            var spec = utils.clone(srcSpec);
            fnTraverseSpec(utils.clone(spec.unit), spec.unit, function (selectorPredicates, unit) {
                if (selectorPredicates.isLeaf) {
                    return unit;
                }

                if (selectorPredicates.isLeafParent) {
                    unit.guide.showGridLines = unit.guide.hasOwnProperty("showGridLines") ? unit.guide.showGridLines : "xy";

                    return calcUnitGuide(unit, meta, _.defaults({
                        xTickWordWrapLinesLimit: 1,
                        yTickWordWrapLinesLimit: 1
                    }, settings), true, false, true);
                }

                // facet level
                unit.guide.x.cssClass += " facet-axis compact";
                unit.guide.y.cssClass += " facet-axis compact";

                return calcUnitGuide(unit, meta, _.defaults({
                    xAxisPadding: 0,
                    yAxisPadding: 0,
                    distToXAxisLabel: 0,
                    distToYAxisLabel: 0,
                    xTickWordWrapLinesLimit: 1,
                    yTickWordWrapLinesLimit: 1
                }, settings), false, true, false);
            });

            return spec;
        },

        "OPTIMAL-SIZE": function (srcSpec, meta, settings) {
            var spec = utils.clone(srcSpec);

            var traverseFromDeep = function (root) {
                var r;

                if (!root.unit) {
                    r = { w: 0, h: 0 };
                } else {
                    var s = traverseFromDeep(root.unit[0]);
                    var g = root.guide;
                    var xmd = g.x.$minimalDomain || 1;
                    var ymd = g.y.$minimalDomain || 1;
                    var maxW = Math.max(xmd * g.x.density, xmd * s.w);
                    var maxH = Math.max(ymd * g.y.density, ymd * s.h);

                    r = {
                        w: maxW + g.padding.l + g.padding.r,
                        h: maxH + g.padding.t + g.padding.b
                    };
                }

                return r;
            };

            var traverseToDeep = function (meta, root, size, localSettings) {
                var mdx = root.guide.x.$minimalDomain || 1;
                var mdy = root.guide.y.$minimalDomain || 1;

                var perTickX = size.width / mdx;
                var perTickY = size.height / mdy;

                var dimX = meta.dimension(root.x);
                var dimY = meta.dimension(root.y);
                var xDensityPadding = localSettings.hasOwnProperty("xDensityPadding:" + dimX.dimType) ? localSettings["xDensityPadding:" + dimX.dimType] : localSettings.xDensityPadding;

                var yDensityPadding = localSettings.hasOwnProperty("yDensityPadding:" + dimY.dimType) ? localSettings["yDensityPadding:" + dimY.dimType] : localSettings.yDensityPadding;

                if (root.guide.x.hide !== true && root.guide.x.rotate !== 0 && perTickX > root.guide.x.$maxTickTextW + xDensityPadding * 2) {
                    root.guide.x.rotate = 0;
                    root.guide.x.textAnchor = "middle";
                    root.guide.x.tickFormatWordWrapLimit = perTickX;
                    var s = Math.min(localSettings.xAxisTickLabelLimit, root.guide.x.$maxTickTextW);

                    var xDelta = 0 - s + root.guide.x.$maxTickTextH;

                    root.guide.padding.b += root.guide.padding.b > 0 ? xDelta : 0;

                    if (root.guide.x.label.padding > s + localSettings.xAxisPadding) {
                        root.guide.x.label.padding += xDelta;
                    }
                }

                if (root.guide.y.hide !== true && root.guide.y.rotate !== 0 && root.guide.y.tickFormatWordWrapLines === 1 && perTickY > root.guide.y.$maxTickTextW + yDensityPadding * 2) {
                    root.guide.y.tickFormatWordWrapLimit = perTickY - yDensityPadding * 2;
                }

                var newSize = {
                    width: perTickX,
                    height: perTickY
                };

                if (root.unit) {
                    traverseToDeep(meta, root.unit[0], newSize, localSettings);
                }
            };

            var optimalSize = traverseFromDeep(spec.unit);
            var recommendedWidth = optimalSize.w;
            var recommendedHeight = optimalSize.h;

            var size = settings.size;
            var scrollSize = settings.getScrollBarWidth();

            var deltaW = size.width - recommendedWidth;
            var deltaH = size.height - recommendedHeight;

            var screenW = deltaW >= 0 ? size.width : recommendedWidth;
            var scrollW = deltaH >= 0 ? 0 : scrollSize;

            var screenH = deltaH >= 0 ? size.height : recommendedHeight;
            var scrollH = deltaW >= 0 ? 0 : scrollSize;

            settings.size.height = screenH - scrollH;
            settings.size.width = screenW - scrollW;

            // optimize full spec depending on size
            traverseToDeep(meta, spec.unit, settings.size, settings);

            return spec;
        }
    };

    SpecEngineTypeMap.AUTO = function (srcSpec, meta, settings) {
        return ["BUILD-LABELS", "BUILD-GUIDE"].reduce(function (spec, engineName) {
            return SpecEngineTypeMap[engineName](spec, meta, settings);
        }, srcSpec);
    };

    SpecEngineTypeMap.COMPACT = function (srcSpec, meta, settings) {
        return ["BUILD-LABELS", "BUILD-COMPACT"].reduce(function (spec, engineName) {
            return SpecEngineTypeMap[engineName](spec, meta, settings);
        }, srcSpec);
    };


    var fnTraverseSpec = function (orig, specUnitRef, transformRules) {
        var xRef = utilsDraw.applyNodeDefaults(specUnitRef);
        xRef = transformRules(createSelectorPredicates(xRef), xRef);
        xRef = applyCustomProps(xRef, orig);
        var prop = _.omit(xRef, "unit");
        (xRef.unit || []).forEach(function (unit) {
            return fnTraverseSpec(utils.clone(unit), inheritProps(unit, prop), transformRules);
        });
        return xRef;
    };

    var SpecEngineFactory = {
        get: function (typeName, settings) {
            var engine = SpecEngineTypeMap[typeName] || SpecEngineTypeMap.NONE;
            return function (srcSpec, meta) {
                var fullSpec = engine(srcSpec, meta, settings);
                if (settings.fitSize) {
                    fullSpec = SpecEngineTypeMap["OPTIMAL-SIZE"](fullSpec, meta, settings);
                }
                return fullSpec;
            };
        }
    };

    exports.SpecEngineFactory = SpecEngineFactory;
    exports.__esModule = true;
});
define('matrix',["exports"], function (exports) {
    

    var TMatrix = (function () {
        var Matrix = function (r, c) {
            var args = _.toArray(arguments);
            var cube;

            if (_.isArray(args[0])) {
                cube = args[0];
            } else {
                cube = _.times(r, function () {
                    return _.times(c, function () {
                        return null;
                    });
                });
            }

            this.cube = cube;
        };

        Matrix.prototype = {

            iterate: function (iterator) {
                var cube = this.cube;
                _.each(cube, function (row, ir) {
                    _.each(row, function (colValue, ic) {
                        iterator(ir, ic, colValue);
                    });
                });
                return this;
            },

            getRC: function (r, c) {
                return this.cube[r][c];
            },

            setRC: function (r, c, val) {
                this.cube[r][c] = val;
                return this;
            },

            sizeR: function () {
                return this.cube.length;
            },

            sizeC: function () {
                var row = this.cube[0] || [];
                return row.length;
            }
        };

        return Matrix;
    })();

    exports.TMatrix = TMatrix;
    exports.__esModule = true;
});
define('layout-engine-factory',["exports", "./utils/utils", "./utils/utils-draw", "./matrix"], function (exports, _utilsUtils, _utilsUtilsDraw, _matrix) {
    

    var utils = _utilsUtils.utils;
    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var TMatrix = _matrix.TMatrix;



    var specUnitSummary = function (spec, boxOpt) {
        var box = boxOpt ? boxOpt : { depth: -1, paddings: [] };
        var p = spec.guide.padding;
        box.depth += 1;
        box.paddings.unshift({ l: p.l, b: p.b, r: p.r, t: p.t });

        if (spec.unit && spec.unit.length) {
            specUnitSummary(spec.unit[0], box);
        }

        return box;
    };

    var LayoutEngineTypeMap = {

        NONE: function (rootNode) {
            return rootNode;
        },

        EXTRACT: function (rootNode) {
            var traverse = function (rootNodeMatrix, depth, rule) {
                var matrix = rootNodeMatrix;

                var rows = matrix.sizeR();
                var cols = matrix.sizeC();

                matrix.iterate(function (r, c, subNodes) {
                    subNodes.forEach(function (unit) {
                        return rule(unit, {
                            firstRow: r === 0,
                            firstCol: c === 0,
                            lastRow: r === rows - 1,
                            lastCol: c === cols - 1,
                            depth: depth
                        });
                    });

                    subNodes.filter(function (unit) {
                        return unit.$matrix;
                    }).forEach(function (unit) {
                        unit.$matrix = new TMatrix(unit.$matrix.cube);
                        traverse(unit.$matrix, depth - 1, rule);
                    });
                });
            };

            var coordNode = utils.clone(rootNode);

            var coordMatrix = new TMatrix([[[coordNode]]]);

            var box = specUnitSummary(coordNode);

            var globPadd = box.paddings.reduce(function (memo, item) {
                memo.l += item.l;
                memo.b += item.b;
                memo.r += item.r;
                memo.t += item.t;
                return memo;
            }, { l: 0, b: 0, r: 0, t: 0 });

            var temp = utils.clone(globPadd);
            var axesPadd = box.paddings.reverse().map(function (item) {
                item.l = temp.l - item.l;
                item.b = temp.b - item.b;
                temp = { l: item.l, b: item.b };
                return item;
            });
            box.paddings = axesPadd.reverse();

            var distanceBetweenFacets = 10;

            var wrapperNode = utilsDraw.applyNodeDefaults({
                type: "COORDS.RECT",
                options: utils.clone(rootNode.options),
                $matrix: new TMatrix([[[coordNode]]]),
                guide: {
                    padding: {
                        l: globPadd.l - distanceBetweenFacets,
                        b: globPadd.b - distanceBetweenFacets,
                        r: globPadd.r + distanceBetweenFacets,
                        t: globPadd.t + distanceBetweenFacets
                    }
                }
            });

            traverse(coordMatrix, box.depth, function (unit, selectorPredicates) {
                var depth = selectorPredicates.depth;

                unit.guide.x.hide = unit.guide.x.hide ? unit.guide.x.hide : !selectorPredicates.lastRow;
                unit.guide.y.hide = unit.guide.y.hide ? unit.guide.y.hide : !selectorPredicates.firstCol;

                var positiveFeedbackLoop = depth > 1 ? 0 : distanceBetweenFacets;
                var negativeFeedbackLoop = depth > 1 ? distanceBetweenFacets : 0;

                unit.guide.x.padding += box.paddings[depth].b;
                unit.guide.y.padding += box.paddings[depth].l;

                unit.guide.x.padding -= negativeFeedbackLoop;
                unit.guide.y.padding -= negativeFeedbackLoop;

                unit.guide.padding.l = positiveFeedbackLoop;
                unit.guide.padding.b = positiveFeedbackLoop;
                unit.guide.padding.r = positiveFeedbackLoop;
                unit.guide.padding.t = positiveFeedbackLoop;

                return unit;
            });

            return wrapperNode;
        }
    };

    var LayoutEngineFactory = {

        get: function (typeName) {
            return LayoutEngineTypeMap[typeName] || LayoutEngineTypeMap.NONE;
        }

    };

    exports.LayoutEngineFactory = LayoutEngineFactory;
    exports.__esModule = true;
});
define('plugins',["exports"], function (exports) {
    

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    //plugins
    /** @class
     * @extends Plugin */
    var Plugins = (function () {
        /** @constructs */
        function Plugins(plugins, chart) {
            this.chart = chart;
            this._plugins = plugins.map(this.initPlugin, this);
        }

        _prototypeProperties(Plugins, null, {
            initPlugin: {
                value: function initPlugin(plugin) {
                    var _this = this;
                    if (plugin.init) {
                        plugin.init(this.chart);
                    }
                    this.chart.on("destroy", plugin.destroy && plugin.destroy.bind(plugin) || function () {});
                    Object.keys(plugin).forEach(function (name) {
                        if (name.indexOf("on") === 0) {
                            var event = name.substr(2);
                            _this.chart.on(event.toLowerCase(), plugin[name].bind(plugin));
                        }
                    });
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return Plugins;
    })();

    var elementEvents = ["click", "mouseover", "mouseout", "mousemove"];
    var propagateDatumEvents = function (chart) {
        return function () {
            elementEvents.forEach(function (name) {
                this.on(name, function (d) {
                    chart.fire("element" + name, {
                        elementData: d,
                        element: this,
                        cellData: d3.select(this.parentNode.parentNode).datum()
                    });
                });
            }, this);
        };
    };


    exports.propagateDatumEvents = propagateDatumEvents;
    exports.Plugins = Plugins;
    exports.__esModule = true;
});
define('unit-domain-period-generator',["exports"], function (exports) {
    

    var PERIODS_MAP = {

        day: {
            cast: function (date) {
                return new Date(date.setHours(0, 0, 0, 0));
            },
            next: function (prevDate) {
                return new Date(prevDate.setDate(prevDate.getDate() + 1));
            }
        },

        week: {
            cast: function (date) {
                date = new Date(date.setHours(0, 0, 0, 0));
                date = new Date(date.setDate(date.getDate() - date.getDay()));
                return date;
            },
            next: function (prevDate) {
                return new Date(prevDate.setDate(prevDate.getDate() + 7));
            }
        },

        month: {
            cast: function (date) {
                date = new Date(date.setHours(0, 0, 0, 0));
                date = new Date(date.setDate(1));
                return date;
            },
            next: function (prevDate) {
                return new Date(prevDate.setMonth(prevDate.getMonth() + 1));
            }
        },

        quarter: {
            cast: function (date) {
                date = new Date(date.setHours(0, 0, 0, 0));
                date = new Date(date.setDate(1));
                var currentMonth = date.getMonth();
                var firstQuarterMonth = currentMonth - currentMonth % 3;
                return new Date(date.setMonth(firstQuarterMonth));
            },
            next: function (prevDate) {
                return new Date(prevDate.setMonth(prevDate.getMonth() + 3));
            }
        },

        year: {
            cast: function (date) {
                date = new Date(date.setHours(0, 0, 0, 0));
                date = new Date(date.setDate(1));
                date = new Date(date.setMonth(0));
                return date;
            },
            next: function (prevDate) {
                return new Date(prevDate.setFullYear(prevDate.getFullYear() + 1));
            }
        }
    };

    var UnitDomainPeriodGenerator = {

        add: function (periodAlias, obj) {
            PERIODS_MAP[periodAlias.toLowerCase()] = obj;
            return this;
        },

        get: function (periodAlias) {
            return PERIODS_MAP[periodAlias.toLowerCase()];
        },

        generate: function (lTick, rTick, periodAlias) {
            var r = [];
            var period = PERIODS_MAP[periodAlias.toLowerCase()];
            if (period) {
                var last = period.cast(new Date(rTick));
                var curr = period.cast(new Date(lTick));
                r.push(curr);
                while ((curr = period.next(new Date(curr))) <= last) {
                    r.push(curr);
                }
            }
            return r;
        }
    };

    exports.UnitDomainPeriodGenerator = UnitDomainPeriodGenerator;
    exports.__esModule = true;
});
define('size',["exports"], function (exports) {
    

    var f = function (x) {
        return Math.sqrt(x);
    };

    var sizeScale = function (srcValues, minSize, maxSize, normalSize) {
        var values = _.filter(srcValues, _.isFinite);

        if (values.length === 0) {
            return function (x) {
                return normalSize;
            };
        }

        var k = 1;
        var xMin = 0;

        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);

        var len = f(Math.max.apply(null, [Math.abs(min), Math.abs(max), max - min]));

        xMin = min < 0 ? min : 0;
        k = len === 0 ? 1 : (maxSize - minSize) / len;

        return function (x) {
            var numX = x !== null ? parseFloat(x) : 0;

            if (!_.isFinite(numX)) {
                return maxSize;
            }

            var posX = numX - xMin; // translate to positive x domain

            return minSize + f(posX) * k;
        };
    };

    exports.sizeScale = sizeScale;
    exports.__esModule = true;
});
define('unit-domain-mixin',["exports", "./unit-domain-period-generator", "./utils/utils", "./size", "underscore", "d3"], function (exports, _unitDomainPeriodGenerator, _utilsUtils, _size, _underscore, _d3) {
    

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    var UnitDomainPeriodGenerator = _unitDomainPeriodGenerator.UnitDomainPeriodGenerator;
    var utils = _utilsUtils.utils;
    var sizeScale = _size.sizeScale;
    /* jshint ignore:start */
    var _ = _underscore;
    var d3 = _d3;
    /* jshint ignore:end */

    var autoScaleMethods = {
        ordinal: function (inputValues, props) {
            return inputValues;
        },

        linear: function (inputValues, props) {
            var domainParam = props.autoScale ? utils.autoScale(inputValues) : d3.extent(inputValues);

            var min = _.isNumber(props.min) ? props.min : domainParam[0];
            var max = _.isNumber(props.max) ? props.max : domainParam[1];

            return [Math.min(min, domainParam[0]), Math.max(max, domainParam[1])];
        },

        period: function (inputValues, props) {
            var domainParam = d3.extent(inputValues);
            var min = _.isNull(props.min) || _.isUndefined(props.min) ? domainParam[0] : new Date(props.min).getTime();
            var max = _.isNull(props.max) || _.isUndefined(props.max) ? domainParam[1] : new Date(props.max).getTime();

            var range = [new Date(Math.min(min, domainParam[0])), new Date(Math.max(max, domainParam[1]))];

            return UnitDomainPeriodGenerator.generate(range[0], range[1], props.period);
        },

        time: function (inputValues, props) {
            var domainParam = d3.extent(inputValues);
            var min = _.isNull(props.min) || _.isUndefined(props.min) ? domainParam[0] : new Date(props.min).getTime();
            var max = _.isNull(props.max) || _.isUndefined(props.max) ? domainParam[1] : new Date(props.max).getTime();

            return [new Date(Math.min(min, domainParam[0])), new Date(Math.max(max, domainParam[1]))];
        }
    };

    var rangeMethods = {

        ordinal: function (inputValues, interval) {
            return d3.scale.ordinal().domain(inputValues).rangePoints(interval, 1);
        },

        linear: function (inputValues, interval) {
            return d3.scale.linear().domain(inputValues).rangeRound(interval, 1);
        },

        period: function (inputValues, interval) {
            return d3.scale.ordinal().domain(inputValues).rangePoints(interval, 1);
        },

        time: function (inputValues, interval) {
            return d3.time.scale().domain(inputValues).range(interval);
        }
    };

    var UnitDomainMixin = exports.UnitDomainMixin = (function () {
        function UnitDomainMixin(meta, data) {
            var getPropMapper = function (prop) {
                return function (propObj) {
                    var xObject = propObj || {};
                    return xObject.hasOwnProperty(prop) ? xObject[prop] : null;
                };
            };

            var getValueMapper = function (dim) {
                var d = meta[dim] || {};
                var f = d.value ? getPropMapper(d.value) : function (x) {
                    return x;
                };

                var isTime = _.contains(["period", "time"], d.scale);

                return isTime ? _.compose(function (v) {
                    return new Date(v).getTime();
                }, f) : f;
            };

            var getOrder = function (dim) {
                var d = meta[dim] || {};
                return d.order || null;
            };

            var getDomainSortStrategy = function (type) {
                var map = {

                    category: function (dim, fnMapperId, domain) {
                        return domain;
                    },

                    order: function (dim, fnMapperId, domain) {
                        var metaOrder = getOrder(dim);
                        return metaOrder ? _.union(metaOrder, domain) : // arguments order is important
                        _.sortBy(domain, fnMapperId);
                    },

                    measure: function (dim, fnMapperId, domain) {
                        return _.sortBy(domain, fnMapperId);
                    },

                    "as-is": function (dim, fnMapperId, domain) {
                        return domain;
                    }
                };

                return map[type] || map["as-is"];
            };

            var getScaleSortStrategy = function (type) {
                var map = {

                    category: getDomainSortStrategy("category"),

                    order: getDomainSortStrategy("order"),

                    measure: getDomainSortStrategy("measure"),

                    "as-is": getDomainSortStrategy("as-is")
                };

                return map[type] || map["as-is"];
            };

            this.fnDimension = function (dimensionName, subUnit) {
                var unit = (subUnit || {}).dimensions || {};
                var xRoot = meta[dimensionName] || {};
                var xNode = unit[dimensionName] || {};
                return {
                    scaleDim: dimensionName,
                    scaleType: xNode.scale || xRoot.scale,
                    dimType: xNode.type || xRoot.type
                };
            };

            this.fnSource = function (whereFilter) {
                var predicates = _.map(whereFilter, function (v, k) {
                    return function (row) {
                        return getValueMapper(k)(row[k]) === v;
                    };
                });
                return _(data).filter(function (row) {
                    return _.every(predicates, function (p) {
                        return p(row);
                    });
                });
            };

            var _domain = function (dim, fnSort) {
                if (!meta[dim]) {
                    return [];
                }

                var fnMapperId = getValueMapper(dim);
                var uniqValues = _(data).chain().pluck(dim).uniq(fnMapperId).value();

                return fnSort(dim, fnMapperId, uniqValues);
            };

            this.fnDomain = function (dim) {
                var fnMapperId = getValueMapper(dim);
                var type = (meta[dim] || {}).type;
                var domainSortedAsc = _domain(dim, getDomainSortStrategy(type));
                return domainSortedAsc.map(fnMapperId);
            };

            var _scaleMeta = function (scaleDim, xOptions) {
                var opts = {};
                var options = xOptions || {};

                opts.map = options.hasOwnProperty("map") ? options.map : options.tickLabel;
                opts.min = options.hasOwnProperty("min") ? options.min : options.tickMin;
                opts.max = options.hasOwnProperty("max") ? options.max : options.tickMax;
                opts.period = options.hasOwnProperty("period") ? options.period : options.tickPeriod;
                opts.autoScale = options.autoScale;

                var dimx = _.defaults({}, meta[scaleDim]);

                var fValHub = {
                    "order:period": function (xOptions) {
                        return function (x) {
                            return UnitDomainPeriodGenerator.get(xOptions.period).cast(new Date(x));
                        };
                    },

                    "*": function (opts) {
                        return function (x) {
                            return x;
                        };
                    }
                };

                var fMap = opts.map ? getPropMapper(opts.map) : getValueMapper(scaleDim);
                var fKey = [dimx.type, dimx.scale].join(":");
                var fVal = (fValHub[fKey] || fValHub["*"])(opts);

                var originalValues = _domain(scaleDim, getScaleSortStrategy(dimx.type)).map(fMap);
                var autoScaledVals = dimx.scale ? autoScaleMethods[dimx.scale](originalValues, opts) : originalValues;
                return {
                    extract: function (x) {
                        return fVal(fMap(x));
                    },
                    values: autoScaledVals,
                    source: originalValues
                };
            };

            this.fnScaleMeta = _scaleMeta;

            this.fnScaleTo = function (scaleDim, interval, options) {
                var opts = options || {};
                var dimx = _.defaults({}, meta[scaleDim]);

                var info = _scaleMeta(scaleDim, options);
                var func = rangeMethods[dimx.scale](info.values, interval, opts);

                var wrap = function (domainPropObject) {
                    return func(info.extract(domainPropObject));
                };
                // have to copy properties since d3 produce Function with methods
                Object.keys(func).forEach(function (p) {
                    return wrap[p] = func[p];
                });
                return wrap;
            };

            this.fnScaleColor = function (scaleDim, brewer, options) {
                var opts = options || {};

                var info = _scaleMeta(scaleDim, opts);

                var defaultColorClass = _.constant("color-default");

                var defaultRangeColor = _.times(20, function (i) {
                    return "color20-" + (1 + i);
                });

                var buildArrayGetClass = function (domain, brewer) {
                    if (domain.length === 0 || domain.length === 1 && domain[0] === null) {
                        return defaultColorClass;
                    } else {
                        var fullDomain = domain.map(function (x) {
                            return String(x).toString();
                        });
                        return d3.scale.ordinal().range(brewer).domain(fullDomain);
                    }
                };

                var buildObjectGetClass = function (brewer, defaultGetClass) {
                    var domain = _.keys(brewer);
                    var range = _.values(brewer);
                    var calculateClass = d3.scale.ordinal().range(range).domain(domain);
                    return function (d) {
                        return brewer.hasOwnProperty(d) ? calculateClass(d) : defaultGetClass(d);
                    };
                };

                var wrapString = function (f) {
                    return function (d) {
                        return f(String(d).toString());
                    };
                };

                var func;
                if (!brewer) {
                    func = wrapString(buildArrayGetClass(info.values, defaultRangeColor));
                } else if (_.isArray(brewer)) {
                    func = wrapString(buildArrayGetClass(info.values, brewer));
                } else if (_.isFunction(brewer)) {
                    func = function (d) {
                        return brewer(d, wrapString(buildArrayGetClass(info.values, defaultRangeColor)));
                    };
                } else if (_.isObject(brewer)) {
                    func = buildObjectGetClass(brewer, defaultColorClass);
                } else {
                    throw new Error("This brewer is not supported");
                }

                var wrap = function (domainPropObject) {
                    return func(info.extract(domainPropObject));
                };

                wrap.get = wrap;
                wrap.dimension = scaleDim;

                wrap.legend = function (domainPropObject) {
                    var value = info.extract(domainPropObject);
                    var label = opts.tickLabel ? (domainPropObject || {})[opts.tickLabel] : value;
                    var color = func(value);

                    return { value: value, color: color, label: label };
                };

                return wrap;
            };

            this.fnScaleSize = function (scaleDim, range, options) {
                var opts = options || {};

                var minSize = range[0];
                var maxSize = range[1];
                var normalSize = range[range.length - 1];

                var info = _scaleMeta(scaleDim, opts);

                var func = sizeScale(info.source, minSize, maxSize, normalSize);

                var wrap = function (domainPropObject) {
                    return func(info.extract(domainPropObject));
                };

                return wrap;
            };
        }

        _prototypeProperties(UnitDomainMixin, null, {
            mix: {
                value: function mix(unit) {
                    unit.dimension = this.fnDimension;
                    unit.source = this.fnSource;
                    unit.domain = this.fnDomain;
                    unit.scaleMeta = this.fnScaleMeta;

                    unit.scaleTo = this.fnScaleTo;
                    unit.scaleDist = this.fnScaleTo;
                    unit.scaleColor = this.fnScaleColor;
                    unit.scaleSize = this.fnScaleSize;

                    unit.partition = function () {
                        return unit.data || unit.source(unit.$where);
                    };
                    unit.groupBy = function (srcValues, splitByProperty) {
                        var varMeta = unit.scaleMeta(splitByProperty);
                        return _.chain(srcValues).groupBy(function (item) {
                            return varMeta.extract(item[splitByProperty]);
                        }).map(function (values) {
                            return {
                                key: values[0][splitByProperty],
                                values: values
                            };
                        }).value();
                    };
                    return unit;
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return UnitDomainMixin;
    })();
    exports.__esModule = true;
});
define('units-registry',["exports"], function (exports) {
    

    var UnitsMap = {};

    var UnitsRegistry = {

        add: function (unitType, xUnit) {
            var unit = {};
            unit.draw = typeof xUnit === "function" ? xUnit : xUnit.draw;
            unit.walk = xUnit.walk || function (x) {
                return x;
            };
            UnitsMap[unitType] = unit;
            return this;
        },

        get: function (unitType) {
            if (!UnitsMap.hasOwnProperty(unitType)) {
                throw new Error("Unknown unit type: " + unitType);
            }

            return UnitsMap[unitType];
        }
    };

    exports.UnitsRegistry = UnitsRegistry;
    exports.__esModule = true;
});
define('data-processor',["exports", "./utils/utils"], function (exports, _utilsUtils) {
    

    var utils = _utilsUtils.utils;


    var isObject = function (obj) {
        return obj === Object(obj);
    };

    var DataProcessor = {

        isYFunctionOfX: function (data, xFields, yFields) {
            var isRelationAFunction = true;
            var error = null;
            // domain should has only 1 value from range
            try {
                data.reduce(function (memo, item) {
                    var fnVar = function (hash, f) {
                        var propValue = item[f];
                        var hashValue = isObject(propValue) ? JSON.stringify(propValue) : propValue;
                        hash.push(hashValue);
                        return hash;
                    };

                    var key = xFields.reduce(fnVar, []).join("/");
                    var val = yFields.reduce(fnVar, []).join("/");

                    if (!memo.hasOwnProperty(key)) {
                        memo[key] = val;
                    } else {
                        var prevVal = memo[key];
                        if (prevVal !== val) {
                            error = {
                                type: "RelationIsNotAFunction",
                                keyX: xFields.join("/"),
                                keyY: yFields.join("/"),
                                valX: key,
                                errY: [prevVal, val]
                            };

                            throw new Error("RelationIsNotAFunction");
                        }
                    }
                    return memo;
                }, {});
            } catch (ex) {
                if (ex.message !== "RelationIsNotAFunction") {
                    throw ex;
                }

                isRelationAFunction = false;
            }

            return {
                result: isRelationAFunction,
                error: error
            };
        },

        excludeNullValues: function (dimensions, onExclude) {
            var fields = Object.keys(dimensions).reduce(function (fields, k) {
                var d = dimensions[k];
                if ((!d.hasOwnProperty("hasNull") || d.hasNull) && (d.type === "measure" || d.scale === "period")) {
                    // rule: exclude null values of "measure" type or "period" scale
                    fields.push(k);
                }
                return fields;
            }, []);
            return function (row) {
                var result = !fields.some(function (f) {
                    return !(f in row) || row[f] === null;
                });
                if (!result) {
                    onExclude(row);
                }
                return result;
            };
        },

        autoAssignScales: function (dimensions) {
            var defaultType = "category";
            var scaleMap = {
                category: "ordinal",
                order: "ordinal",
                measure: "linear"
            };

            var r = {};
            Object.keys(dimensions).forEach(function (k) {
                var v = dimensions[k];
                var t = (v.type || defaultType).toLowerCase();
                r[k] = {};
                r[k].type = t;
                r[k].scale = v.scale || scaleMap[t];
                r[k].value = v.value;
            });

            return r;
        },

        autoDetectDimTypes: function (data) {
            var defaultDetect = {
                type: "category",
                scale: "ordinal"
            };

            var detectType = function (propertyValue, defaultDetect) {
                var pair = defaultDetect;

                if (_.isDate(propertyValue)) {
                    pair.type = "measure";
                    pair.scale = "time";
                } else if (_.isObject(propertyValue)) {
                    pair.type = "order";
                    pair.scale = "ordinal";
                } else if (_.isNumber(propertyValue)) {
                    pair.type = "measure";
                    pair.scale = "linear";
                }

                return pair;
            };

            var reducer = function (memo, rowItem) {
                Object.keys(rowItem).forEach(function (key) {
                    var val = rowItem.hasOwnProperty(key) ? rowItem[key] : null;

                    memo[key] = memo[key] || {
                        type: null,
                        hasNull: false
                    };

                    if (val === null) {
                        memo[key].hasNull = true;
                    } else {
                        var typeScalePair = detectType(val, utils.clone(defaultDetect));
                        var detectedType = typeScalePair.type;
                        var detectedScale = typeScalePair.scale;

                        var isInContraToPrev = memo[key].type !== null && memo[key].type !== detectedType;
                        memo[key].type = isInContraToPrev ? defaultDetect.type : detectedType;
                        memo[key].scale = isInContraToPrev ? defaultDetect.scale : detectedScale;
                    }
                });

                return memo;
            };

            return _.reduce(data, reducer, {});
        }
    };

    exports.DataProcessor = DataProcessor;
    exports.__esModule = true;
});
define('utils/layuot-template',["exports", "../const"], function (exports, _const) {
    

    var CSS_PREFIX = _const.CSS_PREFIX;
    var createElement = function (cssClass, parent) {
        var tag = "div";
        var element = document.createElement(tag);
        element.classList.add(CSS_PREFIX + cssClass);
        if (parent) {
            parent.appendChild(element);
        }
        return element;
    };
    var getLayout = function () {
        var layout = createElement("layout");
        var header = createElement("layout__header", layout);
        var centerContainer = createElement("layout__container", layout);
        var leftSidebar = createElement("layout__sidebar", centerContainer);
        var contentContainer = createElement("layout__content", centerContainer);
        var content = createElement("layout__content__wrap", contentContainer);
        var rightSidebarContainer = createElement("layout__sidebar-right", centerContainer);
        var rightSidebar = createElement("layout__sidebar-right__wrap", rightSidebarContainer);
        var footer = createElement("layout__footer", layout);
        /* jshint ignore:start */
        return {
            layout: layout,
            header: header,
            content: content,
            leftSidebar: leftSidebar,
            rightSidebar: rightSidebar,
            footer: footer
        };
        /* jshint ignore:end */
    };


    exports.getLayout = getLayout;
    exports.__esModule = true;
});
define('charts/tau.plot',["exports", "../dsl-reader", "../api/balloon", "../event", "../spec-engine-factory", "../layout-engine-factory", "../plugins", "../utils/utils", "../utils/utils-dom", "../const", "../unit-domain-mixin", "../units-registry", "../data-processor", "../utils/layuot-template"], function (exports, _dslReader, _apiBalloon, _event, _specEngineFactory, _layoutEngineFactory, _plugins, _utilsUtils, _utilsUtilsDom, _const, _unitDomainMixin, _unitsRegistry, _dataProcessor, _utilsLayuotTemplate) {
    

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

    var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

    var DSLReader = _dslReader.DSLReader;
    var Tooltip = _apiBalloon.Tooltip;
    var Emitter = _event.Emitter;
    var SpecEngineFactory = _specEngineFactory.SpecEngineFactory;
    var LayoutEngineFactory = _layoutEngineFactory.LayoutEngineFactory;
    var Plugins = _plugins.Plugins;
    var propagateDatumEvents = _plugins.propagateDatumEvents;
    var utils = _utilsUtils.utils;
    var utilsDom = _utilsUtilsDom.utilsDom;
    var CSS_PREFIX = _const.CSS_PREFIX;
    var UnitDomainMixin = _unitDomainMixin.UnitDomainMixin;
    var UnitsRegistry = _unitsRegistry.UnitsRegistry;
    var DataProcessor = _dataProcessor.DataProcessor;
    var getLayout = _utilsLayuotTemplate.getLayout;
    var Plot = exports.Plot = (function (Emitter) {
        function Plot(config) {
            _get(Object.getPrototypeOf(Plot.prototype), "constructor", this).call(this);
            this._svg = null;
            this._filtersStore = {
                filters: {},
                tick: 0
            };
            this._layout = getLayout();
            this.setupConfig(config);
            //plugins
            this._plugins = new Plugins(this.config.plugins, this);
        }

        _inherits(Plot, Emitter);

        _prototypeProperties(Plot, null, {
            setupConfig: {
                value: function setupConfig(config) {
                    if (!config.spec && !config.spec.unit) {
                        throw new Error("Provide spec for plot");
                    }

                    this.config = _.defaults(config, {
                        spec: {},
                        data: [],
                        plugins: [],
                        settings: {}
                    });
                    this._emptyContainer = config.emptyContainer || "";
                    // TODO: remove this particular config cases
                    this.config.settings.specEngine = this.config.specEngine || this.config.settings.specEngine;
                    this.config.settings.layoutEngine = this.config.layoutEngine || this.config.settings.layoutEngine;
                    this.config.settings = this.setupSettings(this.config.settings);
                    if (!utils.isArray(this.config.settings.specEngine)) {
                        this.config.settings.specEngine = [{
                            width: Number.MAX_VALUE,
                            name: this.config.settings.specEngine
                        }];
                    }

                    this.config.spec.dimensions = this.setupMetaInfo(this.config.spec.dimensions, this.config.data);

                    var log = this.config.settings.log;
                    if (this.config.settings.excludeNull) {
                        this.addFilter({
                            tag: "default",
                            predicate: DataProcessor.excludeNullValues(this.config.spec.dimensions, function (item) {
                                log([item, "point was excluded, because it has undefined values."], "WARN");
                            })
                        });
                    }
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            getConfig: {
                value: function getConfig() {
                    return this.config;
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            setupMetaInfo: {
                value: function setupMetaInfo(dims, data) {
                    var meta = dims ? dims : DataProcessor.autoDetectDimTypes(data);
                    return DataProcessor.autoAssignScales(meta);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            setupSettings: {
                value: function setupSettings(configSettings) {
                    var globalSettings = Plot.globalSettings;
                    var localSettings = {};
                    Object.keys(globalSettings).forEach(function (k) {
                        localSettings[k] = _.isFunction(globalSettings[k]) ? globalSettings[k] : utils.clone(globalSettings[k]);
                    });

                    return _.defaults(configSettings || {}, localSettings);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            insertToRightSidebar: {
                value: function insertToRightSidebar(el) {
                    return utilsDom.appendTo(el, this._layout.rightSidebar);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            insertToHeader: {
                value: function insertToHeader(el) {
                    return utilsDom.appendTo(el, this._layout.header);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            addBalloon: {
                value: function addBalloon(conf) {
                    return new Tooltip("", conf || {});
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            renderTo: {
                value: function renderTo(target, xSize) {
                    this._renderGraph = null;
                    this._svg = null;
                    this._defaultSize = _.clone(xSize);
                    var container = d3.select(target);
                    var containerNode = container.node();
                    this._target = target;
                    if (containerNode === null) {
                        throw new Error("Target element not found");
                    }

                    containerNode.appendChild(this._layout.layout);
                    container = d3.select(this._layout.content);
                    //todo don't compute width if width or height were passed
                    var size = _.clone(xSize) || {};
                    this._layout.content.innerHTML = "";
                    if (!size.width || !size.height) {
                        size = _.defaults(size, utilsDom.getContainerSize(this._layout.content.parentNode));
                    }

                    var drawData = this.getData();
                    if (drawData.length === 0) {
                        this._layout.content.innerHTML = this._emptyContainer;
                        return;
                    }
                    this._layout.content.innerHTML = "";

                    var domainMixin = new UnitDomainMixin(this.config.spec.dimensions, drawData);

                    var specItem = _.find(this.config.settings.specEngine, function (item) {
                        return size.width <= item.width;
                    });


                    this.config.settings.size = size;
                    var specEngine = SpecEngineFactory.get(specItem.name, this.config.settings);

                    var fullSpec = specEngine(this.config.spec, domainMixin.mix({}));

                    var optimalSize = this.config.settings.size;

                    var reader = new DSLReader(domainMixin, UnitsRegistry);

                    var chart = this;
                    var logicXGraph = reader.buildGraph(fullSpec);
                    var layoutGraph = LayoutEngineFactory.get(this.config.settings.layoutEngine)(logicXGraph);
                    var renderGraph = reader.calcLayout(layoutGraph, optimalSize);
                    var svgXElement = reader.renderGraph(renderGraph, container.append("svg").attr("class", CSS_PREFIX + "svg").attr("width", optimalSize.width).attr("height", optimalSize.height), function (unitMeta) {
                        return chart.fire("unitready", unitMeta);
                    });
                    this._renderGraph = renderGraph;
                    this._svg = svgXElement.node();
                    svgXElement.selectAll(".i-role-datum").call(propagateDatumEvents(this));
                    this._layout.rightSidebar.style.maxHeight = optimalSize.height + "px";
                    this.fire("render", this._svg);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            getData: {
                value: function getData(param) {
                    param = param || {};
                    var filters = _.chain(this._filtersStore.filters).values().flatten().reject(function (filter) {
                        return _.contains(param.excludeFilter, filter.tag);
                    }).pluck("predicate").value();
                    return _.filter(this.config.data, _.reduce(filters, function (newPredicate, filter) {
                        return function (x) {
                            return newPredicate(x) && filter(x);
                        };
                    }, function () {
                        return true;
                    }));
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            setData: {
                value: function setData(data) {
                    this.config.data = data;
                    this.refresh();
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            getSVG: {
                value: function getSVG() {
                    return this._svg;
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            addFilter: {
                value: function addFilter(filter) {
                    var tag = filter.tag;
                    var filters = this._filtersStore.filters[tag] = this._filtersStore.filters[tag] || [];
                    var id = this._filtersStore.tick++;
                    filter.id = id;
                    filters.push(filter);
                    this.refresh();
                    return id;
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            removeFilter: {
                value: function removeFilter(id) {
                    var _this = this;
                    _.each(this._filtersStore.filters, function (filters, key) {
                        _this._filtersStore.filters[key] = _.reject(filters, function (item) {
                            return item.id === id;
                        });
                    });
                    this.refresh();
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            refresh: {
                value: function refresh() {
                    if (this._target) {
                        this.renderTo(this._target, this._defaultSize);
                    }
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            resize: {
                value: function resize() {
                    var sizes = arguments[0] === undefined ? {} : arguments[0];
                    this.renderTo(this._target, sizes);
                },
                writable: true,
                enumerable: true,
                configurable: true
            },
            select: {
                value: function select(queryFilter) {
                    var r = [];

                    if (!this._renderGraph) {
                        return r;
                    }

                    var fnTraverseLayout = function (node, iterator) {
                        iterator(node);
                        (node.childUnits || []).forEach(function (subNode) {
                            return fnTraverseLayout(subNode, iterator);
                        });
                    };

                    fnTraverseLayout(this._renderGraph, function (node) {
                        if (queryFilter(node)) {
                            r.push(node);
                        }
                    });

                    return r;
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return Plot;
    })(Emitter);
    exports.__esModule = true;
});
define('charts/tau.chart',["exports", "./tau.plot", "../utils/utils", "../data-processor"], function (exports, _tauPlot, _utilsUtils, _dataProcessor) {
    

    var _defineProperty = function (obj, key, value) { return Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); };

    var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

    var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

    var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

    var Plot = _tauPlot.Plot;
    var utils = _utilsUtils.utils;
    var DataProcessor = _dataProcessor.DataProcessor;


    var convertAxis = function (data) {
        return !data ? null : data;
    };

    var normalizeSettings = function (axis) {
        return !utils.isArray(axis) ? [axis] : axis.length === 0 ? [null] : axis;
    };

    var createElement = function (type, config) {
        return {
            type: type,
            x: config.x,
            y: config.y,
            color: config.color,
            guide: {
                color: config.colorGuide,
                size: config.sizeGuide
            },
            flip: config.flip,
            size: config.size
        };
    };

    var status = {
        SUCCESS: "SUCCESS",
        WARNING: "WARNING",
        FAIL: "FAIL"
    };
    /* jshint ignore:start */
    var strategyNormalizeAxis = (function () {
        var _strategyNormalizeAxis = {};

        _defineProperty(_strategyNormalizeAxis, status.SUCCESS, function (axis) {
            return axis;
        });

        _defineProperty(_strategyNormalizeAxis, status.FAIL, function (axis, data) {
            throw new Error((data.messages || []).join("\n") || "This configuration is not supported, See http://api.taucharts.com/basic/facet.html#easy-approach-for-creating-facet-chart");
        });

        _defineProperty(_strategyNormalizeAxis, status.WARNING, function (axis, config, guide) {
            var axisName = config.axis;
            var index = config.indexMeasureAxis[0];
            var measure = axis[index];
            var newAxis = _.without(axis, measure);
            newAxis.push(measure);

            var measureGuide = guide[index][axisName] || {};
            var categoryGuide = guide[guide.length - 1][axisName] || {};

            guide[guide.length - 1][axisName] = measureGuide;
            guide[index][axisName] = categoryGuide;

            return newAxis;
        });

        return _strategyNormalizeAxis;
    })();
    /* jshint ignore:end */
    function validateAxis(dimensions, axis, axisName) {
        return axis.reduce(function (result, item, index) {
            var dimension = dimensions[item];
            if (!dimension) {
                result.status = status.FAIL;
                if (item) {
                    result.messages.push("\"" + item + "\" dimension is undefined for \"" + axisName + "\" axis");
                } else {
                    result.messages.push("\"" + axisName + "\" axis should be specified");
                }
            } else if (result.status != status.FAIL) {
                if (dimension.type === "measure") {
                    result.countMeasureAxis++;
                    result.indexMeasureAxis.push(index);
                }
                if (dimension.type !== "measure" && result.countMeasureAxis === 1) {
                    result.status = status.WARNING;
                } else if (result.countMeasureAxis > 1) {
                    result.status = status.FAIL;
                    result.messages.push("There is more than one measure dimension for \"" + axisName + "\" axis");
                }
            }
            return result;
        }, { status: status.SUCCESS, countMeasureAxis: 0, indexMeasureAxis: [], messages: [], axis: axisName });
    }
    function transformConfig(type, config) {
        var x = normalizeSettings(config.x);
        var y = normalizeSettings(config.y);

        var maxDeep = Math.max(x.length, y.length);

        var guide = normalizeSettings(config.guide);

        // feel the gaps if needed
        while (guide.length < maxDeep) {
            guide.push({});
        }

        // cut items
        guide = guide.slice(0, maxDeep);

        var validatedX = validateAxis(config.dimensions, x, "x");
        var validatedY = validateAxis(config.dimensions, y, "y");
        x = strategyNormalizeAxis[validatedX.status](x, validatedX, guide);
        y = strategyNormalizeAxis[validatedY.status](y, validatedY, guide);

        var spec = {
            type: "COORDS.RECT",
            unit: []
        };

        for (var i = maxDeep; i > 0; i--) {
            var currentX = x.pop();
            var currentY = y.pop();
            var currentGuide = guide.pop() || {};
            if (i === maxDeep) {
                spec.x = currentX;
                spec.y = currentY;
                spec.unit.push(createElement(type, {
                    x: convertAxis(currentX),
                    y: convertAxis(currentY),
                    color: config.color,
                    size: config.size,
                    flip: config.flip,
                    colorGuide: currentGuide.color,
                    sizeGuide: currentGuide.size
                }));
                spec.guide = _.defaults(currentGuide, {
                    x: { label: currentX },
                    y: { label: currentY }
                });
            } else {
                spec = {
                    type: "COORDS.RECT",
                    x: convertAxis(currentX),
                    y: convertAxis(currentY),
                    unit: [spec],
                    guide: _.defaults(currentGuide, {
                        x: { label: currentX },
                        y: { label: currentY }
                    })
                };
            }
        }

        config.spec = {
            dimensions: config.dimensions,
            unit: spec
        };
        return config;
    }

    var typesChart = {
        scatterplot: function (config) {
            return transformConfig("ELEMENT.POINT", config);
        },
        line: function (config) {
            var data = config.data;

            var log = config.settings.log;

            var lineOrientationStrategies = {

                none: function (config) {
                    return null;
                },

                horizontal: function (config) {
                    var xs = utils.isArray(config.x) ? config.x : [config.x];
                    return xs[xs.length - 1];
                },

                vertical: function (config) {
                    var ys = utils.isArray(config.y) ? config.y : [config.y];
                    return ys[ys.length - 1];
                },

                auto: function (config) {
                    var xs = utils.isArray(config.x) ? config.x : [config.x];
                    var ys = utils.isArray(config.y) ? config.y : [config.y];
                    var primaryX = xs[xs.length - 1];
                    var secondaryX = xs.slice(0, xs.length - 1);
                    var primaryY = ys[ys.length - 1];
                    var secondaryY = ys.slice(0, ys.length - 1);
                    var colorProp = config.color;

                    var rest = secondaryX.concat(secondaryY).concat([colorProp]).filter(function (x) {
                        return x !== null;
                    });

                    var variantIndex = -1;
                    var variations = [[[primaryX].concat(rest), primaryY], [[primaryY].concat(rest), primaryX]];
                    var isMatchAny = variations.some(function (item, i) {
                        var domainFields = item[0];
                        var rangeProperty = item[1];
                        var r = DataProcessor.isYFunctionOfX(data, domainFields, [rangeProperty]);
                        if (r.result) {
                            variantIndex = i;
                        } else {
                            log(["Attempt to find a functional relation between", item[0] + " and " + item[1] + " is failed.", "There are several " + r.error.keyY + " values (e.g. " + r.error.errY.join(",") + ")", "for (" + r.error.keyX + " = " + r.error.valX + ")."].join(" "));
                        }
                        return r.result;
                    });

                    var propSortBy;
                    if (isMatchAny) {
                        propSortBy = variations[variantIndex][0][0];
                    } else {
                        log(["All attempts are failed.", "Will orient line horizontally by default.", "NOTE: the [scatterplot] chart is more convenient for that data."].join(" "));
                        propSortBy = primaryX;
                    }

                    return propSortBy;
                }
            };

            var orient = (config.lineOrientation || "auto").toLowerCase();
            var strategy = lineOrientationStrategies.hasOwnProperty(orient) ? lineOrientationStrategies[orient] : lineOrientationStrategies.auto;

            var propSortBy = strategy(config);
            if (propSortBy !== null) {
                config.data = _(data).sortBy(propSortBy);
            }

            return transformConfig("ELEMENT.LINE", config);
        },
        bar: function (config) {
            config.flip = false;
            return transformConfig("ELEMENT.INTERVAL", config);
        },
        horizontalBar: function (config) {
            config.flip = true;
            return transformConfig("ELEMENT.INTERVAL", config);
        }
    };
    var Chart = (function (Plot) {
        function Chart(config) {
            config = _.defaults(config, { autoResize: true });
            if (config.autoResize) {
                Chart.winAware.push(this);
            }
            config.settings = this.setupSettings(config.settings);
            config.dimensions = this.setupMetaInfo(config.dimensions, config.data);
            var chartFactory = typesChart[config.type];

            if (_.isFunction(chartFactory)) {
                _get(Object.getPrototypeOf(Chart.prototype), "constructor", this).call(this, chartFactory(config));
            } else {
                throw new Error("Chart type " + config.type + " is not supported. Use one of " + _.keys(typesChart).join(", ") + ".");
            }
        }

        _inherits(Chart, Plot);

        _prototypeProperties(Chart, null, {
            destroy: {
                value: function destroy() {
                    var index = Chart.winAware.indexOf(this);
                    if (index !== -1) {
                        Chart.winAware.splice(index, 1);
                    }
                    _get(Object.getPrototypeOf(Chart.prototype), "destroy", this).call(this);
                },
                writable: true,
                enumerable: true,
                configurable: true
            }
        });

        return Chart;
    })(Plot);

    Chart.resizeOnWindowEvent = (function () {
        var rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (fn) {
            return setTimeout(fn, 17);
        };
        var rIndex;

        function requestReposition() {
            if (rIndex || !Chart.winAware.length) {
                return;
            }
            rIndex = rAF(resize);
        }

        function resize() {
            rIndex = 0;
            var chart;
            for (var i = 0, l = Chart.winAware.length; i < l; i++) {
                chart = Chart.winAware[i];
                chart.resize();
            }
        }

        return requestReposition;
    })();
    Chart.winAware = [];
    window.addEventListener("resize", Chart.resizeOnWindowEvent);
    exports.Chart = Chart;
    exports.__esModule = true;
});
define('elements/coords',["exports", "../utils/utils-draw", "../const", "../utils/utils", "../matrix"], function (exports, _utilsUtilsDraw, _const, _utilsUtils, _matrix) {
    

    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var CSS_PREFIX = _const.CSS_PREFIX;
    var utils = _utilsUtils.utils;
    var TMatrix = _matrix.TMatrix;


    var FacetAlgebra = {

        CROSS: function (root, dimX, domainX, dimY, domainY) {
            var domX = domainX.length === 0 ? [null] : domainX;
            var domY = domainY.length === 0 ? [null] : domainY.reverse();

            var convert = function (v) {
                return v instanceof Date ? v.getTime() : v;
            };

            return _(domY).map(function (rowVal) {
                return _(domX).map(function (colVal) {
                    var r = {};

                    if (dimX) {
                        r[dimX] = convert(colVal);
                    }

                    if (dimY) {
                        r[dimY] = convert(rowVal);
                    }

                    return r;
                });
            });
        }
    };

    var TFuncMap = function (opName) {
        return FacetAlgebra[opName] || function () {
            return [[{}]];
        };
    };

    var inheritRootProps = function (unit, root, props) {
        var r = _.defaults(utils.clone(unit), _.pick.apply(_, [root].concat(props)));
        r.guide = _.extend(utils.clone(root.guide), r.guide);
        return r;
    };

    var coords = {

        walk: function (unit, continueTraverse) {
            var root = _.defaults(unit, { $where: {} });

            var isFacet = _.any(root.unit, function (n) {
                return n.type.indexOf("COORDS.") === 0;
            });
            var unitFunc = TFuncMap(isFacet ? "CROSS" : "");

            var domainX = root.scaleMeta(root.x, _.omit(root.guide.x, "tickLabel")).values;
            var domainY = root.scaleMeta(root.y, _.omit(root.guide.y, "tickLabel")).values;
            var matrixOfPrFilters = new TMatrix(unitFunc(root, root.x, domainX, root.y, domainY));
            var matrixOfUnitNodes = new TMatrix(matrixOfPrFilters.sizeR(), matrixOfPrFilters.sizeC());

            matrixOfPrFilters.iterate(function (row, col, $whereRC) {
                var cellWhere = _.extend({}, root.$where, $whereRC);
                var cellNodes = _(root.unit).map(function (sUnit) {
                    return _.extend(inheritRootProps(sUnit, root, ["x", "y"]), { $where: cellWhere });
                });
                matrixOfUnitNodes.setRC(row, col, cellNodes);
            });

            root.$matrix = matrixOfUnitNodes;

            matrixOfUnitNodes.iterate(function (r, c, cellNodes) {
                _.each(cellNodes, function (refSubNode) {
                    return continueTraverse(refSubNode);
                });
            });

            return root;
        },

        draw: function (node) {
            var options = node.options;
            var padding = node.guide.padding;

            node.x.guide = node.guide.x;
            node.y.guide = node.guide.y;

            var L = options.left + padding.l;
            var T = options.top + padding.t;

            var W = options.width - (padding.l + padding.r);
            var H = options.height - (padding.t + padding.b);

            node.x.scaleObj = node.x.scaleDim && node.scaleTo(node.x.scaleDim, [0, W], node.x.guide);
            node.y.scaleObj = node.y.scaleDim && node.scaleTo(node.y.scaleDim, [H, 0], node.y.guide);

            node.x.guide.size = W;
            node.y.guide.size = H;

            var X_AXIS_POS = [0, H + node.guide.x.padding];
            var Y_AXIS_POS = [0 - node.guide.y.padding, 0];

            var container = options.container.append("g").attr("class", CSS_PREFIX + "cell " + "cell").attr("transform", utilsDraw.translate(L, T)).datum({ $where: node.$where });

            if (!node.x.guide.hide) {
                utilsDraw.fnDrawDimAxis.call(container, node.x, X_AXIS_POS, W);
            }

            if (!node.y.guide.hide) {
                utilsDraw.fnDrawDimAxis.call(container, node.y, Y_AXIS_POS, H);
            }

            return utilsDraw.fnDrawGrid.call(container, node, H, W);
        }
    };
    exports.coords = coords;
    exports.__esModule = true;
});
define('utils/css-class-map',["exports", "../const"], function (exports, _const) {
    

    var CSS_PREFIX = _const.CSS_PREFIX;
    var arrayNumber = [1, 2, 3, 4, 5];
    var countLineClasses = arrayNumber.map(function (i) {
        return CSS_PREFIX + "line-opacity-" + i;
    });
    var widthLineClasses = arrayNumber.map(function (i) {
        return CSS_PREFIX + "line-width-" + i;
    });
    function getLineClassesByCount(count) {
        return countLineClasses[count - 1] || countLineClasses[4];
    }
    function getLineClassesByWidth(width) {
        var index = 0;
        if (width >= 160 && width < 320) {
            index = 1;
        } else if (width >= 320 && width < 480) {
            index = 2;
        } else if (width >= 480 && width < 640) {
            index = 3;
        } else if (width >= 640) {
            index = 4;
        }
        return widthLineClasses[index];
    }
    exports.getLineClassesByWidth = getLineClassesByWidth;
    exports.getLineClassesByCount = getLineClassesByCount;
    exports.__esModule = true;
});
define('elements/line',["exports", "../const", "../utils/css-class-map"], function (exports, _const, _utilsCssClassMap) {
    

    var CSS_PREFIX = _const.CSS_PREFIX;
    var getLineClassesByWidth = _utilsCssClassMap.getLineClassesByWidth;
    var getLineClassesByCount = _utilsCssClassMap.getLineClassesByCount;


    var line = function (node) {
        var options = node.options;

        var xScale = options.xScale;
        var yScale = options.yScale;
        var colorScale = options.color;

        var categories = node.groupBy(node.partition(), node.color.scaleDim);

        var widthClass = getLineClassesByWidth(options.width);
        var countClass = getLineClassesByCount(categories.length);
        var updateLines = function () {
            this.attr("class", function (d) {
                return "" + CSS_PREFIX + "line i-role-element i-role-datum line " + colorScale(d.key) + " " + widthClass + " " + countClass;
            });
            var paths = this.selectAll("path").data(function (d) {
                return [d.values];
            });
            paths.call(updatePaths);
            paths.enter().append("path").call(updatePaths);
            paths.exit().remove();
        };
        var drawPoints = function (points) {
            var update = function () {
                return this.attr("r", 1.5).attr("class", function (d) {
                    return "" + CSS_PREFIX + "dot-line dot-line i-role-element " + CSS_PREFIX + "dot i-role-datum " + colorScale(d[node.color.scaleDim]);
                }).attr("cx", function (d) {
                    return xScale(d[node.x.scaleDim]);
                }).attr("cy", function (d) {
                    return yScale(d[node.y.scaleDim]);
                });
            };

            var elements = options.container.selectAll(".dot-line").data(points);
            elements.call(update);
            elements.exit().remove();
            elements.enter().append("circle").call(update);
        };

        var line = d3.svg.line().x(function (d) {
            return xScale(d[node.x.scaleDim]);
        }).y(function (d) {
            return yScale(d[node.y.scaleDim]);
        });

        var updatePaths = function () {
            this.attr("d", line);
        };


        var points = categories.reduce(function (memo, item) {
            var values = item.values;
            if (values.length === 1) {
                memo.push(values[0]);
            }
            return memo;
        }, []);

        if (points.length > 0) {
            drawPoints(points);
        }

        var lines = options.container.selectAll(".line").data(categories);
        lines.call(updateLines);
        lines.enter().append("g").call(updateLines);
        lines.exit().remove();
    };
    exports.line = line;
    exports.__esModule = true;
});
define('elements/point',["exports", "../const"], function (exports, _const) {
    

    var CSS_PREFIX = _const.CSS_PREFIX;


    var point = function (node) {
        var options = node.options;

        var xScale = options.xScale;
        var yScale = options.yScale;
        var colorScale = options.color;
        var sizeScale = options.sizeScale;

        var update = function () {
            return this.attr("r", function (d) {
                return sizeScale(d[node.size.scaleDim]);
            }).attr("cx", function (d) {
                return xScale(d[node.x.scaleDim]);
            }).attr("cy", function (d) {
                return yScale(d[node.y.scaleDim]);
            }).attr("class", function (d) {
                return "" + CSS_PREFIX + "dot dot i-role-element i-role-datum " + colorScale(d[node.color.scaleDim]);
            });
        };

        var elements = options.container.selectAll(".dot").data(node.partition());
        elements.call(update);
        elements.exit().remove();
        elements.enter().append("circle").call(update);
    };

    exports.point = point;
    exports.__esModule = true;
});
define('elements/interval',["exports", "../utils/utils-draw", "../const"], function (exports, _utilsUtilsDraw, _const) {
    

    var _toArray = function (arr) { return Array.isArray(arr) ? arr : Array.from(arr); };

    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var CSS_PREFIX = _const.CSS_PREFIX;


    var BAR_GROUP = "i-role-bar-group";

    var isMeasure = function (dim) {
        return dim.dimType === "measure";
    };

    var getSizesParams = function (params) {
        var countDomainValue = params.domain().length;
        var countCategory = params.categoryLength;
        var tickWidth = params.size / countDomainValue;
        var intervalWidth = tickWidth / (countCategory + 1);
        return {
            tickWidth: tickWidth,
            intervalWidth: intervalWidth,
            offsetCategory: intervalWidth
        };
    };

    var flipHub = {

        NORM: function (node, xScale, yScale, colorIndexScale, width, height, defaultSizeParams) {
            var minimalHeight = 1;
            var yMin = Math.min.apply(Math, _toArray(yScale.domain()));
            var isYNumber = !isNaN(yMin);
            var startValue = !isYNumber || yMin <= 0 ? 0 : yMin;
            var isXNumber = isMeasure(node.x);

            var _ref = isXNumber ? defaultSizeParams : getSizesParams({
                domain: xScale.domain,
                categoryLength: colorIndexScale.count(),
                size: width
            });
            var tickWidth = _ref.tickWidth;
            var intervalWidth = _ref.intervalWidth;
            var offsetCategory = _ref.offsetCategory;


            var calculateX = function (d) {
                return xScale(d[node.x.scaleDim]) - tickWidth / 2;
            };
            var calculateY = isYNumber ? function (d) {
                var valY = d[node.y.scaleDim];
                var dotY = yScale(Math.max(startValue, valY));
                var h = Math.abs(yScale(valY) - yScale(startValue));
                var isTooSmall = h < minimalHeight;
                return isTooSmall && valY > 0 ? dotY - minimalHeight : dotY;
            } : function (d) {
                return yScale(d[node.y.scaleDim]);
            };

            var calculateWidth = function (d) {
                return intervalWidth;
            };
            var calculateHeight = isYNumber ? function (d) {
                var valY = d[node.y.scaleDim];
                var h = Math.abs(yScale(valY) - yScale(startValue));
                return valY === 0 ? h : Math.max(minimalHeight, h);
            } : function (d) {
                return height - yScale(d[node.y.scaleDim]);
            };

            var calculateTranslate = function (d) {
                return utilsDraw.translate(colorIndexScale(d) * offsetCategory + offsetCategory / 2, 0);
            };

            return { calculateX: calculateX, calculateY: calculateY, calculateWidth: calculateWidth, calculateHeight: calculateHeight, calculateTranslate: calculateTranslate };
        },

        FLIP: function (node, xScale, yScale, colorIndexScale, width, height, defaultSizeParams) {
            var minimalHeight = 1;
            var xMin = Math.min.apply(Math, _toArray(xScale.domain()));
            var isXNumber = !isNaN(xMin);
            var startValue = !isXNumber || xMin <= 0 ? 0 : xMin;
            var isYNumber = isMeasure(node.y);

            var _ref = isYNumber ? defaultSizeParams : getSizesParams({
                domain: yScale.domain,
                categoryLength: colorIndexScale.count(),
                size: height
            });
            var tickWidth = _ref.tickWidth;
            var intervalWidth = _ref.intervalWidth;
            var offsetCategory = _ref.offsetCategory;


            var calculateX = isXNumber ? function (d) {
                var valX = d[node.x.scaleDim];
                var h = Math.abs(xScale(valX) - xScale(startValue));
                var dotX = xScale(Math.min(startValue, valX));
                var delta = h - minimalHeight;
                var offset = valX > 0 ? minimalHeight + delta : valX < 0 ? 0 - minimalHeight : 0;

                var isTooSmall = delta < 0;
                return isTooSmall ? dotX + offset : dotX;
            } : 0;
            var calculateY = function (d) {
                return yScale(d[node.y.scaleDim]) - tickWidth / 2;
            };
            var calculateWidth = isXNumber ? function (d) {
                var valX = d[node.x.scaleDim];
                var h = Math.abs(xScale(valX) - xScale(startValue));
                return valX === 0 ? h : Math.max(minimalHeight, h);
            } : function (d) {
                return xScale(d[node.x.scaleDim]);
            };
            var calculateHeight = function (d) {
                return intervalWidth;
            };
            var calculateTranslate = function (d) {
                return utilsDraw.translate(0, colorIndexScale(d) * offsetCategory + offsetCategory / 2);
            };

            return { calculateX: calculateX, calculateY: calculateY, calculateWidth: calculateWidth, calculateHeight: calculateHeight, calculateTranslate: calculateTranslate };
        }
    };

    var interval = function (node) {
        var options = node.options;

        var xScale = options.xScale,
            yScale = options.yScale,
            colorScale = options.color;

        var method = flipHub[node.flip ? "FLIP" : "NORM"];

        var allCategories = node.groupBy(node.source(), node.color.scaleDim);
        var categories = node.groupBy(node.partition(), node.color.scaleDim);

        var colorIndexScale = function (d) {
            var index = 0;
            var targetKey = JSON.stringify(d.key);
            _.find(allCategories, function (catItem, catIndex) {
                var isFound = JSON.stringify(catItem.key) === targetKey;
                if (isFound) {
                    index = catIndex;
                }
                return isFound;
            });

            return index;
        };

        colorIndexScale.count = function () {
            return allCategories.length;
        };

        var _method = method(node, xScale, yScale, colorIndexScale, options.width, options.height, {
            tickWidth: 5,
            intervalWidth: 5,
            offsetCategory: 0
        });

        var calculateX = _method.calculateX;
        var calculateY = _method.calculateY;
        var calculateWidth = _method.calculateWidth;
        var calculateHeight = _method.calculateHeight;
        var calculateTranslate = _method.calculateTranslate;


        var updateBar = function () {
            return this.attr("height", calculateHeight).attr("width", calculateWidth).attr("class", function (d) {
                return "i-role-element i-role-datum bar " + CSS_PREFIX + "bar " + colorScale(d[node.color.scaleDim]);
            }).attr("x", calculateX).attr("y", calculateY);
        };

        var updateBarContainer = function () {
            this.attr("class", BAR_GROUP).attr("transform", calculateTranslate);
            var bars = this.selectAll("bar").data(function (d) {
                return d.values;
            });
            bars.call(updateBar);
            bars.enter().append("rect").call(updateBar);
            bars.exit().remove();
        };

        var elements = options.container.selectAll("." + BAR_GROUP).data(categories);
        elements.call(updateBarContainer);
        elements.enter().append("g").call(updateBarContainer);
        elements.exit().remove();
    };

    exports.interval = interval;
    exports.__esModule = true;
});
define('elements/coords-parallel',["exports", "../utils/utils-draw", "../const", "../utils/utils", "../matrix"], function (exports, _utilsUtilsDraw, _const, _utilsUtils, _matrix) {
    

    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var CSS_PREFIX = _const.CSS_PREFIX;
    var utils = _utilsUtils.utils;
    var TMatrix = _matrix.TMatrix;


    var inheritRootProps = function (unit, root, props) {
        var r = _.defaults(utils.clone(unit), _.pick.apply(_, [root].concat(props)));
        r.guide = _.extend(utils.clone(root.guide || {}), r.guide || {});
        return r;
    };

    var CoordsParallel = {

        walk: function (unit, continueTraverse) {
            var root = _.defaults(unit, { $where: {} });

            var matrixOfPrFilters = new TMatrix(1, 1);
            var matrixOfUnitNodes = new TMatrix(1, 1);

            matrixOfPrFilters.iterate(function (row, col) {
                var cellWhere = _.extend({}, root.$where);
                var cellNodes = _(root.unit).map(function (sUnit) {
                    return _.extend(inheritRootProps(sUnit, root, ["x"]), { $where: cellWhere });
                });
                matrixOfUnitNodes.setRC(row, col, cellNodes);
            });

            root.$matrix = matrixOfUnitNodes;

            matrixOfUnitNodes.iterate(function (r, c, cellNodes) {
                _.each(cellNodes, function (refSubNode) {
                    return continueTraverse(refSubNode);
                });
            });

            return root;
        },

        draw: function (node) {
            var options = node.options;
            var padding = node.guide.padding;

            var L = options.left + padding.l;
            var T = options.top + padding.t;

            var W = options.width - (padding.l + padding.r);
            var H = options.height - (padding.t + padding.b);

            var scaleObjArr = node.x.map(function (xN) {
                return node.scaleTo(xN, [H, 0], {});
            });

            var container = options.container.append("g").attr("class", "graphical-report__" + "cell " + "cell").attr("transform", utilsDraw.translate(L, T));


            var translate = function (left, top) {
                return "translate(" + left + "," + top + ")";
            };
            var rotate = function (angle) {
                return "rotate(" + angle + ")";
            };


            var fnDrawDimAxis = function (xScaleObj, AXIS_POSITION) {
                var container = this;

                var axisScale = d3.svg.axis().scale(xScaleObj).orient("left");

                var nodeScale = container.append("g").attr("class", "y axis").attr("transform", translate.apply(null, AXIS_POSITION)).call(axisScale);

                nodeScale.selectAll(".tick text").attr("transform", rotate(0)).style("text-anchor", "end");
            };

            var offset = W / (node.x.length - 1);
            scaleObjArr.forEach(function (scale, i) {
                fnDrawDimAxis.call(container, scale, [i * offset, 0]);
            });

            return container.append("g").attr("class", "grid").attr("transform", translate(0, 0));
        }
    };
    exports.CoordsParallel = CoordsParallel;
    exports.__esModule = true;
});
define('elements/coords-parallel-line',["exports", "../utils/utils-draw", "../const"], function (exports, _utilsUtilsDraw, _const) {
    

    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var CSS_PREFIX = _const.CSS_PREFIX;


    var CoordsParallelLine = {

        draw: function (node) {
            node.color = node.dimension(node.color, node);

            var guideColor = node.guide.color || {};
            var color = node.scaleColor(node.color.scaleDim, guideColor.brewer, guideColor);

            var options = node.options;

            var scalesMap = node.x.reduce(function (memo, xN) {
                memo[xN] = node.scaleTo(xN, [options.height, 0], {});
                return memo;
            }, {});

            var categories = d3.nest().key(function (d) {
                return d[color.dimension];
            }).entries(node.partition()).map(function (src) {
                var row = src.values[0];
                var memo = [];
                node.x.forEach(function (propName) {
                    memo.push({ key: propName, val: row[propName] });
                });
                return memo;
            });

            var updateLines = function () {
                this.attr("class", function (d) {
                    return "graphical-report__" + "line" + " line " + "color20-9";
                });
                var paths = this.selectAll("path").data(function (d) {
                    return [d];
                });
                paths.call(updatePaths);
                paths.enter().append("path").call(updatePaths);
                paths.exit().remove();
            };

            var segment = options.width / (node.x.length - 1);
            var segmentMap = {};
            node.x.forEach(function (propName, i) {
                segmentMap[propName] = i * segment;
            });

            var fnLine = d3.svg.line().x(function (d) {
                return segmentMap[d.key];
            }).y(function (d) {
                return scalesMap[d.key](d.val);
            });

            var updatePaths = function () {
                this.attr("d", fnLine);
            };

            var lines = options.container.selectAll(".line").data(categories);
            lines.call(updateLines);
            lines.enter().append("g").call(updateLines);
            lines.exit().remove();
        }
    };

    exports.CoordsParallelLine = CoordsParallelLine;
    exports.__esModule = true;
});
define('node-map',["exports", "./elements/coords", "./elements/line", "./elements/point", "./elements/interval", "./utils/utils-draw", "./elements/coords-parallel", "./elements/coords-parallel-line"], function (exports, _elementsCoords, _elementsLine, _elementsPoint, _elementsInterval, _utilsUtilsDraw, _elementsCoordsParallel, _elementsCoordsParallelLine) {
    

    var coords = _elementsCoords.coords;
    var line = _elementsLine.line;
    var point = _elementsPoint.point;
    var interval = _elementsInterval.interval;
    var utilsDraw = _utilsUtilsDraw.utilsDraw;
    var CoordsParallel = _elementsCoordsParallel.CoordsParallel;
    var CoordsParallelLine = _elementsCoordsParallelLine.CoordsParallelLine;


    var fitSize = function (w, h, maxRelLimit, srcSize, minimalSize) {
        var minRefPoint = Math.min(w, h);
        var minSize = minRefPoint * maxRelLimit;
        return Math.max(minimalSize, Math.min(srcSize, minSize));
    };

    var setupElementNode = function (node, dimensions) {
        dimensions.forEach(function (dimName) {
            node[dimName] = node.dimension(node[dimName], node);
        });

        var options = node.options;

        var W = options.width;
        var H = options.height;

        node.x.guide = node.guide.x;
        node.y.guide = node.guide.y;

        node.options.xScale = node.x.scaleDim && node.scaleTo(node.x.scaleDim, [0, W], node.x.guide);
        node.options.yScale = node.y.scaleDim && node.scaleTo(node.y.scaleDim, [H, 0], node.y.guide);

        var guideColor = node.guide.color || {};
        node.options.color = node.scaleColor(node.color.scaleDim, guideColor.brewer, guideColor);

        if (node.size) {
            var minimalSize = 1;
            var maxRelLimit = 0.035;
            var minFontSize = _.min([node.guide.x.tickFontHeight, node.guide.y.tickFontHeight].filter(function (x) {
                return x !== 0;
            })) * 0.5;
            var minTickStep = _.min([node.guide.x.density, node.guide.y.density].filter(function (x) {
                return x !== 0;
            })) * 0.5;
            var guideSize = node.guide.size || {};
            node.options.sizeScale = node.scaleSize(node.size.scaleDim, [fitSize(W, H, maxRelLimit, 2, minimalSize), fitSize(W, H, maxRelLimit, minTickStep, minimalSize), fitSize(W, H, maxRelLimit, minFontSize, minimalSize)], guideSize);
        }

        return node;
    };

    var nodeMap = {

        "COORDS.RECT": {
            walk: coords.walk,
            draw: function (node, continueTraverse) {
                node.x = node.dimension(node.x, node);
                node.y = node.dimension(node.y, node);
                return coords.draw(node, continueTraverse);
            }
        },

        "ELEMENT.POINT": function (node) {
            return point(setupElementNode(node, ["x", "y", "color", "size"]));
        },

        "ELEMENT.LINE": function (node) {
            return line(setupElementNode(node, ["x", "y", "color"]));
        },

        "ELEMENT.INTERVAL": function (node) {
            return interval(setupElementNode(node, ["x", "y", "color"]));
        },

        "COORDS.PARALLEL": CoordsParallel,
        "PARALLEL/ELEMENT.LINE": CoordsParallelLine
    };

    exports.nodeMap = nodeMap;
    exports.__esModule = true;
});
define('tau.newCharts',["exports", "./utils/utils-dom", "./charts/tau.plot", "./charts/tau.chart", "./unit-domain-mixin", "./unit-domain-period-generator", "./dsl-reader", "./spec-engine-factory", "./layout-engine-factory", "./formatter-registry", "./node-map", "./units-registry"], function (exports, _utilsUtilsDom, _chartsTauPlot, _chartsTauChart, _unitDomainMixin, _unitDomainPeriodGenerator, _dslReader, _specEngineFactory, _layoutEngineFactory, _formatterRegistry, _nodeMap, _unitsRegistry) {
    

    var utilsDom = _utilsUtilsDom.utilsDom;
    var Plot = _chartsTauPlot.Plot;
    var Chart = _chartsTauChart.Chart;
    var UnitDomainMixin = _unitDomainMixin.UnitDomainMixin;
    var UnitDomainPeriodGenerator = _unitDomainPeriodGenerator.UnitDomainPeriodGenerator;
    var DSLReader = _dslReader.DSLReader;
    var SpecEngineFactory = _specEngineFactory.SpecEngineFactory;
    var LayoutEngineFactory = _layoutEngineFactory.LayoutEngineFactory;
    var FormatterRegistry = _formatterRegistry.FormatterRegistry;
    var nodeMap = _nodeMap.nodeMap;
    var UnitsRegistry = _unitsRegistry.UnitsRegistry;
    var colorBrewers = {};
    var plugins = {};

    var __api__ = {
        UnitDomainMixin: UnitDomainMixin,
        UnitDomainPeriodGenerator: UnitDomainPeriodGenerator,
        DSLReader: DSLReader,
        SpecEngineFactory: SpecEngineFactory,
        LayoutEngineFactory: LayoutEngineFactory
    };
    var api = {
        UnitsRegistry: UnitsRegistry,
        tickFormat: FormatterRegistry,
        d3: d3,
        _: _,
        tickPeriod: UnitDomainPeriodGenerator,
        colorBrewers: {
            add: function (name, brewer) {
                if (!(name in colorBrewers)) {
                    colorBrewers[name] = brewer;
                }
            },
            get: function (name) {
                return colorBrewers[name];
            }
        },
        plugins: {
            add: function (name, brewer) {
                if (!(name in plugins)) {
                    plugins[name] = brewer;
                } else {
                    throw new Error("Plugin is already registered.");
                }
            },
            get: function (name) {
                return plugins[name];
            }
        },
        globalSettings: {

            log: function (msg, type) {
                type = type || "INFO";
                if (!Array.isArray(msg)) {
                    msg = [msg];
                }
                console[type.toLowerCase()].apply(console, msg);
            },

            excludeNull: true,
            specEngine: [{
                name: "COMPACT",
                width: 600
            }, {
                name: "AUTO",
                width: Number.MAX_VALUE
            }],

            fitSize: true,

            layoutEngine: "EXTRACT",
            getAxisTickLabelSize: _.memoize(utilsDom.getAxisTickLabelSize, function (text) {
                return (text || "").length;
            }),

            getScrollBarWidth: _.memoize(utilsDom.getScrollbarWidth),

            xAxisTickLabelLimit: 100,
            yAxisTickLabelLimit: 100,

            xTickWordWrapLinesLimit: 2,
            yTickWordWrapLinesLimit: 2,

            xTickWidth: 6 + 3,
            yTickWidth: 6 + 3,

            distToXAxisLabel: 20,
            distToYAxisLabel: 20,

            xAxisPadding: 20,
            yAxisPadding: 20,

            xFontLabelHeight: 10,
            yFontLabelHeight: 10,

            xDensityPadding: 4,
            yDensityPadding: 4,
            "xDensityPadding:measure": 8,
            "yDensityPadding:measure": 8,

            defaultFormats: {
                measure: "x-num-auto",
                "measure:time": "x-time-auto"
            }
        }
    };

    Plot.globalSettings = api.globalSettings;

    api.UnitsRegistry.add("COORDS.PARALLEL", nodeMap["COORDS.PARALLEL"]).add("PARALLEL/ELEMENT.LINE", nodeMap["PARALLEL/ELEMENT.LINE"]).add("COORDS.RECT", nodeMap["COORDS.RECT"]).add("ELEMENT.POINT", nodeMap["ELEMENT.POINT"]).add("ELEMENT.LINE", nodeMap["ELEMENT.LINE"]).add("ELEMENT.INTERVAL", nodeMap["ELEMENT.INTERVAL"]);
    exports.Plot = Plot;
    exports.Chart = Chart;
    exports.__api__ = __api__;
    exports.api = api;
    exports.__esModule = true;
});
 define('underscore',function(){
   return _;
 });
 define('d3',function(){
    return d3;
  });
 return require('tau.newCharts');
}));