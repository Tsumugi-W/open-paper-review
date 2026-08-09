/**
 * Utility functions for provider adapters.
 */

import type { z } from "zod";

/**
 * Convert a Zod schema to a JSON Schema object suitable for API consumption.
 * This is a minimal implementation covering common Zod types used in structured outputs.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return zodTypeToJsonSchema(schema);
}

function zodTypeToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodString":
      return { type: "string" };

    case "ZodNumber":
      return { type: "number" };

    case "ZodBoolean":
      return { type: "boolean" };

    case "ZodNull":
      return { type: "null" };

    case "ZodArray": {
      const itemSchema = def.type as z.ZodType;
      return {
        type: "array",
        items: zodTypeToJsonSchema(itemSchema),
      };
    }

    case "ZodObject": {
      const shape = (def.shape as () => Record<string, z.ZodType>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodTypeToJsonSchema(value);
        // Check if it's optional
        const valueDef = (value as unknown as { _def: Record<string, unknown> })
          ._def;
        if (valueDef.typeName !== "ZodOptional") {
          required.push(key);
        }
      }

      const result: Record<string, unknown> = {
        type: "object",
        properties,
      };
      if (required.length > 0) {
        result.required = required;
      }
      return result;
    }

    case "ZodOptional": {
      const innerSchema = def.innerType as z.ZodType;
      return zodTypeToJsonSchema(innerSchema);
    }

    case "ZodNullable": {
      const innerSchema = def.innerType as z.ZodType;
      const inner = zodTypeToJsonSchema(innerSchema);
      return { anyOf: [inner, { type: "null" }] };
    }

    case "ZodEnum": {
      const values = def.values as string[];
      return { type: "string", enum: values };
    }

    case "ZodLiteral": {
      const value = def.value;
      return { type: typeof value, const: value };
    }

    case "ZodUnion": {
      const options = (def.options as z.ZodType[]).map(zodTypeToJsonSchema);
      return { anyOf: options };
    }

    case "ZodRecord": {
      const valueSchema = def.valueType as z.ZodType;
      return {
        type: "object",
        additionalProperties: zodTypeToJsonSchema(valueSchema),
      };
    }

    case "ZodDefault": {
      const innerSchema = def.innerType as z.ZodType;
      const inner = zodTypeToJsonSchema(innerSchema);
      return { ...inner, default: def.defaultValue };
    }

    case "ZodEffects": {
      // Refinements, transforms - use the inner schema
      const innerSchema = def.schema as z.ZodType;
      return zodTypeToJsonSchema(innerSchema);
    }

    default:
      // Fallback for unknown types
      return {};
  }
}
