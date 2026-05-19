import { onMounted, ref, watch, type WatchSource } from 'vue';

interface UseAsyncStateOptions {
  watch?: WatchSource | WatchSource[];
  resetOnExecute?: boolean;
}

export function useAsyncState<T>(loader: () => Promise<T>, options: UseAsyncStateOptions = {}) {
  const data = ref<T>();
  const loading = ref(true);
  const error = ref<string>();
  let executionId = 0;

  const execute = async () => {
    const currentExecutionId = ++executionId;
    loading.value = true;
    error.value = undefined;
    if (options.resetOnExecute) {
      data.value = undefined;
    }
    try {
      const nextData = await loader();
      if (currentExecutionId === executionId) {
        data.value = nextData;
      }
    } catch (err) {
      if (currentExecutionId === executionId) {
        error.value = err instanceof Error ? err.message : 'Unknown error';
      }
    } finally {
      if (currentExecutionId === executionId) {
        loading.value = false;
      }
    }
  };

  onMounted(execute);
  if (options.watch) {
    watch(options.watch, () => {
      void execute();
    });
  }

  return {
    data,
    loading,
    error,
    reload: execute,
  };
}
