import { MapLike } from "./types";
import { Map, Iterator } from "typescript";
import { Debug } from "./debug";

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function isArray(value: any): value is ReadonlyArray<{}> {
  return Array.isArray ? Array.isArray(value) : value instanceof Array;
}
export function map<T, U>(
  array: ReadonlyArray<T>,
  f: (x: T, i: number) => U
): U[];
export function map<T, U>(
  array: ReadonlyArray<T> | undefined,
  f: (x: T, i: number) => U
): U[] | undefined;
export function map<T, U>(
  array: ReadonlyArray<T> | undefined,
  f: (x: T, i: number) => U
): U[] | undefined {
  let result: U[] | undefined;
  if (array) {
    result = [];
    for (let i = 0; i < array.length; i++) {
      result.push(f(array[i], i));
    }
  }
  return result;
}
export function last<T>(array: ReadonlyArray<T>): T {
  Debug.assert(array.length !== 0);
  return array[array.length - 1];
}
export function lastOrUndefined<T>(array: ReadonlyArray<T>): T | undefined {
  return array.length === 0 ? undefined : array[array.length - 1];
}
export function toArray<T>(value: T | T[]): T[];
export function toArray<T>(value: T | ReadonlyArray<T>): ReadonlyArray<T>;
export function toArray<T>(value: T | T[]): T[] {
  return isArray(value) ? value : [value];
}

export function createMapFromTemplate<T>(template: MapLike<T>): Map<T> {
  const map: Map<T> = new MapCtr<T>();

  // Copies keys/values from template. Note that for..in will not throw if
  // template is undefined, and instead will just exit the loop.
  for (const key in template) {
    if (hasOwnProperty.call(template, key)) {
      map.set(key, template[key]);
    }
  }

  return map;
}

/** Returns its argument. */
export function identity<T>(x: T) {
  return x;
}

function compareComparableValues(
  a: string | undefined,
  b: string | undefined
): Comparison;
function compareComparableValues(
  a: number | undefined,
  b: number | undefined
): Comparison;
function compareComparableValues(
  a: string | number | undefined,
  b: string | number | undefined
) {
  return a === b
    ? Comparison.EqualTo
    : a === undefined
    ? Comparison.LessThan
    : b === undefined
    ? Comparison.GreaterThan
    : a < b
    ? Comparison.LessThan
    : Comparison.GreaterThan;
}

/**
 * Compare two numeric values for their order relative to each other.
 * To compare strings, use any of the `compareStrings` functions.
 */
export function compareValues(
  a: number | undefined,
  b: number | undefined
): Comparison {
  return compareComparableValues(a, b);
}

export function createMap<T>(): Map<T> {
  return new MapCtr<T>();
}

// The global Map object. This may not be available, so we must test for it.
declare const Map: (new <T>() => Map<T>) | undefined;
// Internet Explorer's Map doesn't support iteration, so don't use it.
// tslint:disable-next-line no-in-operator variable-name
export const MapCtr =
  typeof Map !== "undefined" && "entries" in Map.prototype ? Map : shimMap();

/** Create a MapLike with good performance. */
function createDictionaryObject<T>(): MapLike<T> {
  const map = Object.create(/*prototype*/ null); // tslint:disable-line:no-null-keyword

  // Using 'delete' on an object causes V8 to put the object in dictionary mode.
  // This disables creation of hidden classes, which are expensive when an object is
  // constantly changing shape.
  map.__ = undefined;
  delete map.__;

  return map;
}

// Keep the class inside a function so it doesn't get compiled if it's not used.
export function shimMap(): new <T>() => Map<T> {
  interface MapEntry<T> {
    readonly key?: string;
    value?: T;

    // Linked list references for iterators.
    nextEntry?: MapEntry<T>;
    previousEntry?: MapEntry<T>;

    /**
     * Specifies if iterators should skip the next entry.
     * This will be set when an entry is deleted.
     * See https://github.com/Microsoft/TypeScript/pull/27292 for more information.
     */
    skipNext?: boolean;
  }

  class MapIterator<T, U extends string | T | [string, T]> {
    private currentEntry?: MapEntry<T>;
    private selector: (key: string, value: T) => U;

    constructor(
      currentEntry: MapEntry<T>,
      selector: (key: string, value: T) => U
    ) {
      this.currentEntry = currentEntry;
      this.selector = selector;
    }

    public next(): { value: U; done: false } | { value: never; done: true } {
      // Navigate to the next entry.
      while (this.currentEntry) {
        const skipNext = !!this.currentEntry.skipNext;
        this.currentEntry = this.currentEntry.nextEntry;

        if (!skipNext) {
          break;
        }
      }

      if (this.currentEntry) {
        return {
          value: this.selector(
            this.currentEntry.key!,
            this.currentEntry.value!
          ),
          done: false
        };
      } else {
        return { value: undefined as never, done: true };
      }
    }
  }

  return class<T> implements Map<T> {
    private data = createDictionaryObject<MapEntry<T>>();
    public size = 0;

    // Linked list references for iterators.
    // See https://github.com/Microsoft/TypeScript/pull/27292
    // for more information.

    /**
     * The first entry in the linked list.
     * Note that this is only a stub that serves as starting point
     * for iterators and doesn't contain a key and a value.
     */
    private readonly firstEntry: MapEntry<T>;
    private lastEntry: MapEntry<T>;

    constructor() {
      // Create a first (stub) map entry that will not contain a key
      // and value but serves as starting point for iterators.
      this.firstEntry = {};
      // When the map is empty, the last entry is the same as the
      // first one.
      this.lastEntry = this.firstEntry;
    }

    get(key: string): T | undefined {
      const entry = this.data[key] as MapEntry<T> | undefined;
      return entry && entry.value!;
    }

    set(key: string, value: T): this {
      if (!this.has(key)) {
        this.size++;

        // Create a new entry that will be appended at the
        // end of the linked list.
        const newEntry: MapEntry<T> = {
          key,
          value
        };
        this.data[key] = newEntry;

        // Adjust the references.
        const previousLastEntry = this.lastEntry;
        previousLastEntry.nextEntry = newEntry;
        newEntry.previousEntry = previousLastEntry;
        this.lastEntry = newEntry;
      } else {
        this.data[key].value = value;
      }

      return this;
    }

    has(key: string): boolean {
      // tslint:disable-next-line:no-in-operator
      return key in this.data;
    }

    delete(key: string): boolean {
      if (this.has(key)) {
        this.size--;
        const entry = this.data[key];
        delete this.data[key];

        // Adjust the linked list references of the neighbor entries.
        const previousEntry = entry.previousEntry!;
        previousEntry.nextEntry = entry.nextEntry;
        if (entry.nextEntry) {
          entry.nextEntry.previousEntry = previousEntry;
        }

        // When the deleted entry was the last one, we need to
        // adust the lastEntry reference.
        if (this.lastEntry === entry) {
          this.lastEntry = previousEntry;
        }

        // Adjust the forward reference of the deleted entry
        // in case an iterator still references it. This allows us
        // to throw away the entry, but when an active iterator
        // (which points to the current entry) continues, it will
        // navigate to the entry that originally came before the
        // current one and skip it.
        entry.previousEntry = undefined;
        entry.nextEntry = previousEntry;
        entry.skipNext = true;

        return true;
      }
      return false;
    }

    clear(): void {
      this.data = createDictionaryObject<MapEntry<T>>();
      this.size = 0;

      // Reset the linked list. Note that we must adjust the forward
      // references of the deleted entries to ensure iterators stuck
      // in the middle of the list don't continue with deleted entries,
      // but can continue with new entries added after the clear()
      // operation.
      const firstEntry = this.firstEntry;
      let currentEntry = firstEntry.nextEntry;
      while (currentEntry) {
        const nextEntry = currentEntry.nextEntry;
        currentEntry.previousEntry = undefined;
        currentEntry.nextEntry = firstEntry;
        currentEntry.skipNext = true;

        currentEntry = nextEntry;
      }
      firstEntry.nextEntry = undefined;
      this.lastEntry = firstEntry;
    }

    keys(): Iterator<string> {
      return new MapIterator(this.firstEntry, key => key);
    }

    values(): Iterator<T> {
      return new MapIterator(this.firstEntry, (_key, value) => value);
    }

    entries(): Iterator<[string, T]> {
      return new MapIterator(
        this.firstEntry,
        (key, value) => [key, value] as [string, T]
      );
    }

    forEach(action: (value: T, key: string) => void): void {
      const iterator = this.entries();
      while (true) {
        const { value: entry, done } = iterator.next();
        if (done) {
          break;
        }

        action(entry[1], entry[0]);
      }
    }
  };
}

export const enum Comparison {
  LessThan = -1,
  EqualTo = 0,
  GreaterThan = 1
}

export type Comparer<T> = (a: T, b: T) => Comparison;

export function binarySearch<T, U>(
  array: ReadonlyArray<T>,
  value: T,
  keySelector: (v: T) => U,
  keyComparer: Comparer<U>,
  offset?: number
): number {
  return binarySearchKey(
    array,
    keySelector(value),
    keySelector,
    keyComparer,
    offset
  );
}

export function some<T>(
  array: ReadonlyArray<T> | undefined
): array is ReadonlyArray<T>;
export function some<T>(
  array: ReadonlyArray<T> | undefined,
  predicate: (value: T) => boolean
): boolean;
export function some<T>(
  array: ReadonlyArray<T> | undefined,
  predicate?: (value: T) => boolean
): boolean {
  if (array) {
    if (predicate) {
      for (const v of array) {
        if (predicate(v)) {
          return true;
        }
      }
    } else {
      return array.length > 0;
    }
  }
  return false;
}

/**
 * Performs a binary search, finding the index at which an object with `key` occurs in `array`.
 * If no such index is found, returns the 2's-complement of first index at which
 * `array[index]` exceeds `key`.
 * @param array A sorted array whose first element must be no larger than number
 * @param key The key to be searched for in the array.
 * @param keySelector A callback used to select the search key from each element of `array`.
 * @param keyComparer A callback used to compare two keys in a sorted array.
 * @param offset An offset into `array` at which to start the search.
 */
export function binarySearchKey<T, U>(
  array: ReadonlyArray<T>,
  key: U,
  keySelector: (v: T) => U,
  keyComparer: Comparer<U>,
  offset?: number
): number {
  if (!some(array)) {
    return -1;
  }

  let low = offset || 0;
  let high = array.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >> 1);
    const midKey = keySelector(array[middle]);
    switch (keyComparer(midKey, key)) {
      case Comparison.LessThan:
        low = middle + 1;
        break;
      case Comparison.EqualTo:
        return middle;
      case Comparison.GreaterThan:
        high = middle - 1;
        break;
    }
  }

  return ~low;
}

export type EqualityComparer<T> = (a: T, b: T) => boolean;

export function equateValues<T>(a: T, b: T) {
  return a === b;
}

export function arraysEqual<T>(
  a: ReadonlyArray<T>,
  b: ReadonlyArray<T>,
  equalityComparer: EqualityComparer<T> = equateValues
): boolean {
  return a.length === b.length && a.every((x, i) => equalityComparer(x, b[i]));
}
