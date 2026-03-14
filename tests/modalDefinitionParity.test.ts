import { describe, expect, it } from 'vitest'
import * as rootModalDefinitions from '../src/lib/modals/definitions'
import * as surveyIndex from '../src/survey/index'

type RuntimeModule = Record<string, unknown>

const modalDefinitionModules =
  import.meta.glob<RuntimeModule>('/src/lib/modals/**/definition.ts')
const modalBarrelModules =
  import.meta.glob<RuntimeModule>('/src/lib/modals/**/definitions.ts')
const surveyDefinitionModules =
  import.meta.glob<RuntimeModule>('/src/survey/components/*.definition.ts')

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

describe('survey modal definition exports', () => {
  it('re-exports every survey modal definition from the survey index', async () => {
    const surveyIndexModule: RuntimeModule = surveyIndex

    for (const surveyDefinitionPath of Object.keys(surveyDefinitionModules).sort()) {
      const definitionModule = await surveyDefinitionModules[surveyDefinitionPath]()
      const [exportName, definition] = getSingleRuntimeExport(
        definitionModule,
        surveyDefinitionPath
      )

      expect(surveyIndexModule[exportName]).toBe(definition)
    }
  })
})
