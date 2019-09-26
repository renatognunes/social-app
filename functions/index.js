const functions = require("firebase-functions");
const express = require("express");
const tokenAuth = require("./util/tokenAuth");
const { db } = require("./util/admin");

const {
  getAllPosts,
  post,
  getPost,
  commentOnPost,
  likePost,
  unlikePost,
  deletePost
} = require("./handlers/posts");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require("./handlers/users");

const app = express();

// Posts Routes
app.get("/posts", getAllPosts);
app.post("/post", tokenAuth, post);
app.get("/post/:postId", getPost);
app.delete("/post/:postId", tokenAuth, deletePost);
app.get("/post/:postId/like", tokenAuth, likePost);
app.get("/post/:postId/unlike", tokenAuth, unlikePost);
app.post("/post/:postId/comment", tokenAuth, commentOnPost);

// Users Routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", tokenAuth, uploadImage);
app.post("/user", tokenAuth, addUserDetails);
app.get("/user", tokenAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", tokenAuth, markNotificationsRead);

// Exporting the Express routes to Firebase: https://baseurl.com/api/
exports.api = functions.https.onRequest(app);

// FIREBASE DB TRIGGERS (Need to deploy)
// run firebase deploy in the socialapp-functions/functions folder || to work

// Likes Notifications
exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            postId: doc.id
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });

// Delete Notifications On Unlike
exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete(snapshot => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.log(err);
      });
  });

// Comments Notifications
exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            postId: doc.id
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });

// Update User Image through the App when User change image profile
exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate(change => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("Image has changed");
      const batch = db.batch();
      return db
        .collection("posts")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then(data => {
          data.forEach(doc => {
            const post = db.doc(`/posts/${doc.id}`);
            batch.update(post, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        })
        .catch(err => {
          console.log(err);
        });
    } else return true;
  });

// Delete all related likes/comments/notifications from a Post when deleted
exports.onPostDelete = functions.firestore
  .document("/posts/{postId}")
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("postId", "==", postId)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection("likes")
          .where("postId", "==", postId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("postId", "==", postId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => {
        console.log(err);
      });
  });
