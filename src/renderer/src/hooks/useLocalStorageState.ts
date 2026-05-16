import { useCallback, useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  parse: (value: string) => T = JSON.parse,
  serialize: (value: T) => string = JSON.stringify
): [T, (value: T | ((current: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    const stored = window.localStorage.getItem(key)
    if (stored == null) return initialValue
    try {
      return parse(stored)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(state))
    } catch {
      // Ignore storage failures; UI state should remain usable.
    }
  }, [key, serialize, state])

  const setStoredState = useCallback((value: T | ((current: T) => T)) => {
    setState((current) =>
      typeof value === 'function' ? (value as (current: T) => T)(current) : value
    )
  }, [])

  return [state, setStoredState]
}
