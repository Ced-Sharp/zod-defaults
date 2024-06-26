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
  | z.ZodObject<any, any, any, any, any>
  | z.ZodTuple<[any, ...any[]]>;

/**
 * A type which represents all the supported Zod types
 * that require special handling because they are composed
 * of multiple Zod types.
 *
 * TODO: Add support for missing Zod types.
 */
export type AdvancedSupportedZodTypes =
  | z.ZodEffects<any>
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
type ZodTypeConstructor<T extends z.ZodTypeAny> = new (
  definition: Extract<T, { _def: z.ZodAnyDef }>["_def"],
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
  f._def.defaultValue(),
);

// Effects is just a wrapper of another type
defaultZodValueGetterMap.set(z.ZodEffects.name, (f: z.ZodEffects<any>) =>
  getSchemaDefaultForField(f._def.schema),
);

// Optional might have a default value
defaultZodValueGetterMap.set(z.ZodOptional.name, (f: z.ZodOptional<any>) =>
  isOfType<z.ZodDefault<SupportedZodTypes>>(
    f._def.innerType as SupportedZodTypes,
    z.ZodDefault,
  )
    ? (f._def.innerType as z.ZodDefault<SupportedZodTypes>)._def.defaultValue()
    : undefined,
);

// Tuples are combination of multiple types
defaultZodValueGetterMap.set(z.ZodTuple.name, (f: z.ZodTuple<any>) => {
  const tuple: unknown[] = [];
  for (const item of f._def.items as SupportedZodTypes[]) {
    tuple.push(getSchemaDefaultForField(item));
  }
  return tuple;
});

// All object types should recursively call getSchemaDefaultObject()
defaultZodValueGetterMap.set(z.ZodEffects.name, (f: z.ZodEffects<any>) =>
  getSchemaDefaultForField(f._def.schema as SupportedZodTypes),
);
defaultZodValueGetterMap.set(z.ZodUnion.name, (f: z.ZodUnion<any>) =>
  getSchemaDefaultForField((f._def.options as SupportedZodTypes[])[0]),
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
  if (isOfType<z.ZodRecord<z.ZodTypeAny>>(schema, z.ZodRecord)) {
    return {};
  }

  if (
    isOfType<
      z.ZodEffects<
        z.ZodObject<any> | z.ZodUnion<any> | z.ZodIntersection<any, any>
      >
    >(schema, z.ZodEffects)
  ) {
    return getSchemaDefaultForObject(schema._def.schema);
  }

  if (
    isOfType<z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>>(
      schema,
      z.ZodIntersection,
    )
  ) {
    return {
      ...getSchemaDefaultForObject(schema._def.left as SupportedZodTypes),
      ...getSchemaDefaultForObject(schema._def.right as SupportedZodTypes),
    } as z.infer<T>;
  }

  if (
    isOfType<z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>>(schema, z.ZodUnion)
  ) {
    for (const option of schema._def.options) {
      if (isOfType<z.ZodObject<z.ZodRawShape>>(option, z.ZodObject)) {
        return getSchemaDefaultForObject(option) as z.infer<T>;
      }
    }

    console.warn(
      "getSchemaDefaultObject: No object found in union, returning empty object",
    );
    return {};
  }

  if (!isOfType<z.ZodObject<z.ZodRawShape>>(schema, z.ZodObject)) {
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
    | z.ZodEffects<
        z.ZodObject<any> | z.ZodUnion<any> | z.ZodIntersection<any, any>
      >,
>(schema: T): z.infer<T> {
  return getSchemaDefaultForObject(schema);
}
