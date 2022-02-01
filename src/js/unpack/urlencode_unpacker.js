/*global unescape */
/*jshint curly: false, scripturl: true */

/*

  The MIT License (MIT)

  Copyright (c) 2007-2018 Einar Lielmanis, Liam Newman, and contributors.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

//
// trivial bookmarklet/escaped script detector for the javascript beautifier
// written by Einar Lielmanis <einar@beautifier.io>
//
// usage:
//
// if (Urlencoded.detect(some_string)) {
//     var unpacked = Urlencoded.unpack(some_string);
// }
//
//

/*jshint strict:false */

var Urlencoded = {
  detect: function(str) {
    // the fact that script doesn't contain any space, but has %20 instead
    // should be sufficient check for now.
    if (str.indexOf(' ') === -1) {
      if (str.indexOf('%2') !== -1) return true;
      if (str.replace(/[^%]+/g, '').length > 3) return true;
    }
    return false;
  },

  unpack: function(str) {
    if (Urlencoded.detect(str)) {
      if (str.indexOf('%2B') !== -1 || str.indexOf('%2b') !== -1) {
        // "+" escaped as "%2B"
        return unescape(str.replace(/\+/g, '%20'));
      } else {
        return unescape(str);
      }
    }
    return str;
  },
};

export { Urlencoded };
