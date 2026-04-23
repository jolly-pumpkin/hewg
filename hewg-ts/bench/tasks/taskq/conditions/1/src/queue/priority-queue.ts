
interface PriorityEntry<T> {
  item: T;
  priority: number;
}

export class PriorityQueue<T> {
  private entries: PriorityEntry<T>[] = [];

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

  dequeue(): T | undefined {
    const entry = this.entries.shift();
    return entry?.item;
  }

  peek(): T | undefined {
    return this.entries[0]?.item;
  }

  size(): number {
    return this.entries.length;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  toArray(): T[] {
    return this.entries.map((e) => e.item);
  }
}
