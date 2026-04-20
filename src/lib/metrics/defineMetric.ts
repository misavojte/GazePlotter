import type { MetricDef } from './types'

const _registry = new Map<string, MetricDef>()
const _order: string[] = []

export function defineMetric(def: MetricDef): MetricDef {
  if (_registry.has(def.id)) return _registry.get(def.id)!
  _registry.set(def.id, def)
  _order.push(def.id)
  return def
}

export function getMetricDef(id: string): MetricDef | undefined {
  return _registry.get(id)
}

export function getMetricDefs(): MetricDef[] {
  return _order.map(id => _registry.get(id)!)
}
