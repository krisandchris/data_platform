import { onMounted, ref } from 'vue';

export function useAsyncState<T>(loader: () => Promise<T>) {
  const data = ref<T>();
  const loading = ref(true);
  const error = ref<string>();

  const execute = async () => {
    loading.value = true;
    error.value = undefined;
    try {
      data.value = await loader();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };

  onMounted(execute);

  return {
    data,
    loading,
    error,
    reload: execute,
  };
}
