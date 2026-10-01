/* A small JSON Schema check for tool inputs: type, required, enum, properties, additionalProperties, items, oneOf.
   Messages name the path and the fix, like the write path's. */
import type { JsonSchema } from "./types";

const typeOf = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
const fits = (t: string, v: unknown) => t === typeOf(v) || (t === "number" && typeof v === "number");
const article = (t: string) => (/^[aeiou]/.test(t) ? `an ${t}` : `a ${t}`);

export function checkInput(schema: JsonSchema, value: unknown, path = ""): string[] {
  const at = path || "input";
  if (schema.oneOf) return schema.oneOf.some((s) => !checkInput(s, value, path).length) ? [] : [`${at}: ${schema.description ?? "does not match any allowed form"}`];
  if (schema.enum) return schema.enum.includes(value) ? [] : [`${at}: must be one of ${schema.enum.join(", ")}`];
  if (schema.type && !fits(schema.type, value)) return [`${at}: must be ${article(schema.type)}`];
  if (schema.type === "number" || schema.type === "integer") {
    const n = value as number;
    if (schema.minimum !== undefined && n < schema.minimum) return [`${at}: at least ${schema.minimum}`];
    if (schema.maximum !== undefined && n > schema.maximum) return [`${at}: at most ${schema.maximum}`];
  }
  if (schema.type === "array" && schema.items) return (value as unknown[]).flatMap((v, i) => checkInput(schema.items as JsonSchema, v, `${path}[${i}]`));
  if (schema.type !== "object" || !schema.properties) return [];
  const obj = value as Record<string, unknown>, props = schema.properties, out: string[] = [];
  for (const k of schema.required ?? []) if (obj[k] === undefined) out.push(`${path ? `${path}.` : ""}${k}: required`);
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (props[k]) out.push(...checkInput(props[k], v, p));
    else if (schema.additionalProperties === false) out.push(`${p}: not a known field (known: ${Object.keys(props).join(", ")})`);
  }
  return out;
}
