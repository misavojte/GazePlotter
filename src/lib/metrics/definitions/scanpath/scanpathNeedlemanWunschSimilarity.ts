import { defineScanpathSimilarityMetric } from './defineScanpathSimilarityMetric'

defineScanpathSimilarityMetric({
  id: 'scanpathNeedlemanWunschSimilarity',
  label: 'Needleman-Wunsch similarity',
  description:
    "Per participant pair: normalized Needleman-Wunsch similarity between participants' AOI-letter scanpaths. " +
    'Symmetric, with diagonal = 1. Uses global sequence alignment with ScanGraph scoring weights.',
  searchTags: ['scanpath', 'similarity', 'needleman-wunsch', 'pairwise', 'comparison', 'scangraph', 'alignment'],
  method: 'needlemanWunsch',
})
