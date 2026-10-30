/** Options from id + name rows: [{ id: 1, name: 'A' }] -> [{ value: 1, label: 'A' }] */
export function toOptions(rows = [], label = (row) => row.name) {
  return rows.map((row) => ({ value: row.id, label: label(row) }))
}


export function selectableOptions(rows = [], current, { value = (row) => row.uuid, label = (row) => row.name, active = (row) => row.is_active } = {}) {
  return rows
    .filter((row) => active(row) || value(row) === current)
    .map((row) => ({ value: value(row), label: active(row) ? label(row) : `${label(row)} (inactive)` }))
}

export function selectableGroups(groups = [], current) {
  return groups
    .map((group) => ({ label: group.label, options: selectableOptions(group.rows, current, { active: group.active, label: group.rowLabel, value: group.value }) }))
    .filter((group) => group.options.length > 0)
}
  