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
app.get('/user/:handle', getUserDetails);
app.post("/notifications", tokenAuth, markNotificationsRead);

// Exporting the Express routes to Firebase: https://baseurl.com/api/
exports.api = functions.https.onRequest(app);


// FIREBASE DB TRIGGERS (Need to deploy)
// run firebase deploy in the socialapp-functions/functions folder || to work

// Likes Notifications
exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate(snapshot => {
    db.doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then(doc => {
        if (doc.exists) {
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
      .then(() => {
        return;
      })
      .catch(err => {
        console.log(err);
        return;
      });
  });

  // Delete Notifications On Unlike
  exports.deleteNotificationOnUnLike = functions.firestore.document('likes/{id}')
    .onDelete((snapshot) => {
      db.doc(`/notifications/${snapshot.id}`)
      .delete()
      .then(() => {
        return;
      })
      .catch(err => {
        console.log(err);
        return;
      })
    })

  // Comments Notifications
exports.createNotificationOnComment = functions.firestore
.document("comments/{id}")
.onCreate(snapshot => {
  db.doc(`/posts/${snapshot.data().postId}`)
    .get()
    .then(doc => {
      if (doc.exists) {
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
    .then(() => {
      return;
    })
    .catch(err => {
      console.log(err);
      return;
    });
});
