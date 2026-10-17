import { defineScanpathSimilarityMetric } from './defineScanpathSimilarityMetric'

defineScanpathSimilarityMetric({
  id: 'scanpathLevenshteinSimilarity',
  label: 'Levenshtein similarity',
  description:
    "Per participant pair: normalized Levenshtein similarity between participants' AOI-letter scanpaths. " +
    'Symmetric, with diagonal = 1. Uses minimum edit distance (insertions, deletions, substitutions).',
  searchTags: ['scanpath', 'similarity', 'levenshtein', 'pairwise', 'comparison', 'edit distance'],
  method: 'levenshtein',
})
