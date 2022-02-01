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
// Unpacker for dean edward's p.a.c.k.e.r, a part of javascript beautifier
//
// Coincidentally, it can defeat a couple of other eval-based compressors.
//
// usage:
//
// if (P_A_C_K_E_R.detect(some_string)) {
//     var unpacked = P_A_C_K_E_R.unpack(some_string);
// }
//
//

/*jshint strict:false */

var P_A_C_K_E_R = {
  detect: function(str) {
    return P_A_C_K_E_R.get_chunks(str).length > 0;
  },

  get_chunks: function(str) {
    var chunks = str.match(
      /eval\(\(?function\(.*?(,0,\{\}\)\)|split\('\|'\)\)\))($|\n)/g
    );
    return chunks ? chunks : [];
  },

  unpack: function(str) {
    var chunks = P_A_C_K_E_R.get_chunks(str),
      chunk;
    for (var i = 0; i < chunks.length; i++) {
      chunk = chunks[i].replace(/\n$/, '');
      str = str.split(chunk).join(P_A_C_K_E_R.unpack_chunk(chunk));
    }
    return str;
  },

  unpack_chunk: function(str) {
    var unpacked_source = '';
    var __eval = eval;
    if (P_A_C_K_E_R.detect(str)) {
      try {
        window.eval = function(s) {
          // jshint ignore:line
          unpacked_source += s;
          return unpacked_source;
        }; // jshint ignore:line
        __eval(str);
        if (typeof unpacked_source === 'string' && unpacked_source) {
          str = unpacked_source;
        }
      } catch (e) {
        // well, it failed. we'll just return the original, instead of crashing on user.
      }
    }
    window.eval = __eval; // jshint ignore:line
    return str;
  },
};

export { P_A_C_K_E_R };
