// Copied from https://github.com/tc39/proposal-iterator-chunking/blob/main/src/index.ts

export const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([].values()))

function liftIterator<A>(iter: Iterator<A>): Iterable<A> {
  return { [Symbol.iterator]() { return iter; } };
}

function* chunksImpl<A>(iter: Iterator<A>, chunkSize: number): Generator<Array<A>> {
  let buffer = [];
  for (const elem of liftIterator(iter)) {
    buffer.push(elem);
    if (buffer.length === chunkSize) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}

export function chunks<A>(iterator: Iterator<A>, chunkSize: number): Generator<Array<A>>
export function chunks(iterator: unknown, chunkSize: unknown): Generator<unknown> {
  if (
    typeof chunkSize !== 'number'
    || chunkSize <= 0
    || Math.floor(chunkSize) !== chunkSize
    || chunkSize >= Math.pow(2, 53)
  ) {
    throw new RangeError;
  }
  return chunksImpl(iterator as Iterator<unknown>, chunkSize)
}

Object.defineProperty(IteratorPrototype, 'chunks', {
    configurable: true,
    writable: true,
    enumerable: false,
    value: chunks,
  });
  