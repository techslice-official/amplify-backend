'use client';
import { useState, useEffect } from 'react';
import styles from './client.module.css';
import { Amplify, API } from 'aws-amplify';
// this will be an export from aws-amplify/api
import { SelectionSet } from './utility-types';
import { Schema } from '../../backend/data';
import { default as awsconfig } from '../src/aws-exports';
import { default as modelIntrospection } from '../src/model-introspection.json';

import { __modelMeta__ } from '@aws-amplify/types-package-alpha';

Amplify.configure({
  ...awsconfig,
  API: {
    modelIntrospection,
  },
});

Amplify.Logger.LOG_LEVEL = 'DEBUG';

const client = API.generateClient<Schema>();

type Post = Schema['Post'];

type Comment = Schema['Comment'];
type PostTags = Schema['PostTags'];

type PTMeta = Schema[typeof __modelMeta__]['PostTags'];

async function createPostTag() {
  const post1 = await client.models.Post.create({
    postId: 'postId' + Date.now(),
    title: 'My Post',
  });

  const tag1 = await client.models.Tag.create({
    id: 'tagId' + Date.now(),
    name: 'News',
  });

  // add association between post1 to tag1
  await client.models.PostTags.create({
    post: post1,
    tag: tag1,
  });

  const tag2 = await client.models.Tag.create({
    id: 'tagId' + Date.now(),
    name: 'Popular',
  });

  // add association between post1 to tag2
  await client.models.PostTags.create({
    post: post1,
    tag: tag2,
  });

  // this should be postTags instead
  const pTags = await post1.tags();
  console.log('post tags', pTags);

  const tags = await pTags[0].tag();
  console.log('first tag', tags);
}

export function ClientComponent(): JSX.Element {
  const [res, setRes] = useState<any>();
  const [posts, setPosts] = useState<Post[]>([]);

  const btnHandlers = {
    create: async () => {
      const res = await client.models.Post.create({
        postId: 'post' + Date.now(),
        title: 'My Post',
        author: await client.models.User.create({
          id: 'userId',
          name: 'Bob Dole',
        }),
      });

      const post: Post = res;
      setRes(res);
      setPosts(await client.models.Post.list());
    },
    get: async () => {
      const [latest] = await client.models.Post.list();

      const post = await client.models.Post.get({
        postId: latest.postId,
        title: latest.title,
      });

      console.log('Post', post);

      const [comment] = await post.comments();

      console.log('Post Comment', comment);

      const cPost = await comment.post();

      console.log('C Post', cPost);

      const author = await cPost.author();

      console.log('author', author);

      setRes(post);
    },
    update: async () => {
      const res = await client.models.Post.update({
        postId: 'post1',
        title: 'Updated Post',
      });

      setRes(res);
    },
    delete: async () => {
      const comments = await client.models.Comment.list();
      const posts = await client.models.Post.list();
      const postTags = await client.models.PostTags.list();
      const tags = await client.models.Tag.list();
      const users = await client.models.User.list();

      for (const comment of comments) {
        await client.models.Comment.delete({ id: comment.id });
      }

      for (const user of users) {
        await client.models.User.delete({ id: user.id });
      }

      for (const tag of tags) {
        await client.models.Tag.delete({ id: tag.id });
      }

      for (const post of posts) {
        await client.models.Post.delete({
          postId: post.postId,
          title: post.title,
        });
      }

      for (const postTag of postTags) {
        if (postTag.id) {
          await client.models.PostTags.delete({
            id: postTag.id,
          });
        }
      }

      setRes('deleted');
      setPosts(await client.models.Post.list());
    },
    list: async () => {
      const posts = await client.models.Post.list();

      setRes(undefined);
      setPosts(posts);
    },
    listCustom: async () => {
      const posts = await client.models.Post.list({
        selectionSet: ['postId', 'title', 'comments.*', 'tags.*'],
      });

      const [post] = posts;
      post.comments;
      post.tags;

      console.log('custom sel set', posts);

      setRes(posts);
    },
  };

  function Post(props: { post: Post }): JSX.Element {
    const {
      post,
      post: { title, comments },
    } = props;

    const [postComments, setPostComments] = useState<Comment[]>([]);

    useEffect(() => {
      getComments();
    }, []);

    async function getComments() {
      // const comments = await comments({nextToken})
      setPostComments(await comments()); // post.comments()
    }

    async function addComment() {
      await client.models.Comment.create({
        id: 'comment' + Math.floor(Math.random() * 1_000_000_000_000),
        bingo: 'Comment ' + Date.now(),
        post: post,
      });

      await getComments();
    }

    return (
      <div>
        <h3>{title}</h3>
        <div>
          <h5>Comments</h5>
          <div>
            {postComments.map((pc) => {
              return <p key={pc.id}>{pc.bingo}</p>;
            })}
          </div>
          <button onClick={() => addComment()}>Add Comment</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.buttons}>
        <button onClick={btnHandlers['create']}>Create</button>
        <button onClick={createPostTag}>Create Post Tag</button>
        <button onClick={btnHandlers['get']}>Get</button>
        <button onClick={btnHandlers['update']}>Update</button>
        <button onClick={btnHandlers['delete']}>Delete All</button>
        <button onClick={btnHandlers['list']}>List</button>
        <button onClick={btnHandlers['listCustom']}>
          List (Custom sel. set)
        </button>
      </div>
      {!res ? (
        <div className={styles.result}>
          <h2>Posts</h2>
          {posts.map((post) => (
            <Post post={post} key={post.postId}></Post>
          ))}
        </div>
      ) : (
        <pre>{JSON.stringify(res, null, 2)}</pre>
      )}
    </>
  );
}
