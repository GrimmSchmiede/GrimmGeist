/// <reference types="vite/client" />

interface MonacoEnvironmentGlobal {
  getWorker(workerId: string, label: string): Worker;
}

declare global {
  interface WorkerGlobalScope {
    MonacoEnvironment?: MonacoEnvironmentGlobal;
  }
  // eslint-disable-next-line no-var
  var MonacoEnvironment: MonacoEnvironmentGlobal | undefined;
}

export {};
