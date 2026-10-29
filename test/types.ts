// The type declarations (types/) against a program written as on the site: npm run test:types.
/// <reference path="../types/globals.d.ts" />
import { device, encode } from 'nbrjs';
import { collect } from 'nbrjs/lib';

const hops = (src: boolean) => share(Infinity, (d) => src ? 0 : d.min() + 1);
const area = broadcast(isLeader(3), id());
const age = xc(0, (n) => n.map((x) => x + 1)).min();
const pair = share({ dist: Infinity, value: 'a' }, (n) => n.reduce((b, p) => p.dist < b.dist ? p : b, n.self));
const total = collectSum(hopsTo(sense<boolean>('source'), 20), 1) + collect(distanceTo(true, 1, 50), 2, Math.max, -Infinity);
const away = branch(sense('obstacle'), () => null, () => distanceTo(sense('source')));
const f = aggregate('hops', hops);
start(() => [f(true), area, age, pair.value, total, away], { target: 'ble', period: 1000, group: 'swarm', chunks: 4 });
encode(device(1, true).round(() => nbr(1).sum()).message);
// @ts-expect-error: hops gives a number
const wrong: string = hops(true);
