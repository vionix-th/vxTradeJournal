export class MemoryDatabase {
  constructor(records = {}) { this.records = new Map(Object.entries(records)); }
  doc(path) {
    return { path, get: async () => ({ exists: this.records.has(path), data: () => this.records.get(path) }),
      listCollections: async () => this.collections(path),
      create: async (data) => { if (this.records.has(path)) throw new Error("Exists"); this.records.set(path, data); },
      set: async (data) => this.records.set(path, data) };
  }
  collection(path) {
    return { listDocuments: async () => [...new Set([...this.records.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => key.split("/").slice(0, path.split("/").length + 1).join("/")))].sort().map((key) => this.doc(key)) };
  }
  collections(parent = "") {
    const depth = parent ? parent.split("/").length : 0;
    return [...new Set([...this.records.keys()].filter((key) => !parent || key.startsWith(`${parent}/`)).map((key) => key.split("/").slice(0, depth + 1).join("/")))].map((key) => this.collection(key));
  }
  async listCollections() { return this.collections(); }
  async runTransaction(operation) {
    const staged = [];
    const tx = { get: (ref) => ref.get(), set: (ref, data, options) => staged.push(() => this.records.set(ref.path, options?.merge ? { ...this.records.get(ref.path), ...data } : data)), update: (ref, data) => staged.push(() => this.records.set(ref.path, { ...this.records.get(ref.path), ...data })), delete: (ref) => staged.push(() => this.records.delete(ref.path)) };
    const result = await operation(tx);
    for (const action of staged) action();
    return result;
  }
}
