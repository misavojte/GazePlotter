import { describe, expect, it } from 'vitest'
import * as surveyIndex from '$survey'

type RuntimeModule = Record<string, unknown>

const surveyDefinitionModules = import.meta.glob<RuntimeModule>(
  '/src/lib/survey/components/*.definition.ts'
)

describe('survey modal definition exports', () => {
  it('re-exports every survey modal definition from the survey index', async () => {
    const surveyIndexModule: RuntimeModule = surveyIndex

    for (const surveyDefinitionPath of Object.keys(surveyDefinitionModules).sort()) {
      const definitionModule = await surveyDefinitionModules[surveyDefinitionPath]()
      const runtimeExports = Object.entries(definitionModule).filter(
        ([exportName]) => exportName !== 'default'
      )
      expect(
        runtimeExports,
        `${surveyDefinitionPath} should expose exactly one runtime export`
      ).toHaveLength(1)
      const [exportName, definition] = runtimeExports[0]
      expect(surveyIndexModule[exportName]).toBe(definition)
    }
  })
})
