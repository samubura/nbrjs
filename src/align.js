// Alignment transform, run on the host (playground, bundler), never on devices: native control
// flow around aggregate code aligns like branch, so programs need no explicit branch().
//   c ? A : B          -> __nbr.branch(c, () => (A), () => (B))
//   a && B, a || B     -> the same, keeping the value of a
//   if (c) S1 else S2  -> if (__nbr.enterIf(c)) { try S1 finally { __nbr.exit(); } } else ...
//   var f = (..) => ..  -> var f = __nbr.aggregate('f', (..) => ..)   (function identity)
// Only where an arm calls something that may run aggregate operators. Also warns about operators
// in .map()/.forEach() callbacks, which align by position. Needs acorn (a JS parser).
(function (exports) {
  // Calls that never run aggregate operators: no need to align around them.
  var SAFE = /^(sense|nbrSense|id|print|require|Number|String|Boolean|Array|Object|parseInt|parseFloat|isNaN|isFinite|Date|getTime|analogRead|digitalRead|retsend)$/;
  var OPS = /^(xc|nbr|rep|share|branch|align|aggregate)$/;
  var CALLBACKS = /^(map|forEach|filter|some|every|find|findIndex|sort|reduce)$/;

  var children = function (n) {
    var out = [];
    for (var k in n) {
      var v = n[k];
      if (k === 'type' || k === 'loc' || k === 'out' || !v || typeof v !== 'object') continue;
      (Array.isArray(v) ? v : [v]).forEach(function (c) { if (c && typeof c.type === 'string') out.push(c); });
    }
    return out.sort(function (a, b) { return a.start - b.start; });
  };
  var some = function (n, test) {
    return test(n) || children(n).some(function (c) { return some(c, test); });
  };
  // May this subtree run aggregate operators? Any call to a function by name, except SAFE ones.
  var risky = function (n) {
    return !!n && some(n, function (x) {
      return x.type === 'CallExpression' && x.callee.type === 'Identifier' && !SAFE.test(x.callee.name);
    });
  };

  exports.transform = function (src, acorn) {
    var ast = acorn.parse(src, { ecmaVersion: 2020, locations: true, allowReturnOutsideFunction: true });
    var changed = false, warnings = [];
    var out = function (n) {
      if (n.out === undefined) n.out = rewrite(n);
      return n.out;
    };
    var rewrite = function (n) {
      var text = '', pos = n.start;
      children(n).forEach(function (c) { text += src.slice(pos, c.start) + out(c); pos = c.end; });
      text += src.slice(pos, n.end);
      var t = function (c) { return out(c); }, block = function (s) { return s.type === 'BlockStatement' ? t(s) : '{ ' + t(s) + ' }'; };
      if (n.type === 'ConditionalExpression' && (risky(n.consequent) || risky(n.alternate))) {
        changed = true;
        return '__nbr.branch(' + t(n.test) + ', () => (' + t(n.consequent) + '), () => (' + t(n.alternate) + '))';
      }
      if (n.type === 'LogicalExpression' && n.operator !== '??' && risky(n.right)) {
        changed = true;
        var r = '() => (' + t(n.right) + ')';
        return '((v) => __nbr.branch(v, ' + (n.operator === '&&' ? r + ', () => v' : '() => v, ' + r) + '))(' + t(n.left) + ')';
      }
      if (n.type === 'IfStatement' && (risky(n.consequent) || risky(n.alternate))) {
        changed = true;
        return 'if (__nbr.enterIf(' + t(n.test) + ')) { try ' + block(n.consequent) + ' finally { __nbr.exit(); } } ' +
          'else { try ' + (n.alternate ? block(n.alternate) : '{}') + ' finally { __nbr.exit(); } }';
      }
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name !== 'program' && n.init &&
          /^(Arrow)?FunctionExpression$/.test(n.init.type) && risky(n.init.body)) {
        changed = true;
        return n.id.name + ' = __nbr.aggregate(' + JSON.stringify(n.id.name) + ', ' + t(n.init) + ')';
      }
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && CALLBACKS.test(n.callee.property.name)) {
        n.arguments.forEach(function (a) {
          if (!/Function/.test(a.type)) return;
          some(a.body, function (x) {
            if (x.type !== 'CallExpression' || x.callee.type !== 'Identifier' || !OPS.test(x.callee.name)) return false;
            warnings.push('line ' + x.loc.start.line + ': ' + x.callee.name + '() inside .' + n.callee.property.name +
              '() runs once per element and aligns by position; wrap each element in align(key, ...)');
            return true;
          });
        });
      }
      return text;
    };
    var code = out(ast);
    return { code: changed ? 'var __nbr = require(\'nbrjs\');\n' + code : code, changed: changed, warnings: warnings };
  };
})(typeof exports === 'undefined' ? (this.nbrjsAlign = {}) : exports);
