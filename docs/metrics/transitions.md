---
title: Transitions & Markov Metrics
order: 4
---

# Transitions & Markov Metrics

Transition metrics describe the dynamics of eye movement, mapping how visual attention shifts from one Area of Interest (AOI) to another. In GazePlotter, these metrics are formulated as a 2D matrix representing transitions from a source AOI (row) to a target AOI (column).

---

## Output Shape and Projections Translation

All transition metrics naturally output an `aoi-pair-matrix` (an N×N grid, where N is the number of active AOIs). However, using GazePlotter's projection algebra, you can translate this raw matrix into vectors or scalars, making transition metrics consumable by almost any visualization in the workspace.

### 1. Translating Matrix to Vector (`aoi-vector`)
You can project the N×N matrix into an array of values per AOI:
- **Self-Transitions (`matrix-diagonal`)**: Extracts the diagonal elements, representing the rate or probability of remaining within the same AOI on consecutive steps.
- **Outgoing Transitions (`matrix-row`)**: Extracts a single row for a specific source AOI. This outputs the transitions *from* that AOI to all other active AOIs.
- **Incoming Transitions (`matrix-col`)**: Extracts a single column for a specific target AOI. This outputs the transitions from all active AOIs *to* that target AOI.

> **Visualizer Compatibility**: Projecting a transition matrix into a vector allows you to select it in the [AOI Comparison](/docs/visualizations/aoi-comparison) plot (non-windowed) or the [AOI Timeline](/docs/visualizations/aoi-timeline) (windowed).

### 2. Translating Matrix to Scalar (`scalar`)
You can reduce the N×N matrix into a single numerical value:
- **Specific Transition Cell (`matrix-cell`)**: Extracts the value of a specific directional link (e.g., AOI A &gt; AOI B).
- **Matrix Aggregate (`matrix-aggregate`)**: Reduces the entire grid using a reducer (`sum`, `mean`, `max`, or `min`), optionally excluding diagonal self-transitions.

> **Visualizer Compatibility**: Projecting a transition matrix into a scalar allows you to select it in the [Metric Correlation](/docs/visualizations/metric-correlation) plot (non-windowed) or the [Metric Timeline](/docs/visualizations/metric-timeline) plot (windowed).

---

## Metric Recipes

GazePlotter provides four transition-based recipes:

### 1. Transitions (`transitionCount`)
The raw count of gaze shifts from a source AOI to a target AOI.

- **Raw Shape**: `aoi-pair-matrix`
- **Unit**: `count`
- **Additive**: `true`. Because counts are mathematically summable, this recipe unlocks `sum` and `mean` reducers when using the `matrix-aggregate` projection.
- **Group Aggregation**: `sum`. Each participant's counts are summed to represent the group's total transitions.

### 2. Transition Probability (`transitionProbability`)
The conditional probability of transitioning to a target AOI given that the gaze is currently on a source AOI.

- **Raw Shape**: `aoi-pair-matrix`
- **Unit**: `%`
- **Additive**: `false`. Row-stochastic matrices cannot be added together across cells. Therefore, the `matrix-aggregate` projection is restricted to `max` and `min` reducers.
- **Group Aggregation**: `mean`. The average probability matrix is computed across all participants.
- **Step Parameter (`step`)**: k-step Markov transition probability.
  - `step = 1`: Direct probability matrix `P`.
  - `step = k > 1`: Computes the matrix power `P^k`, representing the probability of arriving at target AOI after exactly `k` transitions.

### 3. Mean Transition Dwell (`transitionDwellMean`)
The average duration (in milliseconds) spent in a source AOI before transitioning to a target AOI.

- **Raw Shape**: `aoi-pair-matrix`
- **Unit**: `ms`
- **Additive**: `false`.
- **Group Aggregation**: `mean`.

### 4. Transition Relative Frequency (`transitionRelativeFrequency`)
The percentage share of all transitions occurring between specific AOI pairs, normalized against the total number of transitions across the entire stimulus.

- **Raw Shape**: `aoi-pair-matrix`
- **Unit**: `%`
- **Additive**: `false`.
- **Group Aggregation**: `mean`.

---

## Parameters

All transition recipes support a common **Mode** parameter:

- **Fixation Mode (`mode: 'fixation'`)**: Counts every consecutive fixation pair. If a participant makes three fixations in AOI A and then one in AOI B, the system registers two self-transitions (A &gt; A) and one outgoing transition (A &gt; B).
- **Visit Mode (`mode: 'visit'`)**: Collapses consecutive same-AOI fixations first. In the example above, the three fixations in AOI A are collapsed into a single visit. The system only registers one transition: Visit A &gt; Visit B. Self-transitions (A &gt; A) are eliminated.
