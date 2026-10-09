# OpenTelemetry Attribute Sanitizer

A small, zero-dependency TypeScript (ESM) library that validates and coerces key-value attribute pairs against OpenTelemetry semantic type constraints.

## Usage

```js
import { sanitizeAttributes, isAttributeKeyValid } from './src/index.js';

const clean = sanitizeAttributes({
  'http.method': 'GET',
  'http.status_code': 200,
  'bad key': 'dropped',
  'nan': NaN,
});
// => { 'http.method': 'GET', 'http.status_code': 200 }
```

Exports: `sanitizeAttributes(input)`, `sanitizeAttribute(key, value)`, `isAttributeKeyValid(key)`, `coerceValue(value)`.

## Why

OpenTelemetry instrumentation runs inside host applications and must never throw. Attribute values can arrive from arbitrary user code as strings, numbers, booleans, arrays, or — awkwardly — `BigInt`. The OTLP transport encodes numeric values as protobuf `double`, so non-finite numbers (`NaN`, `±Infinity`) and out-of-range `BigInt`s would silently corrupt or break serialization. This library drops anything it cannot represent faithfully rather than emitting partial or corrupt data.

## Edges

- **Keys** must be non-empty strings of printable ASCII excluding the space character (`U+0021`–`U+007E`). Unicode keys are dropped.
- **Arrays** must be homogeneous. An empty array is dropped because no element type can be inferred for the field descriptor.
- **BigInt** is coerced to `Number` only when within `Number.MAX_SAFE_INTEGER`; otherwise dropped to avoid silent precision loss. A `BigInt` mixed with a `Number` in an array is treated as homogeneous.
- Invalid keys and values are silently dropped, never thrown.
