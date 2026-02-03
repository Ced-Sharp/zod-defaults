import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getDefaultsForSchema } from "../src";

describe("Zod Defaults", () => {
  it("should return undefined for unsupported zod field types", () => {
    const schema = z.object({ unsupported: z.unknown() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(schemaDefaults.unsupported).toBe(undefined);
  });

  it("should correctly return a default value for a boolean field", () => {
    const schema = z.object({ success: z.boolean() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.success).toBe("boolean");
    expect(schemaDefaults.success).toBe(false);
  });

  it("should correctly return a default value for a number field", () => {
    const schema = z.object({ count: z.number() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.count).toBe("number");
    expect(schemaDefaults.count).toBe(0);
  });

  it("should correctly return a default value for a string field", () => {
    const schema = z.object({ name: z.string() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.name).toBe("string");
    expect(schemaDefaults.name).toBe("");
  });

  it("should correctly return a default value for a string literal field", () => {
    const schema = z.object({ type: z.literal("alpha") });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.type).toBe("string");
    expect(schemaDefaults.type).toBe("alpha");
  });

  it("should correctly return a default value for multi-string literal field", () => {
    const schema = z.object({ type: z.literal(["alpha", "beta", "gamma"]) });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.type).toBe("string");
    expect(schemaDefaults.type).toBe("alpha");
  });

  it("should correctly return a default value for number literal fields", () => {
    const schema = z.object({ type: z.literal([1, 2, 3]) });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.type).toBe("number");
    expect(schemaDefaults.type).toBe(1);
  });

  it("should correctly return a default value for an array field", () => {
    const schema = z.object({ options: z.array(z.string()) });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(Array.isArray(schemaDefaults.options)).toBe(true);
    expect(schemaDefaults.options).toStrictEqual([]);
  });

  it("should correctly omit optional field values from defaults", () => {
    const schema = z.object({ name: z.string().optional() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.name).toBe("undefined");
    expect(Object.keys(schemaDefaults).indexOf("name")).toBe(-1);
  });

  it("should correctly return a default value for an optional field that has defined a default value", () => {
    const schema = z.object({ name: z.string().default("John").optional() });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.name).toBe("string");
    expect(schemaDefaults.name).toBe("John");
  });

  it("should correctly return a default value for the first value of an union field", () => {
    // string first
    const schema = z.object({
      id: z.string().or(z.number()),
    });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.id).toBe("string");
    expect(schemaDefaults.id).toBe("");

    // number first
    const schema2 = z.object({
      id: z.number().or(z.string()),
    });
    const schemaDefaults2 = getDefaultsForSchema(schema2);
    expect(typeof schemaDefaults2.id).toBe("number");
    expect(schemaDefaults2.id).toBe(0);
  });

  it("should correctly return a default value for an union field with at least one object as the schema", () => {
    const schema = z.string().or(z.object({ name: z.string() }));
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults).toBe("object");
    expect(Array.isArray(schemaDefaults)).toBe(false);
    expect(schemaDefaults).toStrictEqual({ name: "" });
  });

  it("should return an empty object when providing an union with no objects as the schema", () => {
    const schema = z.string().or(z.number());
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(Array.isArray(schemaDefaults)).toBe(false);
    expect(schemaDefaults).toStrictEqual({});
  });

  it("should correctly return a default value for a tuple field", () => {
    const schema = z.object({
      user: z.tuple([z.string(), z.number(), z.boolean()]),
    });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(Array.isArray(schemaDefaults.user)).toBe(true);
    expect(schemaDefaults.user).toStrictEqual(["", 0, false]);
  });

  it("should correctly return a default value for an object field (nested)", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.user).toBe("object");
    expect(Array.isArray(schemaDefaults.user)).toBe(false);
    expect(schemaDefaults.user).toStrictEqual({ name: "", age: 0 });
  });

  it("should correctly return a default value for a record field", () => {
    const schema = z.object({
      users: z.record(z.string(), z.string()),
    });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.users).toBe("object");
    expect(Array.isArray(schemaDefaults.users)).toBe(false);
    expect(schemaDefaults.users).toStrictEqual({});
  });

  it("should correctly return a default value composed from all of the values of an intersection field", () => {
    const type1 = z.object({
      name: z.string(),
    });
    const type2 = z.object({
      age: z.number(),
    });

    const schema = z.object({
      user: type1.and(type2),
    });

    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.user).toBe("object");
    expect(Array.isArray(schemaDefaults.user)).toBe(false);
    expect(schemaDefaults.user).toStrictEqual({ name: "", age: 0 });
  });

  it("should correctly return a default value composed from all the values of an intersection field (nested)", () => {
    const type1 = z.object({
      name: z.string(),
    });
    const type2 = z.object({
      age: z.number(),
    });
    const type3 = z.object({
      isStudying: z.boolean(),
    });

    const schema = z.object({
      user: type1.and(type2).and(type3),
    });

    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.user).toBe("object");
    expect(Array.isArray(schemaDefaults.user)).toBe(false);
    expect(schemaDefaults.user).toStrictEqual({
      name: "",
      age: 0,
      isStudying: false,
    });
  });

  it("should correctly return a default value for a tuple field composed of complex fields (nested)", () => {
    const schema = z.object({
      user: z.tuple([
        z.object({
          name: z.string(),
        }),
        z.tuple([z.object({ age: z.number() }), z.boolean()]),
      ]),
    });
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(Array.isArray(schemaDefaults.user)).toBe(true);
    expect(schemaDefaults.user).toStrictEqual([
      { name: "" },
      [{ age: 0 }, false],
    ]);
  });

  it("should correctly return a default value for fields that have effects (like .refine())", () => {
    const schema = z.object({
      name: z
        .string()
        .refine((val) => val === "John", { message: "Name must be John" }),
    });

    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.name).toBe("string");
    expect(schemaDefaults.name).toBe("");
  });

  it("should correctly return a default value for fields that have a default value", () => {
    const schema = z.object({
      name: z.string().default("John"),
    });

    const schemaDefaults = getDefaultsForSchema(schema);
    expect(typeof schemaDefaults.name).toBe("string");
    expect(schemaDefaults.name).toBe("John");
  });

  it("should fail to retrieve default values for a schema that is not an object", () => {
    const schema = z.string();
    // @ts-expect-error Testing invalid schema values for JS users
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(schemaDefaults).toStrictEqual({});
  });

  it("should correctly return a default value for schemas that have a .refine()", () => {
    const schema = z.object({ username: z.string() }).refine(() => true);
    const schemaDefaults = getDefaultsForSchema(schema);
    expect(schemaDefaults).toStrictEqual({ username: "" });
  });
});
