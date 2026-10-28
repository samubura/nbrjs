// Block editor for NbrJS: Blockly blocks for the aggregate operators, a generator that writes
// program.js in the site's style, and a playground that reruns it on every change. Browser only.
(function () {
  var gen = javascript.javascriptGenerator, Order = javascript.Order;
  gen.addReservedWords('program,xc,retsend,nbr,rep,share,branch,align,id,sense,nbrSense');

  var AGG = 120, FIELD = 200, SENSE = 40;
  var lambda = function (type, name, param, colour) {
    return {
      type: type, colour: colour, output: null, inputsInline: false,
      message0: name + ' da %1', args0: [{ type: 'input_value', name: 'INIT' }],
      message1: '(%1) ⇒ %2', args1: [{ type: 'field_variable', name: 'VAR', variable: param }, { type: 'input_value', name: 'BODY' }]
    };
  };
  Blockly.common.defineBlocksWithJsonArray([
    { type: 'nbr_program', colour: AGG, message0: 'programma %1', args0: [{ type: 'input_value', name: 'VALUE' }],
      tooltip: 'Il valore che ogni nodo calcola a ogni round' },
    lambda('nbr_rep', 'rep', 'c', AGG),
    lambda('nbr_share', 'share', 'd', AGG),
    lambda('nbr_xc', 'xc', 'n', AGG),
    { type: 'nbr_retsend', colour: AGG, output: null, inputsInline: false,
      message0: 'retsend ritorna %1', args0: [{ type: 'input_value', name: 'RET' }],
      message1: 'invia %1', args1: [{ type: 'input_value', name: 'SEND' }] },
    { type: 'nbr_nbr', colour: AGG, output: null, message0: 'nbr %1', args0: [{ type: 'input_value', name: 'V' }] },
    { type: 'nbr_branch', colour: AGG, output: null, inputsInline: false,
      message0: 'branch se %1', args0: [{ type: 'input_value', name: 'COND' }],
      message1: 'allora %1', args1: [{ type: 'input_value', name: 'THEN' }],
      message2: 'altrimenti %1', args2: [{ type: 'input_value', name: 'ELSE' }] },
    { type: 'nbr_id', colour: SENSE, output: null, message0: 'id()' },
    { type: 'nbr_sense', colour: SENSE, output: null, message0: 'sense %1', args0: [{ type: 'field_input', name: 'NAME', text: 'source' }] },
    { type: 'nbr_nbrsense', colour: SENSE, output: null, message0: 'nbrSense %1', args0: [{ type: 'field_input', name: 'NAME', text: 'range' }] },
    { type: 'nbr_reduce', colour: FIELD, output: null, inputsInline: true, message0: '%1 di %2',
      args0: [{ type: 'field_dropdown', name: 'OP', options: [['min', 'min'], ['max', 'max'], ['sum', 'sum']] }, { type: 'input_value', name: 'F' }] },
    { type: 'nbr_self', colour: FIELD, output: null, message0: 'self di %1', args0: [{ type: 'input_value', name: 'F' }] },
    { type: 'nbr_map', colour: FIELD, output: null, inputsInline: false,
      message0: 'map %1', args0: [{ type: 'input_value', name: 'F' }],
      message1: '(%1) ⇒ %2', args1: [{ type: 'field_variable', name: 'VAR', variable: 'x' }, { type: 'input_value', name: 'BODY' }] },
    { type: 'nbr_zip', colour: FIELD, output: null, inputsInline: false,
      message0: 'zip %1', args0: [{ type: 'input_value', name: 'A' }],
      message1: 'con %1', args1: [{ type: 'input_value', name: 'B' }],
      message2: '(%1, %2) ⇒ %3', args2: [{ type: 'field_variable', name: 'VA', variable: 'a' },
        { type: 'field_variable', name: 'VB', variable: 'b' }, { type: 'input_value', name: 'BODY' }] }
  ]);

  // Generator: one expression per block, arrow functions only (Espruino-safe).
  var val = function (b, name, order) { return gen.valueToCode(b, name, order === undefined ? Order.NONE : order) || 'null'; };
  var param = function (b, name) { return gen.getVariableName(b.getFieldValue(name)); };
  var arrow = function (params, b, name) { return '(' + params + ') => ' + val(b, name, Order.ASSIGNMENT); };
  var call = function (code) { return [code, Order.FUNCTION_CALL]; };
  var f = gen.forBlock;
  f.nbr_program = function (b) { return 'var program = () => ' + val(b, 'VALUE', Order.ASSIGNMENT) + ';\n'; };
  ['rep', 'share', 'xc'].forEach(function (op) {
    f['nbr_' + op] = function (b) { return call(op + '(' + val(b, 'INIT') + ', ' + arrow(param(b, 'VAR'), b, 'BODY') + ')'); };
  });
  f.nbr_retsend = function (b) { return call('retsend(' + val(b, 'RET') + ', ' + val(b, 'SEND') + ')'); };
  f.nbr_nbr = function (b) { return call('nbr(' + val(b, 'V') + ')'); };
  f.nbr_branch = function (b) {
    return call('branch(' + val(b, 'COND') + ', ' + arrow('', b, 'THEN') + ', ' + arrow('', b, 'ELSE') + ')');
  };
  f.nbr_id = function () { return call('id()'); };
  f.nbr_sense = function (b) { return call('sense(' + gen.quote_(b.getFieldValue('NAME')) + ')'); };
  f.nbr_nbrsense = function (b) { return call('nbrSense(' + gen.quote_(b.getFieldValue('NAME')) + ')'); };
  f.nbr_reduce = function (b) { return call(val(b, 'F', Order.MEMBER) + '.' + b.getFieldValue('OP') + '()'); };
  f.nbr_self = function (b) { return [val(b, 'F', Order.MEMBER) + '.self', Order.MEMBER]; };
  f.nbr_map = function (b) { return call(val(b, 'F', Order.MEMBER) + '.map(' + arrow(param(b, 'VAR'), b, 'BODY') + ')'); };
  f.nbr_zip = function (b) {
    return call(val(b, 'A', Order.MEMBER) + '.zip(' + val(b, 'B') + ', ' + arrow(param(b, 'VA') + ', ' + param(b, 'VB'), b, 'BODY') + ')');
  };

  // Starter workspaces, as Blockly JSON. B(type, fields, inputs) keeps them readable.
  var B = function (type, fields, inputs) {
    var b = { type: type, fields: fields || {}, inputs: {} };
    for (var k in inputs) b.inputs[k] = { block: inputs[k] };
    return b;
  };
  var num = function (n) { return B('math_number', { NUM: n }); };
  var get = function (n) { return B('variables_get', { VAR: { name: n } }); };
  var add = function (a, c) { return B('math_arithmetic', { OP: 'ADD' }, { A: a, B: c }); };
  var sense = function (n) { return B('nbr_sense', { NAME: n }); };
  var inf = B('math_constant', { CONSTANT: 'INFINITY' });
  var gradient = function (dist) {
    return B('nbr_share', { VAR: { name: 'd' } }, { INIT: inf, BODY: B('logic_ternary', {}, { IF: sense('source'), THEN: num(0), ELSE: dist }) });
  };
  var config = function (obstacles) {
    return "return {\n  target: 'sim',\n  period: 200,\n  nodes: 50, layout: 'random', range: 1.5,\n  sources: [0], obstacles: [" + obstacles + ']\n};';
  };
  var STARTERS = [
    ['Gradiente (salti)', gradient(add(B('nbr_reduce', { OP: 'min' }, { F: get('d') }), num(1)))],
    ['Contatore di round', B('nbr_rep', { VAR: { name: 'c' } }, { INIT: num(0), BODY: add(get('c'), num(1)) })],
    ['Numero di vicini', B('nbr_reduce', { OP: 'sum' }, { F: B('nbr_nbr', {}, { V: num(1) }) })],
    ['Ostacoli (branch)', B('nbr_branch', {}, { COND: sense('obstacle'), THEN: B('logic_null'), ELSE: gradient(
      B('nbr_reduce', { OP: 'min' }, { F: B('nbr_zip', { VA: { name: 'a' }, VB: { name: 'b' } },
        { A: get('d'), B: B('nbr_nbrsense', { NAME: 'range' }), BODY: add(get('a'), get('b')) }) })) }), '4, 12, 20, 28, 36, 44'],
    ['Età dei link (xc)', B('nbr_reduce', { OP: 'min' }, { F: B('nbr_xc', { VAR: { name: 'n' } }, { INIT: num(0),
      BODY: B('nbr_map', { VAR: { name: 'x' } }, { F: get('n'), BODY: add(get('x'), num(1)) }) }) })],
    ['Vuoto', null]
  ];

  // Lambda parameters are Blockly variables: this category lists one block per parameter.
  var shadow = function (n) { return { shadow: { type: 'math_number', fields: { NUM: n } } }; };
  var toolbox = { kind: 'categoryToolbox', contents: [
    { kind: 'category', name: 'Aggregati', colour: AGG, contents: [
      { kind: 'block', type: 'nbr_program' },
      { kind: 'block', type: 'nbr_rep', inputs: { INIT: shadow(0) } },
      { kind: 'block', type: 'nbr_share', inputs: { INIT: shadow(0) } },
      { kind: 'block', type: 'nbr_nbr', inputs: { V: shadow(1) } },
      { kind: 'block', type: 'nbr_branch' },
      { kind: 'block', type: 'nbr_xc', inputs: { INIT: shadow(0) } },
      { kind: 'block', type: 'nbr_retsend' }] },
    { kind: 'category', name: 'Sensori', colour: SENSE, contents: [
      { kind: 'block', type: 'nbr_sense' }, { kind: 'block', type: 'nbr_nbrsense' }, { kind: 'block', type: 'nbr_id' }] },
    { kind: 'category', name: 'Campi', colour: FIELD, contents: [
      { kind: 'block', type: 'nbr_reduce' }, { kind: 'block', type: 'nbr_self' },
      { kind: 'block', type: 'nbr_map' }, { kind: 'block', type: 'nbr_zip' }] },
    { kind: 'category', name: 'Parametri', colour: 330, custom: 'PARAMS' },
    { kind: 'category', name: 'Valori', colour: 230, contents: [
      { kind: 'block', type: 'math_number' }, { kind: 'block', type: 'math_constant', fields: { CONSTANT: 'INFINITY' } },
      { kind: 'block', type: 'math_arithmetic' }, { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'logic_ternary' }, { kind: 'block', type: 'logic_boolean' },
      { kind: 'block', type: 'logic_operation' }, { kind: 'block', type: 'logic_negate' }, { kind: 'block', type: 'logic_null' }] }
  ] };

  // Colours from the site's CSS variables, read once (light or dark theme).
  var css = getComputedStyle(document.documentElement), v = function (n) { return css.getPropertyValue(n).trim(); };
  var theme = Blockly.Theme.defineTheme('nbrjs', { base: Blockly.Themes.Classic, componentStyles: {
    workspaceBackgroundColour: v('--panel'), toolboxBackgroundColour: v('--code-bg'), toolboxForegroundColour: v('--fg'),
    flyoutBackgroundColour: v('--code-bg'), flyoutForegroundColour: v('--fg'), scrollbarColour: v('--line')
  } });
  var ws = Blockly.inject('ws', { toolbox: toolbox, theme: theme, trashcan: true, zoom: { controls: true, startScale: 0.9 } });
  ws.registerToolboxCategoryCallback('PARAMS', function (w) {
    return [{ kind: 'button', text: 'Nuovo parametro', callbackKey: 'newParam' }].concat(
      w.getVariableMap().getAllVariables().map(function (x) { return { kind: 'block', type: 'variables_get', fields: { VAR: { name: x.getName() } } }; }));
  });
  ws.registerButtonCallback('newParam', function (btn) { Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace()); });

  var generate = function () {
    var top = ws.getBlocksByType('nbr_program', false)[0];
    if (!top) return '';
    gen.init(ws);
    return gen.blockToCode(top);
  };

  var pgEl = document.getElementById('pg');
  var pg = Playground.mount(pgEl, { tabs: true, height: 340, program: '', config: config('') });
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
    Blockly.serialization.workspaces.load({ blocks: { blocks: [
      Object.assign(B('nbr_program', {}, s[1] ? { VALUE: s[1] } : {}), { x: 20, y: 20 })] } }, ws);
    pg.show(generate(), config(s[2] || ''));
  };
  var sel = document.getElementById('starter');
  STARTERS.forEach(function (s, i) { sel.add(new Option(s[0], i)); });
  sel.onchange = function () { load(STARTERS[sel.value]); };
  load(STARTERS[0]);
})();
