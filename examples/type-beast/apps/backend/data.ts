import { default as a, ClientSchema, defineData } from 'type-beast';

const schema = a.schema({
  Blog: a
    .model({
      id: a.id(),
      title: a.string(),
      posts: a.hasMany('Post'),
    })
    .identifier(['id']),
  Post: a
    .model({
      id: a.id(),
      title: a.string(),
      summary: a.string().optional(),
      viewCount: a.integer().optional(),
      comments: a.hasMany('Comment'),
    })
    .identifier(['id'])
    .authorization([a.allow.public()]),
  Comment: a.model({
    id: a.id(),
    bingo: a.string(),
    anotherField: a.string().optional(),
    subComments: a.hasMany('SubComment'),
    post: a.belongsTo('Post'),
  }),
  SubComment: a.model({
    id: a.id(),
    bingo: a.string(),
    anotherField: a.string().optional(),
    subSubComments: a.hasMany('SubSubComment'),
  }),
  SubSubComment: a.model({
    id: a.id(),
    bingo: a.string(),
    anotherField: a.string().optional(),
  }),
});

// Can we surfce an error here if relationship is referencing nonexistent model
// i.e. if I make a typo a.hasMany('Comments') instead of 'Comment'
export type Schema = ClientSchema<typeof schema>;

export default defineData({
  schema,
});
