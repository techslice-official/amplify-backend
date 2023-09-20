import { default as a, defineData } from '../index';

import type { ModelSchema } from '../src/ModelSchema';
import { type ModelType } from '../src/ModelType';
import type { ModelField, InternalField } from '../src/ModelField';
import type {
  ModelRelationalField,
  ModelRelationalFieldParamShape,
} from '../src/ModelRelationalField';
import type {
  Prettify,
  UnionToIntersection,
  ExcludeEmpty,
  ObjectIsNonEmpty,
} from '../src/util';
import { __modelMeta__ } from '@aws-amplify/types-package-alpha';
import type { ImpliedAuthFields } from '../src/Authorization';

const schema = a.schema({
  Post: a
    .model({
      id: a.id(),
      title: a.string(),
      summary: a.string().optional(),
      viewCount: a.integer().optional(),
      comments: a.hasMany('Comment'),
      comments2: a.hasMany('Comment'),
      author: a.hasOne('User'),
    })
    .identifier(['id'])
    .authorization([a.allow.public()]),
  Comment: a
    .model({
      id: a.id(),
      bingo: a.string(),
      anotherField: a.string().optional(),
      subComments: a.hasMany('SubComment'),
      post: a.belongsTo('Post'),
    })
    .authorization([a.allow.public()]),
  User: a
    .model({
      id: a.id(),
      name: a.string(),
      post: a.belongsTo('Post'),
    })
    .authorization([a.allow.public()]),
});

type TSchema = typeof schema;
export type Schema = ClientSchema<TSchema>;

type ClientSchema<
  Schema extends ModelSchema<any>,
  // Todo: rename Fields to FlattenedSchema
  Fields = FieldTypes<ModelTypes<SchemaTypes<Schema>>>,
  FieldsWithRelationships = ResolveRelationships<Fields>,
  ResolvedFields = Intersection<
    FilterFieldTypes<RequiredFieldTypes<FieldsWithRelationships>>,
    FilterFieldTypes<OptionalFieldTypes<FieldsWithRelationships>>,
    FilterFieldTypes<ModelImpliedAuthFields<Schema>>
  >,
  Meta = ModelMeta<SchemaTypes<Schema>> &
    ExtractRelationalMetadata<Fields, ResolvedFields>
> = Prettify<
  ResolvedFields & {
    [__modelMeta__]: Meta;
  }
>;

type TFields = FieldTypes<ModelTypes<SchemaTypes<TSchema>>>;
type TFieldsPost = TFields['Post'];

type TFieldsWithRelationships = ResolveRelationships<TFields>;

type TResolvedFields = Intersection<
  FilterFieldTypes<RequiredFieldTypes<TFieldsWithRelationships>>,
  FilterFieldTypes<OptionalFieldTypes<TFieldsWithRelationships>>,
  FilterFieldTypes<ModelImpliedAuthFields<TSchema>>
>;

type MMeta = Schema[typeof __modelMeta__];
type MPost = MMeta['Post'];
type MComment = MMeta['Comment'];
type MUser = MMeta['User'];

/* 
  Checks if `RelatedModel` has a HasMany relationship to `ModelName`
  We only generate FK fields for bi-directional hasOne. For HasMany relationships the existing FK is re-used to establish the relationship
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

type ExtractRelationalMetadata<FlattenedSchema, ResolvedFields> =
  UnionToIntersection<
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
                  > extends true
                  ? never
                  : ModelName
                : never
              : never
            : never]: FlattenedSchema[ModelName][Field] extends ModelRelationalFieldParamShape
            ? ModelName extends keyof ResolvedFields
              ? {
                  relationships: Partial<
                    Record<
                      `${Lowercase<ModelName & string>}${Capitalize<
                        Field & string
                      >}Id`,
                      // possible to pull in the PK field type here instead of string?
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