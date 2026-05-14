export async function safely<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorMessage?: string,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(errorMessage ?? 'Error:', err)
    return fallback
  }
}
