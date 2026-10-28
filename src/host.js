// 'host' target: a board tethered to a PC that plays its neighbours (web/puck.html).
// The PC drives the rounds: it sends the inbox over the console and reads back one line.
var A = require('nbrjs');

// Usually reached through require('nbrjs').start(program, {target: 'host', ...}).
// opts: {id ('puck'), sensors: (id) => ({...}), onResult: (value, id) => ...}
exports.start = function (program, opts) {
  opts = opts || {};
  var id = opts.id || 'puck', dev = A.device(id);
  // The PC sends print(nbrjsRound('{"inbox":{...},"nbr":{...}}')) and reads
  // 'NBR{"id":..,"v":value,"m":message,"s":sensor readings}'.
  var round = function (json) {
    var q = A.decode(json || '{}');
    var s = opts.sensors ? opts.sensors(id) : {};
    var r = dev.round(program, q.inbox || {}, s, q.nbr || {});
    if (opts.onResult) opts.onResult(r.value, id);
    return 'NBR' + A.encode({ id: id, v: r.value, m: r.message, s: s });
  };
  global.nbrjsRound = round;
  return { id: id, round: round, stop: function () { delete global.nbrjsRound; } };
};

A.targets.host = exports;
