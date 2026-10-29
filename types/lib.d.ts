import { Field } from './index';

type Metric = Field<number> | number;
/** Hops to the nearest source; Infinity where none is reachable or farther than max (which stops the climb when a source goes away). */
export function hopsTo(source: unknown, max?: number): number;
/** Distance to the nearest source along the network (metric: nbrSense('range') by default); Infinity beyond max. */
export function distanceTo(source: unknown, metric?: Metric, max?: number): number;
/** The value of the nearest source, everywhere; undefined where none is reachable. */
export function broadcast<T>(source: unknown, value: T, metric?: Metric): T;
/** Accumulates value toward the source along distance (e.g. hopsTo(source)); none must leave a value unchanged. */
export function collect<T>(distance: number, value: T, accumulate: (a: T, b: T) => T, none: T): T;
/** Sums value toward the source along distance: the source gets the total. */
export function collectSum(distance: number, value: number): number;
export function networkMax(v: number): number;
export function networkMin(v: number): number;
/** Spread-out leaders: never two neighbouring ones, most about radius apart. */
export function isLeader(radius: number, metric?: Metric): boolean;
export function neighbourCount(): number;
export function rounds(): number;
/** from, from - 1, ..., 0, then stays at 0. */
export function countdown(from: number): number;
/** Id of the neighbour with the smallest value, or null if none is below `below`. */
export function minId(field: Field<number>, below?: number): string | null;
export function globals(): typeof import('./lib');
