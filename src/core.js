/**
 * OpenTelemetry Attribute Sanitizer
 * Validates and coerces key-value attribute pairs against OpenTelemetry semantic type constraints.
 */

/**
 * OpenTelemetry attribute values can be primitives (string, number, boolean) or
 * homogeneous arrays of those primitives. A heterogeneous array is invalid.
 *
 * The non-finite numbers NaN, Infinity, and -Infinity are rejected because
 * the OTLP specification encodes attributes as protobuf `double` for numeric
 * values, and these values are not portable across all transport encodings
 * (notably JSON encoders commonly choke on bare `NaN`/`Infinity`).
 */

/**
 * A valid attribute value is a string, a finite number, a boolean, a BigInt,
 * or a homogeneous array of one of those primitive types.
 *
 * BigInt is coerced to a finite Number if it is within the safe-integer range.
 * BigInts outside that range are dropped to avoid silent precision loss.
 */

const SAFE_INT_MAX = Number.MAX_SAFE_INTEGER;
const SAFE_INT_MIN = Number.MIN_SAFE_INTEGER;

/**
 * Returns true if a key is a non-empty string of printable ASCII characters
 * excluding the space (U+0020). OTLP forbids characters outside U+0021–U+007E.
 * We check code points directly to keep the function allocation-free.
 */
export function isAttributeKeyValid(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return false;
  }
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    if (c < 0x21 || c > 0x7e) {
      return false;
    }
  }
  return true;
}

/**
 * Coerce a single primitive value to a valid OTel scalar or return null if it
 * cannot be represented. Arrays are handled separately by `sanitizeAttribute`.
 */
export function coerceValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    return null;
  }
  if (typeof value === 'bigint') {
    // Coerce BigInt within the safe-integer range so precision is preserved
    // when the value is later serialized as a `double`. Outside that range,
    // drop the value rather than silently losing precision.
    if (value <= BigInt(SAFE_INT_MAX) && value >= BigInt(SAFE_INT_MIN)) {
      return Number(value);
    }
    return null;
  }
  return null;
}

function hasMixedTypes(arr) {
  if (arr.length === 0) return true;
  const first = primitiveType(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    if (primitiveType(arr[i]) !== first) {
      return true;
    }
  }
  return false;
}

function primitiveType(v) {
  if (typeof v === 'bigint') return 'number';
  return typeof v;
}

function isCoerciblePrimitive(v) {
  return v !== null && v !== undefined && (
    typeof v === 'boolean' ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'bigint'
  );
}

/**
 * Validate and coerce a single attribute entry against OTel constraints.
 * Returns the coerced value, or null if the entry is invalid (bad key or
 * unrepresentable value). Callers are expected to drop null results.
 */
export function sanitizeAttribute(key, value) {
  if (!isAttributeKeyValid(key)) {
    return null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    // OTel requires homogeneous arrays. An empty array is treated as invalid
    // because no element type can be inferred for the field descriptor.
    if (value.length === 0) {
      return null;
    }
    if (hasMixedTypes(value)) {
      return null;
    }
    const out = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (!isCoerciblePrimitive(item)) {
        return null;
      }
      const coerced = coerceValue(item);
      if (coerced === null) {
        return null;
      }
      out.push(coerced);
    }
    return out;
  }
  if (!isCoerciblePrimitive(value)) {
    return null;
  }
  return coerceValue(value);
}

/**
 * Sanitize a map of attributes. Invalid keys and values are silently dropped
 * because OpenTelemetry instrumentation must never throw into host code paths.
 * The returned object is a fresh copy; the input is never mutated.
 */
export function sanitizeAttributes(input) {
  const out = {};
  if (input === null || typeof input !== 'object') {
    return out;
  }
  for (const key of Object.keys(input)) {
    const v = sanitizeAttribute(key, input[key]);
    if (v !== null && v !== undefined) {
      out[key] = v;
    }
  }
  return out;
}
