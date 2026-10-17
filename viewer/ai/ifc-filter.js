// The IFC question's data side (ai/ifc-query.js), without the DOM: the
// summary of a model's IFC properties the AI assistant gets, and the filter
// it answers with, run on all the elements.

const MAX_PSETS = 60;
const MAX_PROPERTIES = 40;
const MAX_SAMPLES = 3;
const MAX_TOP = 40;
// Not elements to count: type objects, the project, relationship-like defs.
// Any case: web-ifc (a .ifc opened directly) names the classes in capitals.
const NOT_ELEMENTS = /(type|style)$|^ifcproject$/i;
const SPATIAL = new Set(["ifcsite", "ifcbuilding", "ifcbuildingstorey", "ifcspace"]);
const isSpatial = (type) => SPATIAL.has(String(type || "").toLowerCase());

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// A property value as text/number/boolean (references become their name).
function plainValue(value) {
  if (value === ".T.") return true;
  if (value === ".F.") return false;
  if (isPlainObject(value)) return value.name ?? value.guid ?? value.type ?? null;
  if (Array.isArray(value)) return value.map(plainValue).join(", ");
  return value;
}

function valueType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
}

// GlobalId -> storey name, from the spatial tree (falling back to the
// element's container).
export function ifcStoreys(data) {
  const storeys = new Map();
  const walk = (node, storey) => {
    if (!node) return;
    const here = String(node.type || "").toLowerCase() === "ifcbuildingstorey" ? (node.name || node.guid) : storey;
    if (node.guid && here) storeys.set(node.guid, here);
    (node.children || []).forEach((child) => walk(child, here));
  };
  walk(data?.tree, null);
  Object.entries(data?.elements || {}).forEach(([guid, entry]) => {
    if (storeys.has(guid) || !entry.container) return;
    const container = data.elements[entry.container];
    if (String(container?.type || "").toLowerCase() === "ifcbuildingstorey") storeys.set(guid, container.name || entry.container);
  });
  return storeys;
}

function top(counts, limit = MAX_TOP) {
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit));
}

function bump(map, key) {
  if (key == null || key === "") return;
  map.set(key, (map.get(key) || 0) + 1);
}

// What the AI assistant gets to know about the model: names, types,
// counts and a few sample values - never the elements themselves.
export function buildIfcSummary(data) {
  const classes = new Map();
  const materials = new Map();
  const typeNames = new Map();
  const predefinedTypes = new Map();
  const psets = new Map();
  Object.values(data?.elements || {}).forEach((entry) => {
    if (!entry || NOT_ELEMENTS.test(entry.type || "")) return;
    bump(classes, entry.type);
    bump(materials, entry.material);
    bump(typeNames, entry.typeRef?.name);
    bump(predefinedTypes, entry.predefinedType);
    Object.entries(entry.psets || {}).forEach(([psetName, props]) => {
      if (!isPlainObject(props)) return;
      if (!psets.has(psetName)) psets.set(psetName, { count: 0, properties: new Map() });
      const pset = psets.get(psetName);
      pset.count += 1;
      Object.entries(props).forEach(([name, raw]) => {
        if (name === "id") return;
        const value = plainValue(raw);
        if (!pset.properties.has(name)) pset.properties.set(name, { type: valueType(value), count: 0, samples: [], min: null, max: null });
        const prop = pset.properties.get(name);
        prop.count += 1;
        if (typeof value === "number") {
          prop.min = prop.min === null ? value : Math.min(prop.min, value);
          prop.max = prop.max === null ? value : Math.max(prop.max, value);
        }
        const sample = typeof value === "string" ? value.slice(0, 40) : value;
        if (value != null && value !== "" && prop.samples.length < MAX_SAMPLES && !prop.samples.includes(sample)) prop.samples.push(sample);
      });
    });
  });
  const storeyNames = [...new Set(ifcStoreys(data).values())];
  const psetSummary = {};
  [...psets.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_PSETS)
    .forEach(([name, pset]) => {
      psetSummary[name] = {
        elements: pset.count,
        properties: Object.fromEntries([...pset.properties.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, MAX_PROPERTIES)
          .map(([prop, info]) => [prop, {
            type: info.type,
            samples: info.samples,
            ...(info.min !== null ? { min: info.min, max: info.max } : {}),
          }])),
      };
    });
  return {
    schema: data?.schema ?? null,
    project: data?.project?.name ?? null,
    classes: top(classes, 200),
    storeys: storeyNames,
    materials: top(materials),
    typeNames: top(typeNames),
    predefinedTypes: top(predefinedTypes),
    psets: psetSummary,
  };
}

function findProperty(entry, pset, property) {
  const sets = entry.psets || {};
  if (pset) {
    const props = sets[pset];
    return isPlainObject(props) && property in props ? { found: true, value: plainValue(props[property]) } : { found: false };
  }
  for (const props of Object.values(sets)) {
    if (isPlainObject(props) && property in props) return { found: true, value: plainValue(props[property]) };
  }
  return { found: false };
}

function fieldValue(guid, entry, condition, storeys) {
  switch (condition.field) {
    case "storey": return { found: storeys.has(guid), value: storeys.get(guid) };
    case "typeName": return { found: entry.typeRef?.name != null, value: entry.typeRef?.name };
    case "property": return findProperty(entry, condition.pset, condition.property);
    default: {
      const value = entry[condition.field];
      return { found: value != null && value !== "", value };
    }
  }
}

const norm = (value) => String(value ?? "").trim().toLowerCase();

function toNumber(value) {
  if (typeof value === "number") return value;
  const number = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function isTrue(value) {
  return value === true || ["true", ".t.", "yes", "1"].includes(norm(value));
}

// IfcWall also matches IfcWallStandardCase / IfcWallElementedCase.
function sameClass(type, wanted) {
  const a = norm(type);
  const b = norm(wanted);
  return a === b || a === `${b}standardcase` || a === `${b}elementedcase`;
}

export function matchCondition(guid, entry, condition, storeys) {
  const { found, value } = fieldValue(guid, entry, condition, storeys);
  const wanted = condition.value;
  switch (condition.op) {
    case "exists": return found && value != null && value !== "";
    case "missing": return !found || value == null || value === "";
    case "true": return found && isTrue(value);
    case "false": return found && !isTrue(value);
    case "eq":
      if (!found) return false;
      if (condition.field === "type") return sameClass(value, wanted);
      if (typeof value === "number" && toNumber(wanted) !== null) return value === toNumber(wanted);
      return norm(value) === norm(wanted);
    case "ne":
      if (!found) return true;
      if (condition.field === "type") return !sameClass(value, wanted);
      return norm(value) !== norm(wanted);
    case "contains": return found && norm(value).includes(norm(wanted));
    case "gt": case "gte": case "lt": case "lte": {
      const a = toNumber(value);
      const b = toNumber(wanted);
      if (!found || a === null || b === null) return false;
      return { gt: a > b, gte: a >= b, lt: a < b, lte: a <= b }[condition.op];
    }
    default: return false;
  }
}

// The filter of an answer run on all the elements: {guids, aggregate}.
export function runIfcFilter(data, answer) {
  const storeys = ifcStoreys(data);
  const conditions = Array.isArray(answer?.conditions) ? answer.conditions : [];
  const wantsSpatial = conditions.some((condition) => condition.field === "type" && isSpatial(condition.value));
  const guids = [];
  Object.entries(data?.elements || {}).forEach(([guid, entry]) => {
    if (!entry || NOT_ELEMENTS.test(entry.type || "")) return;
    if (!wantsSpatial && isSpatial(entry.type)) return;
    if (!conditions.length) return;
    const results = conditions.map((condition) => matchCondition(guid, entry, condition, storeys));
    if (answer.match === "any" ? results.some(Boolean) : results.every(Boolean)) guids.push(guid);
  });

  const aggregate = answer?.aggregate || {};
  let summary = null;
  if (aggregate.kind === "count") {
    summary = { kind: "count", value: guids.length };
  } else if (["sum", "average", "min", "max"].includes(aggregate.kind) && aggregate.property) {
    const values = [];
    let missing = 0;
    guids.forEach((guid) => {
      const { found, value } = findProperty(data.elements[guid], aggregate.pset, aggregate.property);
      const number = found ? toNumber(value) : null;
      if (number === null) missing += 1;
      else values.push(number);
    });
    const sum = values.reduce((total, value) => total + value, 0);
    const value = !values.length ? null : {
      sum,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    }[aggregate.kind];
    summary = { kind: aggregate.kind, property: aggregate.property, unit: aggregate.unit || null, value, counted: values.length, missing };
  }
  return { guids, aggregate: summary };
}
