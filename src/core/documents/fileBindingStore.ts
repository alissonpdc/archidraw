const DB_NAME = "archidraw:documents";
const STORE_NAME = "file-bindings";
const DB_VERSION = 1;

export interface WorkspaceFileBinding {
  workspaceId: string;
  uid: string;
  fileName: string;
  handle: FileSystemFileHandle;
  lastSyncedHash: string;
  lastDiskMtime: number;
  lastDiskSize: number;
}

export interface FileBindingStore {
  list(): Promise<WorkspaceFileBinding[]>;
  put(binding: WorkspaceFileBinding): Promise<void>;
  remove(workspaceId: string): Promise<void>;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "workspaceId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const browserFileBindingStore: FileBindingStore = {
  async list() {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(
      transaction.objectStore(STORE_NAME).getAll() as IDBRequest<WorkspaceFileBinding[]>,
    );
    return records;
  },

  async put(binding) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(binding);
    await transactionDone(transaction);
  },

  async remove(workspaceId) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(workspaceId);
    await transactionDone(transaction);
  },
};

/** wipes all bindings (used by the e2e reset hook and "clear site data" flows) */
export async function clearFileBindingStore(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise.catch(() => null);
    database?.close();
    databasePromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
