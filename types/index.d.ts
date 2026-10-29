// Types for editors and TypeScript users; the library itself is plain JavaScript.

/** A value per aligned neighbour (XC nvalue), plus the device's own `self`. */
export interface Field<T> {
  readonly self: T;
  /** The value for a neighbour id (the default if it has none of its own). */
  at(id: string): T;
  map<U>(fn: (v: T, id?: string) => U): Field<U>;
  zip<U, R>(other: Field<U> | U, fn: (a: T, b: U) => R): Field<R>;
  /** Folds over the aligned neighbours, the device itself excluded: Math.min / Math.max work as reducers. */
  reduce<A>(fn: (acc: A, v: T) => A, initial: A): A;
  min(base?: number): number;
  max(base?: number): number;
  sum(base?: number): number;
}

/** What xc returns: the value to keep, and the (per-neighbour) value to send. */
export interface RetSend<R, S> { readonly ret: R; readonly send: Field<S> | S; }

/** Objects in init travel as arrays of their values: init fixes their shape. */
export function xc<T, R = Field<T> | T>(init: T, fn: (n: Field<T>) => R | RetSend<R, T>): R;
export function retsend<R, S>(ret: R, send: Field<S> | S): RetSend<R, S>;
export function share<T>(init: T, fn: (n: Field<T>) => T): T;
export function nbr<T>(v: T): Field<T>;
export function rep<T>(init: T, fn: (prev: T) => T): T;
export function branch<A, B = undefined>(cond: unknown, then: () => A, otherwise?: () => B): A | B;
export function align<R>(key: string | number, fn: () => R): R;
/** Aligns calls by function name: different functions never share messages. */
export function aggregate<F extends (...args: any[]) => any>(name: string, fn: F): F;
export function id(): string | number;
export function sense<T = any>(name: string): T;
export function nbrSense(name: 'range' | 'rssi' | string): Field<number>;

export interface StartConfig {
  target: 'sim' | 'ble' | 'udp' | 'host';
  /** ms between rounds */
  period?: number;
  sensors?: (id: string | number, ...rest: any[]) => Record<string, any>;
  onResult?: (value: any, id: string | number) => void;
  /** Devices only hear devices with the same group (ble, udp). */
  group?: string;
  /** Another hash for operator names on BLE, when two collide: the same on every device. */
  hashSeed?: number;
  /** Bytes per operator name on BLE (2): 3 makes collisions much rarer, 1 saves a byte. The same on every device. */
  hashBytes?: 1 | 2 | 3;
  [option: string]: any;
}
export interface Running { id?: string | number; round(): any; stop(): void; }
export function start(program: () => any, cfg: StartConfig): Running;
export function globals(): typeof import('./index');

export interface Device {
  id: string | number;
  round(program: () => any, inbox?: Record<string, any>, sensors?: Record<string, any>,
    nbrSensors?: Record<string, Record<string, number>>): { value: any; message: Record<string, any> };
}
export function device(id: string | number, hashed?: boolean): Device;
export function encode(msg: any): string;
export function decode(str: string): any;
export function hash(path: string, seed?: number, bytes?: 1 | 2 | 3): string;
export function magic(group?: string): string;
export const targets: Record<string, { start(program: () => any, cfg: StartConfig): Running }>;
