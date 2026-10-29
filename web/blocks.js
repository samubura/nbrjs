// Block editor for NbrJS: Blockly blocks for the aggregate operators, the standard library and
// your own functions, a generator that writes program.js in the site's style, and a playground
// that reruns it on every change. Browser only.
(function () {
  var gen = javascript.javascriptGenerator, Order = javascript.Order;
  var LIB = 'hopsTo distanceTo broadcast collectSum networkMax networkMin isLeader neighbourCount rounds countdown minId';
  gen.addReservedWords('program,xc,retsend,nbr,rep,share,branch,align,aggregate,id,sense,nbrSense,Math,Infinity,' + LIB.split(' ').join(','));

  var AGG = 120, FIELD = 200, SENSE = 40, LIBC = 160, FN = 290, VARS = 330;
  var lambda = function (type, head, param, tip) {
    return {
      type: type, colour: AGG, output: null, inputsInline: false, tooltip: tip,
      message0: head + ' %1', args0: [{ type: 'input_value', name: 'INIT' }],
      message1: '(%1) ⇒ %2', args1: [{ type: 'field_variable', name: 'VAR', variable: param }, { type: 'input_value', name: 'BODY' }]
    };
  };
  Blockly.common.defineBlocksWithJsonArray([
    { type: 'nbr_program', colour: AGG, message0: 'program %1', args0: [{ type: 'input_value', name: 'VALUE' }],
      tooltip: 'The value every device computes, every round' },
    lambda('nbr_rep', 'rep from', 'c', 'State across rounds: starts from the first value, then the function of the previous one'),
    lambda('nbr_share', 'share from', 'd', 'Shares a value with the neighbours: the function gets the field of their values'),
    lambda('nbr_xc', 'xc from', 'n', 'Exchange: the function gets what each neighbour sent me and returns what to send to each'),
    { type: 'nbr_retsend', colour: AGG, output: null, inputsInline: false, tooltip: 'Inside xc: return one value, send another',
      message0: 'retsend return %1', args0: [{ type: 'input_value', name: 'RET' }],
      message1: 'send %1', args1: [{ type: 'input_value', name: 'SEND' }] },
    { type: 'nbr_nbr', colour: AGG, output: null, message0: 'nbr %1', args0: [{ type: 'input_value', name: 'V' }],
      tooltip: 'The field of the neighbours\' values' },
    { type: 'nbr_branch', colour: AGG, output: null, inputsInline: false,
      tooltip: 'Splits the network: each side only talks to devices on the same side',
      message0: 'branch if %1', args0: [{ type: 'input_value', name: 'COND' }],
      message1: 'then %1', args1: [{ type: 'input_value', name: 'THEN' }],
      message2: 'else %1', args2: [{ type: 'input_value', name: 'ELSE' }] },
    { type: 'nbr_align', colour: AGG, output: null, inputsInline: false,
      tooltip: 'Runs the body only with neighbours that use the same key',
      message0: 'align on key %1', args0: [{ type: 'input_value', name: 'KEY' }],
      message1: '⇒ %1', args1: [{ type: 'input_value', name: 'BODY' }] },
    { type: 'nbr_id', colour: SENSE, output: null, message0: 'id()', tooltip: 'This device\'s id' },
    { type: 'nbr_sense', colour: SENSE, output: null, message0: 'sense %1', args0: [{ type: 'field_input', name: 'NAME', text: 'source' }],
      tooltip: 'A sensor of this device: source, obstacle, x, y, or one from config.js' },
    { type: 'nbr_nbrsense', colour: SENSE, output: null, message0: 'nbrSense %1', args0: [{ type: 'field_input', name: 'NAME', text: 'range' }],
      tooltip: 'A field measured per neighbour: range is the distance to each one' },
    { type: 'nbr_reduce', colour: FIELD, output: null, inputsInline: true, message0: '%1 of %2', tooltip: 'Over the neighbours, self excluded',
      args0: [{ type: 'field_dropdown', name: 'OP', options: [['min', 'min'], ['max', 'max'], ['sum', 'sum']] }, { type: 'input_value', name: 'F' }] },
    { type: 'nbr_fold', colour: FIELD, output: null, inputsInline: false,
      tooltip: 'Combines the neighbours\' values one by one (self excluded), starting from the initial value',
      message0: 'reduce %1', args0: [{ type: 'input_value', name: 'F' }],
      message1: 'from %1', args1: [{ type: 'input_value', name: 'INIT' }],
      message2: '(%1, %2) ⇒ %3', args2: [{ type: 'field_variable', name: 'ACC', variable: 'acc' },
        { type: 'field_variable', name: 'V', variable: 'v' }, { type: 'input_value', name: 'BODY' }] },
    { type: 'nbr_self', colour: FIELD, output: null, message0: 'self of %1', args0: [{ type: 'input_value', name: 'F' }],
      tooltip: 'This device\'s own entry in the field' },
    { type: 'nbr_map', colour: FIELD, output: null, inputsInline: false, tooltip: 'Applies the function to every value of the field',
      message0: 'map %1', args0: [{ type: 'input_value', name: 'F' }],
      message1: '(%1) ⇒ %2', args1: [{ type: 'field_variable', name: 'VAR', variable: 'x' }, { type: 'input_value', name: 'BODY' }] },
    { type: 'nbr_zip', colour: FIELD, output: null, inputsInline: false, tooltip: 'Combines two fields neighbour by neighbour',
      message0: 'zip %1', args0: [{ type: 'input_value', name: 'A' }],
      message1: 'with %1', args1: [{ type: 'input_value', name: 'B' }],
      message2: '(%1, %2) ⇒ %3', args2: [{ type: 'field_variable', name: 'VA', variable: 'a' },
        { type: 'field_variable', name: 'VB', variable: 'b' }, { type: 'input_value', name: 'BODY' }] },
    { type: 'nbr_do', colour: FN, output: null, tooltip: 'Several steps, then a result: a function body with local variables',
      message0: 'do %1', args0: [{ type: 'input_statement', name: 'STEPS' }],
      message1: 'return %1', args1: [{ type: 'input_value', name: 'RET' }] },
    { type: 'nbr_local', colour: VARS, previousStatement: null, nextStatement: null, tooltip: 'A local variable of this function',
      message0: 'var %1 = %2', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x' }, { type: 'input_value', name: 'VALUE' }] },
    { type: 'nbr_minmax', colour: 230, output: null, inputsInline: true, message0: 'the %1 of %2 and %3', tooltip: 'Math.min / Math.max',
      args0: [{ type: 'field_dropdown', name: 'OP', options: [['smaller', 'min'], ['larger', 'max']] },
        { type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }] }
  ]);

  // The standard library (src/lib.js): [function, label with one {INPUT} per argument, arguments
  // in call order (? = optional, left out when empty), tooltip].
  var LIBS = [
    ['hopsTo', 'hops to source {SOURCE}', 'SOURCE', 'Hops to the nearest source; ∞ where none is reachable'],
    ['distanceTo', 'distance to source {SOURCE} metric {METRIC}', 'SOURCE METRIC?',
      'Distance to the nearest source along the network. Metric (optional): the length of each link, default nbrSense range'],
    ['broadcast', 'value {VALUE} from nearest source {SOURCE} metric {METRIC}', 'SOURCE VALUE METRIC?',
      'The value of the nearest source, everywhere. Metric is optional'],
    ['collectSum', 'sum {VALUE} toward source along {DISTANCE}', 'DISTANCE VALUE',
      'Adds the values up toward the source, along a distance such as hops to source: the source gets the total'],
    ['networkMax', 'network max of {V}', 'V', 'The largest value ever seen in the whole network'],
    ['networkMin', 'network min of {V}', 'V', 'The smallest value ever seen in the whole network'],
    ['isLeader', 'is leader within radius {RADIUS} metric {METRIC}', 'RADIUS METRIC?',
      'True on spread-out leaders, most about radius apart and never two neighbours. Metric is optional'],
    ['neighbourCount', 'neighbour count', '', 'How many neighbours this device hears'],
    ['rounds', 'rounds', '', 'Rounds run so far: 1, 2, 3, ...'],
    ['countdown', 'countdown from {FROM}', 'FROM', 'from, from - 1, ..., 0, then stays at 0'],
    ['minId', 'id of the smallest in {FIELD} below {BELOW}', 'FIELD BELOW?',
      'The neighbour with the smallest value, or null if none is below (optional, default ∞)']
  ];
  Blockly.common.defineBlocksWithJsonArray(LIBS.map(function (l) {
    var args = [];
    var msg = l[1].replace(/\{(\w+)\}/g, function (m, n) { args.push({ type: 'input_value', name: n }); return '%' + args.length; });
    return { type: 'lib_' + l[0], colour: LIBC, output: null, inputsInline: true, message0: msg, args0: args, tooltip: l[3] };
  }));

  // Generator: expressions, arrow functions and var (Espruino-safe).
  var f = gen.forBlock;
  var val = function (b, name, order) { return gen.valueToCode(b, name, order === undefined ? Order.NONE : order) || 'null'; };
  var param = function (b, name) { return gen.getVariableName(b.getFieldValue(name)); };
  var call = function (code) { return [code, Order.FUNCTION_CALL]; };
  var steps = function (code, ret) { return '{\n' + code + gen.prefixLines('return ' + ret + ';', gen.INDENT) + '\n}'; };
  // A function body: an expression, or { var ...; return ...; } when it is a 'do' block.
  var body = function (b, name) {
    var c = b.getInputTargetBlock(name);
    return c && c.type === 'nbr_do' ? steps(gen.statementToCode(c, 'STEPS'), val(c, 'RET')) : val(b, name, Order.ASSIGNMENT);
  };
  var arrow = function (params, b, name) { return '(' + params + ') => ' + body(b, name); };
  f.nbr_program = function (b) { return 'var program = () => ' + body(b, 'VALUE') + ';\n'; };
  ['rep', 'share', 'xc'].forEach(function (op) {
    f['nbr_' + op] = function (b) { return call(op + '(' + val(b, 'INIT') + ', ' + arrow(param(b, 'VAR'), b, 'BODY') + ')'); };
  });
  f.nbr_retsend = function (b) { return call('retsend(' + val(b, 'RET') + ', ' + val(b, 'SEND') + ')'); };
  f.nbr_nbr = function (b) { return call('nbr(' + val(b, 'V') + ')'); };
  f.nbr_branch = function (b) {
    return call('branch(' + val(b, 'COND') + ', ' + arrow('', b, 'THEN') + ', ' + arrow('', b, 'ELSE') + ')');
  };
  f.nbr_align = function (b) { return call('align(' + val(b, 'KEY') + ', ' + arrow('', b, 'BODY') + ')'); };
  f.nbr_id = function () { return call('id()'); };
  f.nbr_sense = function (b) { return call('sense(' + gen.quote_(b.getFieldValue('NAME')) + ')'); };
  f.nbr_nbrsense = function (b) { return call('nbrSense(' + gen.quote_(b.getFieldValue('NAME')) + ')'); };
  f.nbr_reduce = function (b) { return call(val(b, 'F', Order.MEMBER) + '.' + b.getFieldValue('OP') + '()'); };
  f.nbr_fold = function (b) {
    return call(val(b, 'F', Order.MEMBER) + '.reduce(' + arrow(param(b, 'ACC') + ', ' + param(b, 'V'), b, 'BODY') + ', ' + val(b, 'INIT') + ')');
  };
  f.nbr_self = function (b) { return [val(b, 'F', Order.MEMBER) + '.self', Order.MEMBER]; };
  f.nbr_map = function (b) { return call(val(b, 'F', Order.MEMBER) + '.map(' + arrow(param(b, 'VAR'), b, 'BODY') + ')'); };
  f.nbr_zip = function (b) {
    return call(val(b, 'A', Order.MEMBER) + '.zip(' + val(b, 'B') + ', ' + arrow(param(b, 'VA') + ', ' + param(b, 'VB'), b, 'BODY') + ')');
  };
  // A 'do' block anywhere else than a function body: a function called on the spot.
  f.nbr_do = function (b) { return call('(() => ' + steps(gen.statementToCode(b, 'STEPS'), val(b, 'RET')) + ')()'); };
  f.nbr_local = function (b) { return 'var ' + param(b, 'VAR') + ' = ' + val(b, 'VALUE', Order.ASSIGNMENT) + ';\n'; };
  f.nbr_minmax = function (b) { return call('Math.' + b.getFieldValue('OP') + '(' + val(b, 'A') + ', ' + val(b, 'B') + ')'); };
  LIBS.forEach(function (l) {
    f['lib_' + l[0]] = function (b) {
      var args = l[2].split(' ').filter(Boolean).map(function (n) {
        return n.slice(-1) === '?' ? gen.valueToCode(b, n.slice(0, -1), Order.NONE) : val(b, n);
      }).filter(Boolean);
      return call(l[0] + '(' + args.join(', ') + ')');
    };
  });
  Blockly.Msg.PROCEDURES_DEFRETURN_COMMENT = ''; // no 'Describe this function...' comment
  // Your functions: Blockly's procedure blocks, wrapped in aggregate() so that calls of different
  // functions never mix their messages. Calls use Blockly's own generator: name(args).
  f.procedures_defreturn = function (b) {
    var name = gen.getProcedureName(b.getFieldValue('NAME'));
    var params = b.getVarModels().map(function (m) { return gen.getVariableName(m.getId()); }).join(', ');
    var code = b.getInput('STACK') ? gen.statementToCode(b, 'STACK') : '';
    return 'var ' + name + ' = aggregate(' + gen.quote_(name) + ', (' + params + ') => ' +
      (code ? steps(code, val(b, 'RETURN')) : body(b, 'RETURN')) + ');\n';
  };

  // Starter workspaces, as Blockly JSON. B(type, fields, inputs) keeps them readable.
  var B = function (type, fields, inputs) {
    var b = { type: type, fields: fields || {}, inputs: {} };
    for (var k in inputs) b.inputs[k] = { block: inputs[k] };
    return b;
  };
  var num = function (n) { return B('math_number', { NUM: n }); };
  var get = function (n) { return B('variables_get', { VAR: { name: n } }); };
  var math = function (op, a, c) { return B('math_arithmetic', { OP: op }, { A: a, B: c }); };
  var add = function (a, c) { return math('ADD', a, c); };
  var sense = function (n) { return B('nbr_sense', { NAME: n }); };
  var lib = function (fn, inputs) { return B('lib_' + fn, {}, inputs); };
  var inf = B('math_constant', { CONSTANT: 'INFINITY' });
  var local = function (n, v) { return B('nbr_local', { VAR: { name: n } }, { VALUE: v }); };
  // do: var a = ...; var b = ...; return ret
  var doing = function (locals, ret) {
    for (var i = 0; i < locals.length - 1; i++) locals[i].next = { block: locals[i + 1] };
    return B('nbr_do', {}, { STEPS: locals[0], RET: ret });
  };
  var def = function (name, params, comment, ret) {
    return Object.assign(B('procedures_defreturn', { NAME: name }, { RETURN: ret }), { icons: { comment: { text: comment } } },
      { extraState: { params: params.map(function (p) { return { name: p }; }) } });
  };
  var use = function (name, params, args) {
    var inputs = {};
    args.forEach(function (a, i) { inputs['ARG' + i] = a; });
    return Object.assign(B('procedures_callreturn', {}, inputs), { extraState: { name: name, params: params } });
  };
  var gradient = function (dist) {
    return B('nbr_share', { VAR: { name: 'd' } }, { INIT: inf, BODY: B('logic_ternary', {}, { IF: sense('source'), THEN: num(0), ELSE: dist }) });
  };
  var config = function (s) {
    return "return {\n  target: 'sim',\n  period: 200,\n  nodes: 50, layout: 'random', range: 1.5,\n  sources: [" +
      (s.sources === undefined ? '0' : s.sources) + '], obstacles: [' + (s.obstacles || '') + ']\n};';
  };
  var STARTERS = [
    { name: 'Gradient (hops)', value: gradient(add(B('nbr_reduce', { OP: 'min' }, { F: get('d') }), num(1))) },
    { name: 'Round counter', value: B('nbr_rep', { VAR: { name: 'c' } }, { INIT: num(0), BODY: add(get('c'), num(1)) }) },
    { name: 'Neighbour count', value: B('nbr_reduce', { OP: 'sum' }, { F: B('nbr_nbr', {}, { V: num(1) }) }) },
    { name: 'Obstacles (branch)', obstacles: '4, 12, 20, 28, 36, 44', value: B('nbr_branch', {}, {
      COND: sense('obstacle'), THEN: B('logic_null'), ELSE: gradient(
        B('nbr_reduce', { OP: 'min' }, { F: B('nbr_zip', { VA: { name: 'a' }, VB: { name: 'b' } },
          { A: get('d'), B: B('nbr_nbrsense', { NAME: 'range' }), BODY: add(get('a'), get('b')) }) })) }) },
    { name: 'Link age (xc)', value: B('nbr_reduce', { OP: 'min' }, { F: B('nbr_xc', { VAR: { name: 'n' } }, { INIT: num(0),
      BODY: B('nbr_map', { VAR: { name: 'x' } }, { F: get('n'), BODY: add(get('x'), num(1)) }) }) }) },
    // Two functions, one calling the other: rings of `width` hops around the source.
    { name: 'Rings (your own functions)', defs: [
      def('hops', ['source'], 'Hops to the nearest source', B('nbr_share', { VAR: { name: 'd' } }, { INIT: inf, BODY: B('logic_ternary', {},
        { IF: get('source'), THEN: num(0), ELSE: add(B('nbr_reduce', { OP: 'min' }, { F: get('d') }), num(1)) }) })),
      def('ring', ['source', 'width'], 'Which ring of width hops around the source', doing([local('h', use('hops', ['source'], [get('source')]))],
        B('math_round', { OP: 'ROUNDDOWN' }, { NUM: math('DIVIDE', get('h'), get('width')) })))],
      value: use('ring', ['source', 'width'], [sense('source'), num(2)]) },
    { name: 'Leaders and their areas', sources: '', value: doing([local('leader', lib('isLeader', { RADIUS: num(3) }))],
      lib('broadcast', { SOURCE: get('leader'), VALUE: B('nbr_id') })) },
    { name: 'Count devices at the source', value: doing([local('source', sense('source')), local('hops', lib('hopsTo', { SOURCE: get('source') }))],
      lib('collectSum', { DISTANCE: get('hops'), VALUE: num(1) })) },
    { name: 'Empty' }
  ];

  // Variables (lambda parameters, function parameters, locals) and functions have their own flyouts.
  var shadow = function (n) { return { shadow: { type: 'math_number', fields: { NUM: n } } }; };
  var block = function (type, inputs, fields) { return { kind: 'block', type: type, inputs: inputs, fields: fields }; };
  var source = { block: { type: 'nbr_sense', fields: { NAME: 'source' } } };
  var toolbox = { kind: 'categoryToolbox', contents: [
    { kind: 'category', name: 'Aggregate', colour: AGG, contents: [
      block('nbr_program'), block('nbr_rep', { INIT: shadow(0) }), block('nbr_share', { INIT: shadow(0) }),
      block('nbr_nbr', { V: shadow(1) }), block('nbr_branch'), block('nbr_align'),
      block('nbr_xc', { INIT: shadow(0) }), block('nbr_retsend')] },
    { kind: 'category', name: 'Fields', colour: FIELD, contents: [
      block('nbr_reduce'), block('nbr_fold'), block('nbr_self'), block('nbr_map'), block('nbr_zip')] },
    { kind: 'category', name: 'Sensors', colour: SENSE, contents: [block('nbr_sense'), block('nbr_nbrsense'), block('nbr_id')] },
    { kind: 'category', name: 'Library', colour: LIBC, contents: [
      block('lib_hopsTo', { SOURCE: source }), block('lib_distanceTo', { SOURCE: source }),
      block('lib_broadcast', { SOURCE: source, VALUE: { block: { type: 'nbr_id' } } }),
      block('lib_collectSum', { DISTANCE: { block: { type: 'lib_hopsTo', inputs: { SOURCE: source } } }, VALUE: shadow(1) }),
      block('lib_networkMax'), block('lib_networkMin'), block('lib_isLeader', { RADIUS: shadow(3) }),
      block('lib_neighbourCount'), block('lib_rounds'), block('lib_countdown', { FROM: shadow(10) }), block('lib_minId')] },
    { kind: 'category', name: 'Functions', colour: FN, custom: 'FUNCTIONS' },
    { kind: 'category', name: 'Variables', colour: VARS, custom: 'VARS' },
    { kind: 'category', name: 'Math', colour: 230, contents: [
      block('math_number'), block('math_constant', null, { CONSTANT: 'INFINITY' }), block('math_arithmetic'),
      block('math_single'), block('math_round'), block('nbr_minmax'), block('math_modulo'), block('math_random_float')] },
    { kind: 'category', name: 'Logic', colour: 210, contents: [
      block('logic_compare'), block('logic_operation'), block('logic_negate'), block('logic_boolean'),
      block('logic_ternary'), block('logic_null')] }
  ] };

  // Colours from the site's CSS variables, read once (light or dark theme).
  var css = getComputedStyle(document.documentElement), v = function (n) { return css.getPropertyValue(n).trim(); };
  var theme = Blockly.Theme.defineTheme('nbrjs', { base: Blockly.Themes.Classic, componentStyles: {
    workspaceBackgroundColour: v('--panel'), toolboxBackgroundColour: v('--code-bg'), toolboxForegroundColour: v('--fg'),
    flyoutBackgroundColour: v('--code-bg'), flyoutForegroundColour: v('--fg'), scrollbarColour: v('--line')
  } });
  var ws = Blockly.inject('ws', { toolbox: toolbox, theme: theme, trashcan: true, zoom: { controls: true, startScale: 0.9 } });
  ws.registerToolboxCategoryCallback('VARS', function (w) {
    return [{ kind: 'button', text: 'New variable', callbackKey: 'newVar' }, block('nbr_local')].concat(
      w.getVariableMap().getAllVariables().map(function (x) { return block('variables_get', null, { VAR: { name: x.getName() } }); }));
  });
  ws.registerButtonCallback('newVar', function (btn) { Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace()); });
  // The gear on a function block adds parameters; a call block appears here for each function.
  ws.registerToolboxCategoryCallback('FUNCTIONS', function (w) {
    return [block('procedures_defreturn', null, { NAME: 'my function' }), block('nbr_do')].concat(
      Blockly.Procedures.allProcedures(w)[1].map(function (p) {
        return { kind: 'block', type: 'procedures_callreturn', extraState: { name: p[0], params: p[1] } };
      }));
  });

  // Functions first (Espruino has no hoisting), then program.
  var generate = function () {
    gen.init(ws);
    return ws.getBlocksByType('procedures_defreturn', true).concat(ws.getBlocksByType('nbr_program', true).slice(0, 1))
      .map(function (b) { return gen.blockToCode(b); }).filter(Boolean).join('\n');
  };

  var pgEl = document.getElementById('pg');
  var pg = Playground.mount(pgEl, { tabs: true, height: 340, program: '', config: config({}) });
  var progEl = pgEl.querySelector('[data-file=program]');
  progEl.readOnly = true;
  ws.addChangeListener(function (e) {
    if (e.isUiEvent) return;
    var code = generate();
    if (code === pg.program()) return;
    progEl.value = code;
    progEl.dispatchEvent(new Event('input'));
  });

  var load = function (s) {
    ws.clear();
    var tops = (s.defs || []).concat([B('nbr_program', {}, s.value ? { VALUE: s.value } : {})]);
    tops.forEach(function (b, i) { b.x = 0; b.y = i; });
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: tops } }, ws);
    ws.cleanUp(); // stacks the top blocks in this order
    pg.show(generate(), config(s));
  };
  var sel = document.getElementById('starter');
  STARTERS.forEach(function (s, i) { sel.add(new Option(s.name, i)); });
  sel.onchange = function () { load(STARTERS[sel.value]); };
  load(STARTERS[0]);
})();
