import { z } from "zod";

/**
 * A type which represents all the simple Zod types
 * that do not require special handling.
 */
export type SimpleSupportedZodTypes =
  | z.ZodBoolean
  | z.ZodNumber
  | z.ZodString
  | z.ZodArray<any>;

/**
 * A type which represents all the supported Zod types
 * that do not require special handling.
 *
 * Other special types like ZodUnion, ZodIntersection, etc.
 * require special handling and are not included in this type.
 *
 * TODO: Add support for missing Zod types.
 */
export type BaseSupportedZodTypes =
  | SimpleSupportedZodTypes
  | z.ZodRecord<any, any>
  | z.ZodObject<any, any> // Zod v4 uses two arguments 👈
  | z.ZodTuple<[any, ...any[]]>;

/**
 * A type which represents all the supported Zod types
 * that require special handling because they are composed
 * of multiple Zod types.
 *
 * TODO: Add support for missing Zod types.
 */
export type AdvancedSupportedZodTypes =
  | z.ZodPipe<any, any> // Zod v4 uses transforms instead of obsolete zodEffects 👈
  | z.ZodDefault<any>
  | z.ZodOptional<any>
  | z.ZodUnion<any>
  | z.ZodIntersection<any, any>;

/**
 * A type which represents all the supported Zod types.
 */
export type SupportedZodTypes =
  | BaseSupportedZodTypes
  | AdvancedSupportedZodTypes;

// Some utilities type to help with the default getter map.
type BaseDefaultGetter = () => unknown;
type AdvancedDefaultGetter<T extends SupportedZodTypes> = (field: T) => unknown;
type DefaultGetter<T extends SupportedZodTypes> =
  T extends SimpleSupportedZodTypes
  ? BaseDefaultGetter
  : AdvancedDefaultGetter<T>;
// In Zod v4, internal structure changed (_def is now _zod.def). 👈
// This type is used for constructor name comparison, not actual instantiation.
type ZodTypeConstructor<T extends z.ZodType> = new (
  ...args: any[]
) => T;

// Cannot use instanceof, because users might use different
// Zod version, this utility helps with that.
const isOfType = <T extends SupportedZodTypes>(
  element: SupportedZodTypes,
  type: ZodTypeConstructor<T>,
): element is T => element.constructor.name === type.name;

const defaultZodValueGetterMap = new Map<
  string,
  DefaultGetter<SupportedZodTypes>
>();

// Simple types
defaultZodValueGetterMap.set(z.ZodBoolean.name, () => false);
defaultZodValueGetterMap.set(z.ZodNumber.name, () => 0);
defaultZodValueGetterMap.set(z.ZodString.name, () => "");
defaultZodValueGetterMap.set(z.ZodArray.name, () => []);
defaultZodValueGetterMap.set(z.ZodRecord.name, () => ({}));

// Custom default value
defaultZodValueGetterMap.set(z.ZodDefault.name, (f: z.ZodDefault<any>) =>
  f.def.defaultValue,
);

// In Zod v4, ZodEffects was replaced with ZodPipe for transforms 👈
// ZodPipe wraps the input schema, so we need to unwrap it
defaultZodValueGetterMap.set(z.ZodPipe.name, (f: z.ZodPipe<any, any>) =>
  getSchemaDefaultForField(f.def.in),
);

// Optional might have a default value. Casted so we can keep using isOfType() 👈
defaultZodValueGetterMap.set(z.ZodOptional.name, (f: z.ZodOptional<any>) =>
  isOfType<z.ZodDefault<SupportedZodTypes>>(
    f.def.innerType as SupportedZodTypes,
    z.ZodDefault as any, // Cast to bypass the type mismatch
  )
    ? (f.def.innerType as z.ZodDefault<SupportedZodTypes>).def.defaultValue
    : undefined,
);

// Tuples are combination of multiple types
defaultZodValueGetterMap.set(z.ZodTuple.name, (f: z.ZodTuple<any>) => {
  const tuple: unknown[] = [];
  for (const item of f.def.items as SupportedZodTypes[]) {
    tuple.push(getSchemaDefaultForField(item));
  }
  return tuple;
});

// All pipe types should recursively call getSchemaDefaultForField() on the input schema 👈
defaultZodValueGetterMap.set(z.ZodPipe.name, (f: z.ZodPipe<any, any>) =>
  getSchemaDefaultForField(f.def.in as SupportedZodTypes),
);
defaultZodValueGetterMap.set(z.ZodUnion.name, (f: z.ZodUnion<any>) =>
  getSchemaDefaultForField((f.def.options as SupportedZodTypes[])[0]),
);
defaultZodValueGetterMap.set(z.ZodObject.name, (f: z.ZodObject<any>) =>
  getSchemaDefaultForObject(f),
);
defaultZodValueGetterMap.set(z.ZodRecord.name, (f: z.ZodRecord<any>) =>
  getSchemaDefaultForObject(f),
);
defaultZodValueGetterMap.set(
  z.ZodIntersection.name,
  (f: z.ZodIntersection<any, any>) => getSchemaDefaultForObject(f),
);

/**
 * Based on the provided type of the field, returns either the defined
 * default value (if any) or a default "empty" value.
 * @param field The field of a Zod schema for which to retrieve a default value.
 * @returns The default value based on the type of the field provided.
 */
function getSchemaDefaultForField<T extends SupportedZodTypes>(
  field: T,
): z.infer<T> | undefined {
  const typeKey = field.constructor.name;
  if (!defaultZodValueGetterMap.has(typeKey)) {
    console.warn(
      "getSchemaDefaultForField: Unhandled type",
      field.constructor.name,
    );

    return undefined;
  }

  const getter = defaultZodValueGetterMap.get(typeKey);
  // TODO: Fix the typing to avoid the ts-expect-error
  // @ts-expect-error Dynamic map of types is throwing TypeScript
  return getter(field) as z.infer<T>;
}

/**
 * Get the default values of an object-like field.
 * Recursively-called on object-like fields.
 *
 * @param schema The schema for which to retrieve the default values.
 * @returns An object matching the schema with default "empty" values.
 */
function getSchemaDefaultForObject<T extends SupportedZodTypes>(
  schema: T,
): z.infer<T> | Record<string, never> {
  if (isOfType<z.ZodRecord<any, any>>(schema, z.ZodRecord as any)) {
    return {};
  }

  if (
    isOfType<
      z.ZodPipe<
        z.ZodObject<any> | z.ZodUnion<any> | z.ZodIntersection<any, any>
      >
    >(schema, z.ZodPipe as any)
  ) {
    return getSchemaDefaultForObject(schema.def.in);
  }

  if (
    isOfType<z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>>(
      schema,
      z.ZodIntersection as any,
    )
  ) {
    return {
      ...getSchemaDefaultForObject(schema.def.left as SupportedZodTypes),
      ...getSchemaDefaultForObject(schema.def.right as SupportedZodTypes),
    } as z.infer<T>;
  }

  if (
    isOfType<z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>>(schema, z.ZodUnion as any)
  ) {
    for (const option of schema.def.options) {
      if (isOfType<z.ZodObject<any, any>>(option as SupportedZodTypes, z.ZodObject as any)) {
        return getSchemaDefaultForObject(option as SupportedZodTypes) as z.infer<T>;
      }
    }

    console.warn(
      "getSchemaDefaultObject: No object found in union, returning empty object",
    );
    return {};
  }

  if (!isOfType<z.ZodObject<any, any>>(schema, z.ZodObject as any)) {
    console.warn(
      `getSchemaDefaultObject: Expected object schema, got ${schema.constructor.name}`,
    );
    return {};
  }

  return Object.fromEntries(
    Object.entries(schema.shape as Record<string, SupportedZodTypes>)
      .map(([key, field]) => [key, getSchemaDefaultForField(field)])
      .filter((entry) => entry[1] !== undefined),
  ) as z.infer<T>;
}

/**
 * Returns the default values as an object for the provided schema.
 *
 * For example, given the following schema:
 * ```typescript
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   isStudent: z.boolean().default(true),
 * });
 * ```
 *
 * The default object would be:
 * ```json
 * {
 *   name: "",
 *   age: 0,
 *   isStudent: true
 * }
 * ```
 * Note the default value for `isStudent` is `true` because it is specified in
 * the schema.
 *
 * @param schema
 */
export function getDefaultsForSchema<
  T extends
  | z.ZodObject<any>
  | z.ZodUnion<any>
  | z.ZodIntersection<any, any>
  | z.ZodPipe<
    z.ZodObject<any, any> | z.ZodUnion<any> | z.ZodIntersection<any, any>,
    any
  >,
>(schema: T): z.infer<T> {
  return getSchemaDefaultForObject(schema) as z.infer<T>;
}
