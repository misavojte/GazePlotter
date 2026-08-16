import SurveyModal from './SurveyModal.svelte'
import { defineModal } from '$lib/modals/defineModal'
import type { EyeTrackingExperienceResult, UEQSResults } from '$survey/types'

export type SurveyModalResult = {
  ueqs: UEQSResults
  eyeTracking: EyeTrackingExperienceResult
  feedback: string
}

export const surveyModal =
  defineModal<typeof SurveyModal, SurveyModalResult>({
    component: SurveyModal,
    title: 'User Experience Questionnaire',
  })
