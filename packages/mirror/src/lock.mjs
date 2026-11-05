// One lock around each poll and its write (SPEC/INTEGRATION_AND_MIRROR.md §8 item 2):
// a sync that raced the poll loop once returned before the writes had landed.

export class Lock {
  #tail = Promise.resolve();
  #held = false;

  get held() {
    return this.#held;
  }

  run(fn) {
    const result = this.#tail.then(async () => {
      this.#held = true;
      try {
        return await fn();
      } finally {
        this.#held = false;
      }
    });
    this.#tail = result.catch(() => {});
    return result;
  }
}
