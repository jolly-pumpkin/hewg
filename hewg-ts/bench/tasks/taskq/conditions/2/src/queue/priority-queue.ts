/**
 *
 * Generic priority queue backed by a sorted array.
 * Higher priority values are dequeued first.
 */

interface PriorityEntry<T> {
  item: T;
  priority: number;
}

/**
 * A simple sorted-array priority queue.
 * Items with higher priority values are dequeued first.
 */
export class PriorityQueue<T> {
  private entries: PriorityEntry<T>[] = [];

  /**
   * Add an item with the given priority.
   */
  enqueue(item: T, priority: number): void {
    const entry: PriorityEntry<T> = { item, priority };
    let insertIndex = this.entries.length;
    for (let i = 0; i < this.entries.length; i++) {
      if (priority > this.entries[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.entries.splice(insertIndex, 0, entry);
  }

  /**
   * Remove and return the highest-priority item, or undefined if empty.
   */
  dequeue(): T | undefined {
    const entry = this.entries.shift();
    return entry?.item;
  }

  /**
   * Return the highest-priority item without removing it.
   */
  peek(): T | undefined {
    return this.entries[0]?.item;
  }

  /**
   * Return the number of items in the queue.
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Return true if the queue contains no items.
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Return all items in priority order as an array.
   */
  toArray(): T[] {
    return this.entries.map((e) => e.item);
  }
}
