!function(e,r){if("object"==typeof exports&&"object"==typeof module)module.exports=r(require("taucharts"));else if("function"==typeof define&&define.amd)define([],r);else{var t="object"==typeof exports?r(require("taucharts")):r(e.Taucharts);for(var n in t)("object"==typeof exports?exports:e)[n]=t[n]}}(window,function(e){return function(e){var r={};function t(n){if(r[n])return r[n].exports;var i=r[n]={i:n,l:!1,exports:{}};return e[n].call(i.exports,i,i.exports,t),i.l=!0,i.exports}return t.m=e,t.c=r,t.d=function(e,r,n){t.o(e,r)||Object.defineProperty(e,r,{configurable:!1,enumerable:!0,get:n})},t.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},t.n=function(e){var r=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(r,"a",r),r},t.o=function(e,r){return Object.prototype.hasOwnProperty.call(e,r)},t.p="",t(t.s=19)}({0:function(r,t){r.exports=e},19:function(e,r,t){"use strict";t.r(r);var n=t(0),i=t.n(n),u=i.a.api.utils;function o(e){var r=u.defaults(e||{},{verbose:!1,forceBrush:{}}),t={init:function(e){r.verbose&&(this.panel=e.insertToRightSidebar(this.template())),e.traverseSpec(e.getSpec(),function(e){e&&"COORDS.PARALLEL"===e.type&&(e.guide=e.guide||{},e.guide.enableBrushing=!0)}),t.forceBrush=r.forceBrush||{}},onRender:function(e){var n=e.getSpec().scales,i=Object.keys(n).reduce(function(e,r){var i=n[r].dim;return t.forceBrush[i]&&(e[r]=t.forceBrush[i]),e},{}),u=e.select(function(e){return"PARALLEL/ELEMENT.LINE"===e.config.type});u.forEach(function(e,n){e.parentUnit.on("brush",function(i,u){t.forceBrush={};var o=u.map(function(e){var r=e.dim,n=e.func,i=e.args;t.forceBrush[r]=i;var u=function(){return!0};return"between"===n&&(u=function(e){return e[r]>=i[0]&&i[1]>=e[r]}),"inset"===n&&(u=function(e){return i.indexOf(e[r])>=0}),u}),c=0;if(e.fire("highlight",function(e){var r=o.every(function(r){return r(e)});return c+=r?1:0,r}),r.verbose){var a=t.panel.getElementsByClassName("i-"+n);if(0===a.length){var f=document.createElement("div");f.className="i-"+n,t.panel.appendChild(f),a[0]=f}a[0].innerHTML=u.reduce(function(e,r){return e+"<div>"+r.dim+": ["+r.args.join(",")+"]</div>"},"<div>Matched: "+c+"</div>")}})}),u.forEach(function(e){e.parentUnit.fire("force-brush",i)})},template:u.template('<div class="tau-chart__chart_brushing_panel"></div>')};return t}i.a.api.plugins.add("parallel-brushing",o),r.default=o}})});