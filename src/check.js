// Alignment check, run on the host (playground, bundler), never on devices. Native control flow
// does not align: aggregate code under if / ?: / && / || needs branch(), and in loops or .map()
// callbacks it aligns by position. This finds those spots and warns; it never rewrites. Needs acorn.
(function (exports) {
  var AGG = ['xc', 'nbr', 'rep', 'share', 'branch', 'align', 'aggregate', 'hopsTo', 'distanceTo', 'broadcast',
    'collectSum', 'networkMax', 'networkMin', 'isLeader', 'neighbourCount', 'rounds', 'countdown'];
  var CALLBACKS = /^(map|forEach|filter|some|every|find|findIndex|sort|reduce)$/;
  var LOOPS = /^(For|ForIn|ForOf|While|DoWhile)Statement$/;

  var children = function (n) {
    var out = [];
    for (var k in n) {
      var v = n[k];
      if (k === 'type' || k === 'loc' || !v || typeof v !== 'object') continue;
      (Array.isArray(v) ? v : [v]).forEach(function (c) { if (c && typeof c.type === 'string') out.push(c); });
    }
    return out;
  };
  var walk = function (n, f) { f(n); children(n).forEach(function (c) { walk(c, f); }); };
  var find = function (n, test) {
    var hit = null;
    if (n) walk(n, function (x) { if (!hit && test(x)) hit = x; });
    return hit;
  };
  var callee = function (x) {
    if (x.type !== 'CallExpression') return null;
    return x.callee.type === 'Identifier' ? x.callee.name : x.callee.type === 'MemberExpression' && x.callee.property.name;
  };

  // Returns ['line N: ...'], empty when nothing looks misaligned.
  exports.check = function (src, acorn) {
    var ast = acorn.parse(src, { ecmaVersion: 2020, locations: true, allowReturnOutsideFunction: true });
    // Aggregate functions: the operators, the library, and the program's own functions that call them.
    // Wrapped ones (aggregate('g', ...), and the library) align by name; the others by position.
    var agg = {}, wrapped = {}, defs = [], picks = [];
    AGG.forEach(function (k) { agg[k] = wrapped[k] = true; });
    walk(ast, function (n) {
      var init = n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init;
      if (init && /Function/.test(init.type)) defs.push([n.id.name, init]);
      if (init && callee(init) === 'aggregate') agg[n.id.name] = wrapped[n.id.name] = true;
      if (init && /^(Conditional|Logical)Expression$/.test(init.type)) picks.push([n.id.name, init]);
      if (n.type === 'FunctionDeclaration') defs.push([n.id.name, n]);
    });
    var calls = function (n) { return find(n, function (x) { return agg[callee(x)]; }); };
    for (var grew = true; grew;) {
      grew = false;
      defs.forEach(function (d) { if (!agg[d[0]] && calls(d[1].body)) grew = agg[d[0]] = true; });
    }

    // var f = c ? g : h, with g or h an unwrapped aggregate function: calling f mixes them.
    var picked = {};
    picks.forEach(function (p) {
      var names = [p[1].consequent, p[1].alternate, p[1].left, p[1].right].filter(function (a) {
        return a && a.type === 'Identifier' && agg[a.name] && !wrapped[a.name];
      }).map(function (a) { return a.name; });
      if (names.length) picked[p[0]] = names;
    });

    var warnings = [];
    var warn = function (n, what, fix) {
      var c = calls(n);
      if (c) warnings.push('line ' + c.loc.start.line + ': ' + callee(c) + '() ' + what + '; ' + fix);
    };
    var BRANCH = 'use branch(cond, () => ..., () => ...)';
    walk(ast, function (n) {
      if (n.type === 'ConditionalExpression') warn({ a: n.consequent, b: n.alternate, type: '' }, 'inside ?: is not aligned', BRANCH);
      if (n.type === 'LogicalExpression') warn(n.right, 'after ' + n.operator + ' is not aligned', BRANCH);
      if (n.type === 'IfStatement') warn({ a: n.consequent, b: n.alternate, type: '' }, 'inside if is not aligned', BRANCH);
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && picked[n.callee.name]) {
        warnings.push('line ' + n.loc.start.line + ': ' + n.callee.name + '() runs ' + picked[n.callee.name].join(' or ') +
          ' depending on a condition, and they align by position; define them with aggregate(\'name\', ...)');
      }
      if (LOOPS.test(n.type)) warn(n.body, 'in a loop aligns by iteration', 'wrap the body in align(key, () => ...)');
      if (CALLBACKS.test(callee(n)) && n.callee.type === 'MemberExpression') {
        n.arguments.forEach(function (a) {
          if (/Function/.test(a.type)) warn(a.body, 'inside .' + n.callee.property.name + '() aligns by position', 'wrap it in align(key, () => ...)');
        });
      }
    });
    return warnings;
  };
})(typeof exports === 'undefined' ? (this.nbrjsCheck = {}) : exports);
