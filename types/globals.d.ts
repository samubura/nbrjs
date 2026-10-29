// After require('nbrjs').globals() and require('nbrjs/lib').globals(): the operators as globals.
// In a JS file: /// <reference types="nbrjs/types/globals" />
type Core = typeof import('./index');
type Lib = typeof import('./lib');
declare global {
  const xc: Core['xc'], retsend: Core['retsend'], share: Core['share'], nbr: Core['nbr'], rep: Core['rep'];
  const branch: Core['branch'], align: Core['align'], aggregate: Core['aggregate'];
  const id: Core['id'], sense: Core['sense'], nbrSense: Core['nbrSense'], start: Core['start'];
  const hopsTo: Lib['hopsTo'], distanceTo: Lib['distanceTo'], broadcast: Lib['broadcast'], collectSum: Lib['collectSum'];
  const networkMax: Lib['networkMax'], networkMin: Lib['networkMin'], isLeader: Lib['isLeader'];
  const neighbourCount: Lib['neighbourCount'], rounds: Lib['rounds'], countdown: Lib['countdown'], minId: Lib['minId'];
}
export {};
