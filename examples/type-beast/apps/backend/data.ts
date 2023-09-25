import { default as a, ClientSchema, defineData } from 'type-beast';

const schema = a.schema({
  Post: a
    .model({
      postId: a.id(),
      title: a.string(),
      summary: a.string().optional(),
      viewCount: a.integer().optional(),
      comments: a.hasMany('Comment'),
      author: a.hasOne('User'),
      tags: a.manyToMany('Tag', { connectionName: 'PostTags' }),
    })
    .identifier(['postId', 'title'])
    .authorization([a.allow.public()]),
  Comment: a
    .model({
      id: a.id(),
      bingo: a.string(),
      anotherField: a.string().optional(),
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
  Tag: a
    .model({
      id: a.id(),
      name: a.string(),
      posts: a.manyToMany('Post', { connectionName: 'PostTags' }),
    })
    .authorization([a.allow.public()]),
});

// Can we surfce an error here if relationship is referencing nonexistent model
// i.e. if I make a typo a.hasMany('Comments') instead of 'Comment'
export type Schema = ClientSchema<typeof schema>;

export default defineData({
  schema,
});
