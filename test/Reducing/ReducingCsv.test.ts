import { test, expect, describe } from 'vitest'
import { EyeTrackingParserCsvReducer} from "../../src/ts/Back/EyeTrackingParser/Reducer/EyeTrackingParserCsvReducer";
import { StartButtonsService } from "../../src/ts/Front/StartButtons/StartButtonsService";
import { EyeTrackingParser } from "../../src/ts/Back/EyeTrackingParser/EyeTrackingParser";

const sampleCsvContent = `Time,Participant,Stimulus,AOI
0,Participant_1,Map_A,Region_1
1,Participant_1,Map_A,Region_1
2,Participant_1,Map_A,Region_1
3,Participant_1,Map_A,Region_2
4,Participant_1,Map_A,Region_3
5,Participant_1,Map_A,Region_4
0,Participant_2,Map_B,Region_1
1,Participant_2,Map_B,Region_1
2,Participant_2,Map_B,Region_1
3,Participant_2,Map_B,Region_2
4,Participant_2,Map_B,Region_3
5,Participant_2,Map_B,Region_4
0,Participant_3,Map_C,Region_2
1,Participant_3,Map_C,Region_2
2,Participant_3,Map_C,Region_2
3,Participant_3,Map_C,Region_3
4,Participant_3,Map_C,Region_4
5,Participant_3,Map_C,Region_5
0,Participant_4,Map_D,Region_3
1,Participant_4,Map_D,Region_3
2,Participant_4,Map_D,Region_3
3,Participant_4,Map_D,Region_4
4,Participant_4,Map_D,Region_5
5,Participant_4,Map_D,Region_1
`

/**
 * @vitest-environment jsdom
 */

describe('Front', () => {
  const sut = new StartButtonsService()
  test('Csv type detection', () => {
      const type = sut.getTypeFromSlice(sampleCsvContent)
      expect(type).toBe('csv')
  })
  test('Csv column delimiter', () => {
      const type = sut.getTypeFromSlice(sampleCsvContent)
      const delimiter = sut.getColumnDelimiter(type)
      expect(delimiter).toBe(',')
  })
  test('Csv correct worker settings', async () => {
      const file = new File([sampleCsvContent], 'fake.csv', { type: 'text/csv' })
      const fileList: FileList = {
          0: file,
          length: 1,
          item: () => file
      }
      const workerSettings = await sut.preprocessEyeTrackingFiles(fileList)
      expect(workerSettings.workerSettings.type).toBe('csv')
      expect(workerSettings.workerSettings.columnDelimiter).toBe(',')
      expect(workerSettings.workerSettings.rowDelimiter).toBe('\r\n')
      expect(workerSettings.workerSettings.fileNames).toEqual(['fake.csv'])
    })
})

describe ('Reducer', () => {
    const csvRows = sampleCsvContent.split('\n')
    const header = csvRows[0].split(',')
    test ('Constructor', () => {
        const sut = new EyeTrackingParserCsvReducer(header)
        expect(sut).toBeDefined()
        expect(sut.cAoi).toBe(3)
        expect(sut.cParticipant).toBe(1)
        expect(sut.cStimulus).toBe(2)
        expect(sut.cTime).toBe(0)
    })

    test ('Process first row', () => {
        const sut = new EyeTrackingParserCsvReducer(header)
        const row = csvRows[1].split(',')
        const result = sut.reduce(row)
        expect(result).toBeNull()
        expect(sut.mAoi).toEqual('Region_1')
        expect(sut.mParticipant).toEqual('Participant_1')
        expect(sut.mStimulus).toEqual('Map_A')
        expect(sut.mTimeBase).toEqual(0)
        expect(sut.mTimeStart).toEqual('0')
        expect(sut.mTimeLast).toEqual('0')
    })

    test ('Process first segment', () => {
        const sut = new EyeTrackingParserCsvReducer(header)
        const row1 = csvRows[1].split(',')
        const row2 = csvRows[2].split(',')
        const row3 = csvRows[3].split(',')
        const row4 = csvRows[4].split(',')

        void sut.reduce(row1)
        void sut.reduce(row2)
        void sut.reduce(row3)
        const result = sut.reduce(row4)

        expect(result).toEqual({
            aoi: ['Region_1'],
            category: 'Fixation',
            start: '0',
            end: '2',
            participant: 'Participant_1',
            stimulus: 'Map_A'
        })
    })

    test ('Process second segment', () => {

        const sut = new EyeTrackingParserCsvReducer(header)

        const row1 = csvRows[1].split(',')
        const row2 = csvRows[2].split(',')
        const row3 = csvRows[3].split(',')
        const row4 = csvRows[4].split(',')
        const row5 = csvRows[5].split(',')

        void sut.reduce(row1)
        void sut.reduce(row2)
        void sut.reduce(row3)
        void sut.reduce(row4)
        const result = sut.reduce(row5)

        expect(result).toEqual({
            aoi: ['Region_2'],
            category: 'Fixation',
            start: '3',
            end: '3',
            participant: 'Participant_1',
            stimulus: 'Map_A'
        })

        // BEWARE! If only one timestamp for whole segment, start and end are the same!

    })

})

describe ('Parser', async () => {

    const file = new File([sampleCsvContent], 'fake.csv', { type: 'text/csv' })
    const fileList: FileList = {
        0: file,
        length: 1,
        item: () => file
    }

    test ('Constructor', async () => {
        const frontService = new StartButtonsService()
        const workerSettings = await frontService.preprocessEyeTrackingFiles(fileList)
        const sut = new EyeTrackingParser(workerSettings.workerSettings)
        expect(sut).toBeDefined()
    })

    test ('Correct type', async () => {
        const frontService = new StartButtonsService()
        const workerSettings = await frontService.preprocessEyeTrackingFiles(fileList)
        const sut = new EyeTrackingParser(workerSettings.workerSettings)
        expect(sut.type).toBe('csv')
    })

    test ('Row Reducer', async () => {
        const frontService = new StartButtonsService()
        const workerSettings = await frontService.preprocessEyeTrackingFiles(fileList)
        const sut = new EyeTrackingParser(workerSettings.workerSettings)

        const rows = sampleCsvContent.split('\n')

        const row0 = rows[0]
        const reducer = sut.getRowReducer(row0.split(','))
        expect(reducer).toBeDefined()
        expect(reducer instanceof EyeTrackingParserCsvReducer).toBeTruthy()
    })

    test ('Process', async () => {
        const frontService = new StartButtonsService()
        const workerSettings = await frontService.preprocessEyeTrackingFiles(fileList)
        const sut = new EyeTrackingParser(workerSettings.workerSettings)

        const rows = sampleCsvContent.split('\n')

        const row0 = rows[0]
        const reducer = sut.getRowReducer(row0.split(','))

        sut.columnsIntegrity = 4 // normally set in pump

        for (let i = 1; i < rows.length - 1; i++) {
            const row = rows[i]
            sut.processRow(row, reducer)
        }

        const result = sut.getData()
        expect(result).toBeDefined()

        expect(result.stimuli.data.length).toBe(4)
        expect(result.stimuli.data[0]).toEqual(['Map_A'])
        expect(result.stimuli.data[1]).toEqual(['Map_B'])
        expect(result.stimuli.data[2]).toEqual(['Map_C'])
        expect(result.stimuli.data[3]).toEqual(['Map_D'])

        expect(result.participants.data.length).toBe(4)
        expect(result.participants.data[0]).toEqual(['Participant_1'])
        expect(result.participants.data[1]).toEqual(['Participant_2'])
        expect(result.participants.data[2]).toEqual(['Participant_3'])
        expect(result.participants.data[3]).toEqual(['Participant_4'])

        expect(result.aois.data[0].length).toBe(4)
        expect(result.aois.data[0][0]).toEqual(['Region_1'])
        expect(result.aois.data[0][1]).toEqual(['Region_2'])
        expect(result.aois.data[0][2]).toEqual(['Region_3'])
        expect(result.aois.data[0][3]).toEqual(['Region_4'])

        expect(result.aois.data[3].length).toBe(3)
        expect(result.aois.data[3][0]).toEqual(['Region_3'])

        const segmentOneOfStimulusOneOfParticipantOne = result.segments[0][0][0]
        expect(segmentOneOfStimulusOneOfParticipantOne[0]).toEqual(0) // from
        expect(segmentOneOfStimulusOneOfParticipantOne[1]).toEqual(2) // to
    })
})
