import { describe, expect, it } from 'vitest'
import * as rootModalDefinitions from '../src/lib/modals/definitions'

type RuntimeModule = Record<string, unknown>

const modalDefinitionModules =
  import.meta.glob<RuntimeModule>('/src/lib/modals/**/definition.ts')
const modalBarrelModules =
  import.meta.glob<RuntimeModule>('/src/lib/modals/**/definitions.ts')

function getSingleRuntimeExport(
  module: Record<string, unknown>,
  modulePath: string
): [string, unknown] {
  const runtimeExports = Object.entries(module).filter(
    ([exportName]) => exportName !== 'default'
  )

  expect(
    runtimeExports,
    `${modulePath} should expose exactly one runtime export`
  ).toHaveLength(1)

  return runtimeExports[0]
}

describe('modal definition barrels', () => {
  it('re-exports every modal definition from the nearest category barrel and the root barrel', async () => {
    const rootBarrelModule: RuntimeModule = rootModalDefinitions

    for (const modalDefinitionPath of Object.keys(modalDefinitionModules).sort()) {
      const definitionLoader = modalDefinitionModules[modalDefinitionPath]
      const [, , , , category] = modalDefinitionPath.split('/')
      const categoryBarrelPath = `/src/lib/modals/${category}/definitions.ts`
      const categoryBarrelLoader = modalBarrelModules[categoryBarrelPath]

      expect(
        categoryBarrelLoader,
        `Missing category barrel ${categoryBarrelPath} for ${modalDefinitionPath}`
      ).toBeTypeOf('function')

      const [definitionModule, categoryBarrelModule] = await Promise.all([
        definitionLoader(),
        categoryBarrelLoader(),
      ])
      const [exportName, definition] = getSingleRuntimeExport(
        definitionModule,
        modalDefinitionPath
      )

      expect(categoryBarrelModule[exportName]).toBe(definition)
      expect(rootBarrelModule[exportName]).toBe(definition)
    }
  })
})
