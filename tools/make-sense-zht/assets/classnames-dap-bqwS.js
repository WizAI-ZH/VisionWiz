var r,t={exports:{}};
/*!
  Copyright (c) 2018 Jed Watson.
  Licensed under the MIT License (MIT), see
  http://jedwatson.github.io/classnames
*/function e(){return r||(r=1,e=t,function(){var r={}.hasOwnProperty;function t(){for(var e=[],n=0;n<arguments.length;n++){var o=arguments[n];if(o){var s=typeof o;if("string"===s||"number"===s)e.push(o);else if(Array.isArray(o)){if(o.length){var a=t.apply(null,o);a&&e.push(a)}}else if("object"===s)if(o.toString===Object.prototype.toString)for(var i in o)r.call(o,i)&&o[i]&&e.push(i);else e.push(o.toString())}}return e.join(" ")}e.exports?(t.default=t,e.exports=t):window.classNames=t}()),t.exports;var e}export{e as r};
