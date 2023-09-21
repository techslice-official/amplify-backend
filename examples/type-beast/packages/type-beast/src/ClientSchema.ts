import type { ImpliedAuthFields } from './Authorization';
import type {
  Prettify,
  UnionToIntersection,
  ExcludeEmpty,
  ObjectIsNonEmpty,
} from './util';
import type { ModelField } from './ModelField';
import type {
  ModelRelationalField,
  ModelRelationalFieldParamShape,
} from './ModelRelationalField';
import type { ModelType } from './ModelType';
import type { ModelSchema } from './ModelSchema';
import { __modelMeta__ } from '@aws-amplify/types-package-alpha';

/**
 * Types for unwrapping generic type args into client-consumable types
 *
 * @typeParam Schema - Type Beast schema type
 *
 * The following params are used solely as variables in order to simplify mapped type usage.
 * They should not receive external type args.
 *
 * @typeParam Fields - flattened Schema/Models/Fields structure with field type params extracted
 * @typeParam FieldsWithRelationships - Fields + resolved relational fields
 * @typeParam ResolvedFields - optionality enforced on nullable types (+?); These are the client-facing types used for CRUDL response shapes
 *
 * @typeParam Meta - Stores schema metadata: identifier, relationship metadata;
 * used by `API.generateClient` to craft strongly typed mutation inputs; hidden from customer-facing types behind __modelMeta__ symbol
 *
 */
export type ClientSchema<
  Schema extends ModelSchema<any>,
  // Todo: rename Fields to FlattenedSchema
  Fields = FieldTypes<ModelTypes<SchemaTypes<Schema>>>,
  FieldsWithRelationships = ResolveRelationships<Fields>,
  ResolvedFields = Intersection<
    FilterFieldTypes<RequiredFieldTypes<FieldsWithRelationships>>,
    FilterFieldTypes<OptionalFieldTypes<FieldsWithRelationships>>,
    FilterFieldTypes<ModelImpliedAuthFields<Schema>>
  >,
  IdentifierMeta = ModelMeta<SchemaTypes<Schema>>,
  RelationshipMeta = ExtractRelationalMetadata<
    Fields,
    ResolvedFields,
    IdentifierMeta
  >,
  Meta = IdentifierMeta & RelationshipMeta
> = Prettify<
  ResolvedFields & {
    [__modelMeta__]: Meta;
  }
>;

/* 
  Checks if `RelatedModel` has a HasMany relationship to `ModelName`
  We only generate FK fields for bi-directional hasOne. For HasMany relationships the existing FK is re-used to establish the relationship
  This util type lets us make that decision
*/
type IsBidirectionalHasMany<
  ModelName extends string,
  RelatedModelFields
  // If the object IS empty, that means RelatedModelFields does not have a HasMany relationship to ModelName
> = ObjectIsNonEmpty<{
  [Field in keyof RelatedModelFields as RelatedModelFields[Field] extends ModelRelationalFieldParamShape & {
    relationshipType: 'hasMany';
    relatedModel: ModelName;
  }
    ? Field
    : never]: RelatedModelFields[Field];
}>;

type ComputedRelationalField<
  ModelName extends string,
  Field extends string,
  ResolvedField,
  IdentifierMeta extends { [modelName: string]: { identifier: string } }
> = `${Lowercase<ModelName>}${Capitalize<Field>}${Capitalize<
  ResolvedField extends ModelRelationalFieldParamShape
    ? ResolvedField['relationshipType'] extends 'hasMany'
      ? IdentifierMeta[ModelName]['identifier'] & string
      : IdentifierMeta[ResolvedField['relatedModel']]['identifier']
    : never
>}`;

type ExtractRelationalMetadata<
  FlattenedSchema,
  ResolvedFields,
  IdentifierMeta
> = UnionToIntersection<
  ExcludeEmpty<
    {
      [ModelName in keyof FlattenedSchema]: {
        [Field in keyof FlattenedSchema[ModelName] as FlattenedSchema[ModelName][Field] extends ModelRelationalFieldParamShape
          ? FlattenedSchema[ModelName][Field]['relationshipType'] extends 'hasMany'
            ? // For hasMany we're adding metadata to the related model
              // E.g. if Post hasMany Comments, we need to add a postCommentsId field to the Comment model
              FlattenedSchema[ModelName][Field]['relatedModel']
            : FlattenedSchema[ModelName][Field]['relationshipType'] extends 'hasOne'
            ? // For hasOne we're adding metadata to the model itself
              // E.g. if Post hasOne Author, we need to add a postAuthorId field to the Post model
              ModelName
            : // For belongsTo there are some nuances - we only add an additional field for bidirectional HasOne relationships
            // For bi-directional HasMany, we rely on the existing generated field and don't need to add an additional one to the child model
            FlattenedSchema[ModelName][Field]['relationshipType'] extends 'belongsTo'
            ? FlattenedSchema[ModelName][Field]['relatedModel'] extends keyof FlattenedSchema
              ? IsBidirectionalHasMany<
                  ModelName & string,
                  FlattenedSchema[FlattenedSchema[ModelName][Field]['relatedModel']]
                > extends false // IsBidirectionalHasMany returns false if the parent model doesn't have a hasMany relationship to ModelName
                ? ModelName
                : never
              : never
            : never
          : never]: FlattenedSchema[ModelName][Field] extends ModelRelationalFieldParamShape
          ? ModelName extends keyof ResolvedFields
            ? {
                relationships: Partial<
                  Record<
                    ComputedRelationalField<
                      ModelName & string,
                      Field & string,
                      FlattenedSchema[ModelName][Field],
                      IdentifierMeta & {
                        [modelName: string]: { identifier: string };
                      }
                    >,
                    string
                  >
                >;
              }
            : never
          : never;
      };
    }[keyof FlattenedSchema]
  >
>;

type SchemaTypes<T> = T extends ModelSchema<infer R> ? R['models'] : never;

type ModelTypes<Schema> = {
  [Property in keyof Schema]: Schema[Property] extends ModelType<infer R, any>
    ? R['fields']
    : never;
};

type ModelMeta<T> = {
  [Property in keyof T]: T[Property] extends ModelType<infer R, any>
    ? // reduce back to union
      R['identifier'] extends any[]
      ? { identifier: R['identifier'][number] }
      : never
    : never;
};

type ModelImpliedAuthFields<Schema extends ModelSchema<any>> = {
  [ModelKey in keyof Schema['data']['models']]: Schema['data']['models'][ModelKey] extends ModelType<
    infer A,
    any
  >
    ? ImpliedAuthFields<A['authorization'][number]>
    : never;
};

/**
 * infer and massage field types
 */

type GetRelationshipRef<
  T,
  RM extends keyof T,
  TypeArg extends ModelRelationalFieldParamShape,
  ResolvedModel = ResolveRelationalFieldsForModel<T, RM>,
  Model = TypeArg['valueOptional'] extends true
    ? ResolvedModel | null | undefined
    : ResolvedModel,
  Value = TypeArg['array'] extends true
    ? TypeArg['arrayOptional'] extends true
      ? Array<Model> | null | undefined
      : Array<Model>
    : Model
  // future: we can add an arg here for pagination and other options
> = () => Promise<Prettify<Value>>;

type ResolveRelationalFieldsForModel<Schema, ModelName extends keyof Schema> = {
  [FieldName in keyof Schema[ModelName]]: Schema[ModelName][FieldName] extends ModelRelationalFieldParamShape
    ? Schema[ModelName][FieldName]['relatedModel'] extends keyof Schema
      ? GetRelationshipRef<
          Schema,
          Schema[ModelName][FieldName]['relatedModel'],
          Schema[ModelName][FieldName]
        >
      : never
    : Schema[ModelName][FieldName];
};

type ResolveRelationships<Schema> = {
  [ModelProp in keyof Schema]: {
    [FieldProp in keyof Schema[ModelProp]]: Schema[ModelProp][FieldProp] extends ModelRelationalFieldParamShape
      ? Schema[ModelProp][FieldProp]['relatedModel'] extends keyof Schema
        ? GetRelationshipRef<
            Schema,
            Schema[ModelProp][FieldProp]['relatedModel'],
            Schema[ModelProp][FieldProp]
          >
        : never // if the field value extends ModelRelationalFieldShape "relatedModel" should always point to a Model (keyof Schema)
      : Schema[ModelProp][FieldProp];
  };
};

type FieldTypes<T> = {
  [ModelProp in keyof T]: {
    [FieldProp in keyof T[ModelProp]]: T[ModelProp][FieldProp] extends ModelRelationalField<
      infer R,
      string,
      never
    >
      ? R
      : T[ModelProp][FieldProp] extends ModelField<infer R, any>
      ? R
      : never;
  };
};

type FilterFieldTypes<Schema> = {
  [ModelProp in keyof Schema]: {
    [FieldProp in keyof Schema[ModelProp] as Schema[ModelProp][FieldProp] extends undefined
      ? never
      : FieldProp]: Schema[ModelProp][FieldProp];
  };
};

type OptionalFieldTypes<Schema> = {
  [ModelProp in keyof Schema]: Partial<{
    [FieldProp in keyof Schema[ModelProp]]: null extends Schema[ModelProp][FieldProp]
      ? Schema[ModelProp][FieldProp]
      : never;
  }>;
};

type RequiredFieldTypes<Schema> = {
  [ModelProp in keyof Schema]: {
    [FieldProp in keyof Schema[ModelProp]]: null extends Schema[ModelProp][FieldProp]
      ? never
      : Schema[ModelProp][FieldProp];
  };
};

type Intersection<A, B, C> = A & B & C extends infer U
  ? { [P in keyof U]: U[P] }
  : never;
