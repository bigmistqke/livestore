/**
 * SSR tests for useStore
 * These tests run in node environment with SSR JSX transform using renderToString.
 */

import { makeInMemoryAdapter } from '@livestore/adapter-web'
import { provideOtel } from '@livestore/common'
import { createStore, queryDb, StoreRegistry } from '@livestore/livestore'
import { Effect, Schema } from '@livestore/utils/effect'
import * as Solid from 'solid-js'
import { isServer, renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'

import { schema, tables } from './__tests__/fixture.tsx'
import { StoreRegistryProvider } from './StoreRegistryContext.tsx'
import { useStore, withSolidApi } from './useStore.ts'

describe('environment', () => {
  it('runs on server', () => {
    expect(typeof window).toBe('undefined')
    expect(isServer).toBe(true)
  })
})

describe('useStore SSR', () => {
  it('renders component with pre-created store to string', async () => {
    await Effect.gen(function* () {
      const store = yield* createStore({
        schema,
        storeId: 'ssr-store-test',
        adapter: makeInMemoryAdapter(),
        debug: { instanceId: 'ssr-store-test' },
      })

      const storeWithSolidApi = withSolidApi(store)

      const StoreStatus = () => {
        return <div>Store ID: {storeWithSolidApi.storeId}</div>
      }

      const html = renderToString(() => <StoreStatus />)

      expect(html).toContain('Store ID:')
      expect(html).toContain('ssr-store-test')
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })

  it('renders component using store queries to string', async () => {
    await Effect.gen(function* () {
      const store = yield* createStore({
        schema,
        storeId: 'ssr-store-query-test',
        adapter: makeInMemoryAdapter(),
        debug: { instanceId: 'ssr-store-query-test' },
      })

      const storeWithSolidApi = withSolidApi(store)

      const [state] = storeWithSolidApi.useClientDocument(tables.userInfo, 'u1')

      const UserInfo = () => {
        return <div>User: {state().username || 'anonymous'}</div>
      }

      const html = renderToString(() => <UserInfo />)

      expect(html).toContain('User:')
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })

  it('works with Resource', async () => {
    await Effect.gen(function* () {
      const store = yield* createStore({
        schema,
        storeId: 'ssr-resource-test',
        adapter: makeInMemoryAdapter(),
        debug: { instanceId: 'ssr-resource-test' },
      })

      const UserInfo = () => {
        // Wrap store in a Resource (like useStore() does) - must be inside render
        const [storeResource] = Solid.createResource(() => store)
        const storeWithSolidApi = withSolidApi(storeResource)
        const [state] = storeWithSolidApi.useClientDocument(tables.userInfo, 'u1')
        return <div>User: {state()?.username || 'anonymous'}</div>
      }

      const html = renderToString(() => <UserInfo />)

      expect(html).toContain('User:')
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })

  // useClientDocument is optimistically updated - does NOT trigger Suspense
  it('useClientDocument returns optimistic state without suspending', async () => {
    await Effect.gen(function* () {
      const store = yield* createStore({
        schema,
        storeId: 'ssr-optimistic-test',
        adapter: makeInMemoryAdapter(),
        debug: { instanceId: 'ssr-optimistic-test' },
      })

      const UserInfo = () => {
        // Create a Resource that never resolves (simulates pending state)
        const [storeResource] = Solid.createResource(() => new Promise<typeof store>(() => {}))
        const storeWithSolidApi = withSolidApi(storeResource)
        const [state, setState] = storeWithSolidApi.useClientDocument(tables.userInfo, 'u1')
        // Set state before store loads - should buffer locally
        setState({ username: 'optimistic-user', text: 'buffered' })
        // Reading state() should return buffered value, NOT suspend
        return <div>User: {state()?.username || 'anonymous'}</div>
      }

      const html = renderToString(() => (
        <Solid.Suspense fallback={<div>Loading...</div>}>
          <UserInfo />
        </Solid.Suspense>
      ))

      // Should show optimistic state, NOT fallback
      expect(html).toContain('User:')
      expect(html).toContain('optimistic-user')
      expect(html).not.toContain('Loading...')
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })

  it('useQuery triggers Suspense at read site with pending Resource', async () => {
    await Effect.gen(function* () {
      const store = yield* createStore({
        schema,
        storeId: 'ssr-suspense-test',
        adapter: makeInMemoryAdapter(),
        debug: { instanceId: 'ssr-suspense-test' },
      })

      const allTodos$ = queryDb({ query: `select * from todos`, schema: Schema.Array(tables.todos.rowSchema) })

      const TodoList = () => {
        // Create a Resource that never resolves (simulates pending state)
        const [storeResource] = Solid.createResource(() => new Promise<typeof store>(() => {}))
        const storeWithSolidApi = withSolidApi(storeResource)
        const todos = storeWithSolidApi.useQuery(allTodos$)
        // Reading todos() should trigger Suspense when store is pending
        return <div>Todos: {todos()?.length ?? 'none'}</div>
      }

      const html = renderToString(() => (
        <Solid.Suspense fallback={<div>Loading...</div>}>
          <TodoList />
        </Solid.Suspense>
      ))

      // Should show fallback because Resource is pending and useQuery suspends
      expect(html).toContain('Loading...')
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })

  it('works with useStore and StoreRegistryProvider', async () => {
    await Effect.gen(function* () {
      const storeRegistry = new StoreRegistry()

      const UserInfo = () => {
        const store = useStore({
          storeId: 'ssr-registry-test',
          schema,
          adapter: makeInMemoryAdapter(),
        })
        const [state] = store.useClientDocument(tables.userInfo, 'u1')
        return <div>User: {state()?.username || 'anonymous'}</div>
      }

      const html = renderToString(() => (
        <StoreRegistryProvider storeRegistry={storeRegistry}>
          <Solid.Suspense fallback={<div>Loading store...</div>}>
            <UserInfo />
          </Solid.Suspense>
        </StoreRegistryProvider>
      ))

      // On SSR with async store loading, should show fallback or content
      expect(html).toMatch(/User:|Loading store.../)
    }).pipe(provideOtel({}), Effect.scoped, Effect.runPromise)
  })
})
