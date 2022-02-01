import { JavascriptObfuscator } from './javascriptobfuscator_unpacker';
import { P_A_C_K_E_R } from './p_a_c_k_e_r_unpacker';
import { Urlencoded } from './urlencode_unpacker';

function unpackSource(source) {
  var leading_comments = '',
    comment = '',
    unpacked = '',
    found = false;

  // cuts leading comments
  do {
    found = false;
    if (/^\s*\/\*/.test(source)) {
      found = true;
      comment = source.substr(0, source.indexOf('*/') + 2);
      source = source.substr(comment.length);
      leading_comments += comment;
    } else if (/^\s*\/\//.test(source)) {
      found = true;
      comment = source.match(/^\s*\/\/.*/)[0];
      source = source.substr(comment.length);
      leading_comments += comment;
    }
  } while (found);
  leading_comments += '\n';
  source = source.replace(/^\s+/, '');

  var unpackers = [
    P_A_C_K_E_R,
    Urlencoded,
    JavascriptObfuscator,
  ];
  for (var i = 0; i < unpackers.length; i++) {
    if (unpackers[i].detect(source)) {
      unpacked = unpackers[i].unpack(source);
      if (unpacked !== source) {
        source = unpackSource(unpacked);
      }
    }
  }

  return leading_comments + source;
}

export { unpackSource }
