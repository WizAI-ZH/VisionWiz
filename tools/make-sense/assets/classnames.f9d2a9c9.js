var r,t={exports:{}};
/*!
	Copyright (c) 2018 Jed Watson.
	Licensed under the MIT License (MIT), see
	http://jedwatson.github.io/classnames
*/r=t,function(){var t={}.hasOwnProperty;function n(){for(var r="",t=0;t<arguments.length;t++){var n=arguments[t];n&&(r=o(r,e(n)))}return r}function e(r){if("string"==typeof r||"number"==typeof r)return r;if("object"!=typeof r)return"";if(Array.isArray(r))return n.apply(null,r);if(r.toString!==Object.prototype.toString&&!r.toString.toString().includes("[native code]"))return r.toString();var e="";for(var i in r)t.call(r,i)&&r[i]&&(e=o(e,i));return e}function o(r,t){return t?r?r+" "+t:r+t:r}r.exports?(n.default=n,r.exports=n):window.classNames=n}();const n=t.exports;export{n as c};
