import { Prettify, SetTypeSubArg } from './util';

export enum ModelRelationshipTypes {
  hasOne = 'hasOne',
  hasMany = 'hasMany',
  belongsTo = 'belongsTo',
  manyToMany = 'manyToMany',
}

type RelationshipTypes = `${ModelRelationshipTypes}`;

const arrayTypeRelationships = ['hasMany', 'manyToMany'];

type ModelRelationalFieldData = {
  fieldType: 'model';
  type: ModelRelationshipTypes;
  relatedModel: string;
  array: boolean;
  valueOptional: boolean;
  arrayOptional: boolean;
  connectionName?: string;
};

export type ModelRelationalFieldParamShape = {
  type: 'model';
  relationshipType: string;
  relatedModel: string;
  valueOptional: boolean;
  array: boolean;
  arrayOptional: boolean;
  connectionName?: string;
};

export type ModelRelationalField<
  T extends ModelRelationalFieldParamShape,
  // RM adds structural separation with ModelField; easier to identify it when mapping to ClientTypes
  RM extends string,
  K extends keyof ModelRelationalField<T, RM> = never
> = Omit<
  {
    valueOptional(): ModelRelationalField<
      SetTypeSubArg<T, 'valueOptional', true>,
      K | 'valueOptional'
    >;
    arrayOptional(): ModelRelationalField<
      SetTypeSubArg<T, 'arrayOptional', true>,
      K | 'arrayOptional'
    >;
  },
  K
>;

/**
 * Internal representation of Model Field that exposes the `data` property.
 * Used at buildtime.
 */
export type InternalRelationalField = ModelRelationalField<
  ModelRelationalFieldParamShape,
  string,
  never
> & {
  data: ModelRelationalFieldData;
};

function _modelRelationalField<
  T extends ModelRelationalFieldParamShape,
  RelatedModel extends string,
  RT extends ModelRelationshipTypes
>(type: RT, relatedModel: RelatedModel, connectionName?: string) {
  const data: ModelRelationalFieldData = {
    relatedModel,
    type,
    fieldType: 'model',
    array: false,
    valueOptional: false,
    arrayOptional: false,
    connectionName,
  };

  if (arrayTypeRelationships.includes(type)) {
    data.array = true;
  }

  const builder: ModelRelationalField<T, RelatedModel> = {
    valueOptional() {
      data.valueOptional = true;

      return this;
    },
    arrayOptional() {
      data.arrayOptional = true;

      return this;
    },
  };

  return {
    ...builder,
    data,
  } as InternalRelationalField as ModelRelationalField<T, RelatedModel>;
}

export type ModelRelationalTypeArgFactory<
  RM extends string,
  RT extends RelationshipTypes,
  IsArray extends boolean,
  ConnectionName extends string | undefined = undefined
> = {
  type: 'model';
  relatedModel: RM;
  relationshipType: RT;
  array: IsArray;
  valueOptional: false;
  arrayOptional: false;
  connectionName: ConnectionName;
};

export function hasOne<RM extends string>(relatedModel: RM) {
  return _modelRelationalField<
    ModelRelationalTypeArgFactory<RM, ModelRelationshipTypes.hasOne, false>,
    RM,
    ModelRelationshipTypes.hasOne
  >(ModelRelationshipTypes.hasOne, relatedModel);
}

export function hasMany<RM extends string>(relatedModel: RM) {
  return _modelRelationalField<
    ModelRelationalTypeArgFactory<RM, ModelRelationshipTypes.hasMany, true>,
    RM,
    ModelRelationshipTypes.hasMany
  >(ModelRelationshipTypes.hasMany, relatedModel);
}

export function belongsTo<RM extends string>(relatedModel: RM) {
  return _modelRelationalField<
    ModelRelationalTypeArgFactory<RM, ModelRelationshipTypes.belongsTo, false>,
    RM,
    ModelRelationshipTypes.belongsTo
  >(ModelRelationshipTypes.belongsTo, relatedModel);
}

export function manyToMany<RM extends string, CN extends string>(
  relatedModel: RM,
  opts: { connectionName: CN }
) {
  return _modelRelationalField<
    ModelRelationalTypeArgFactory<
      RM,
      ModelRelationshipTypes.manyToMany,
      true,
      CN
    >,
    RM,
    ModelRelationshipTypes.manyToMany
  >(ModelRelationshipTypes.manyToMany, relatedModel, opts.connectionName);
}