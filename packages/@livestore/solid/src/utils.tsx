import * as Solid from 'solid-js'

export type MakeOptional<T, TKeys extends keyof T> = Omit<T, TKeys> & { [TKey in TKeys]: T[TKey] | undefined }

export type AccessorMaybe<T> = Solid.Accessor<T> | T

export function resolve<T>(value: AccessorMaybe<T>): T {
  if (typeof value === 'function') {
    return (value as Solid.Accessor<T>)()
  }
  return value
}

/**
 * Wraps a value or accessor in a way that bypasses Suspense boundaries when read.
 *
 * This is used internally for example in `store.useQuery` to set up query subscriptions
 * without triggering Suspense. This allows us to declare the query in the a component's body
 * and suspending only where read:
 *
 * ```tsx
 * function Child(){
 *  const store = useStore(...);
 *  const query = store.useQuery(...);
 *
 *  return <Suspense fallback="inner">{query()}</Suspense>
 * }
 *
 * function App(){
 *  return <Suspense fallback="outer"><Child/></Suspense>
 * }
 * ```
 *
 * In the above example, `inner` will be displayed initially.
 */
export function bypassSuspense<T>(store: T | Solid.Accessor<T | undefined>): Solid.Accessor<T | undefined> {
  return Solid.children(() => (
    <Solid.Suspense>{store as unknown as Solid.JSXElement}</Solid.Suspense>
  )) as unknown as Solid.Accessor<T>
}
