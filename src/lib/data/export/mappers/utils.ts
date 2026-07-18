interface GroupedCsvPreItem {
  participant: string
  stimulus: string
}

export function groupByParticipantAndStimulus<T extends GroupedCsvPreItem>(
  data: T[],
  buildFile: (combinedData: T[], stimulus: string, participant: string) => { fileName: string; content: string }
): Array<{ fileName: string; content: string }> {
  const results: Array<{ fileName: string; content: string }> = []

  const participants = Array.from(new Set(data.map(item => item.participant)))
  const stimuli = Array.from(new Set(data.map(item => item.stimulus)))

  for (const participant of participants) {
    for (const stimulus of stimuli) {
      const combinedData = data.filter(
        item => item.participant === participant && item.stimulus === stimulus
      )

      if (combinedData.length === 0) continue

      results.push(buildFile(combinedData, stimulus, participant))
    }
  }

  return results
}
