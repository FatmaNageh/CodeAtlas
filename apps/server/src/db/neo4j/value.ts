export interface Neo4jIntegerLike {
  toNumber: () => number;
}

export interface Neo4jNodeLike {
  identity: Neo4jIntegerLike;
  labels: string[];
  properties: Record<string, Neo4jValue>;
}

export interface Neo4jRelationshipLike {
  identity: Neo4jIntegerLike;
  type: string;
  properties: Record<string, Neo4jValue>;
  start: Neo4jIntegerLike;
  end: Neo4jIntegerLike;
}

export interface Neo4jMapLike {
  [key: string]: Neo4jValue;
}

export type Neo4jValue =
  | string
  | number
  | boolean
  | null
  | Neo4jIntegerLike
  | Neo4jNodeLike
  | Neo4jRelationshipLike
  | Neo4jValue[]
  | Neo4jMapLike;

export type PlainValue =
  | string
  | number
  | boolean
  | null
  | PlainValue[]
  | { [key: string]: PlainValue };

export function isNeo4jIntegerLike(value: Neo4jValue): value is Neo4jIntegerLike {
  return typeof value === "object" && value !== null && "toNumber" in value &&
    typeof value.toNumber === "function";
}

function isNeo4jNodeLike(value: Neo4jValue): value is Neo4jNodeLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "identity" in value &&
    "labels" in value &&
    "properties" in value &&
    Array.isArray(value.labels)
  );
}

function isNeo4jRelationshipLike(value: Neo4jValue): value is Neo4jRelationshipLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "identity" in value &&
    "type" in value &&
    "properties" in value &&
    "start" in value &&
    "end" in value
  );
}

export function toNeo4jNumber(
  value: number | Neo4jIntegerLike | null | undefined,
  fallback: number,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (value && typeof value.toNumber === "function") {
    const converted = value.toNumber();
    return Number.isFinite(converted) ? converted : fallback;
  }

  return fallback;
}

export function toPlain(value: Neo4jValue): PlainValue {
  if (value && typeof value === "object") {
    if (isNeo4jIntegerLike(value)) {
      return value.toNumber();
    }

    if (Array.isArray(value)) {
      return value.map(toPlain);
    }

    if (isNeo4jNodeLike(value)) {
      return {
        id: String(value.properties.id ?? ""),
        labels: value.labels,
        properties: Object.fromEntries(
          Object.entries(value.properties).map(([key, entryValue]) => [key, toPlain(entryValue)]),
        ),
      };
    }

    if (isNeo4jRelationshipLike(value)) {
      return {
        id: String(value.properties.id ?? ""),
        type: value.type,
        properties: Object.fromEntries(
          Object.entries(value.properties).map(([key, entryValue]) => [key, toPlain(entryValue)]),
        ),
      };
    }

    const plainRecord: { [key: string]: PlainValue } = {};
    for (const [key, entryValue] of Object.entries(value)) {
      plainRecord[key] = toPlain(entryValue);
    }
    return plainRecord;
  }

  return value;
}
