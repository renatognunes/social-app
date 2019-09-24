const functions = require("firebase-functions");
const express = require("express");
const tokenAuth = require('./util/tokenAuth');

const { getAllPosts, post, getPost, commentOnPost, likePost, unlikePost } = require('./handlers/posts');
const { signup, login, uploadImage, addUserDetails, getAuthenticatedUser } = require('./handlers/users');

const app = express();


// Posts Routes
app.get("/posts", getAllPosts);
app.post("/post", tokenAuth, post);
app.get('/post/:postId', getPost);
// app.get('/post/:postId/like', tokenAuth, likePost);
// app.get('/post/:postId/dislike', tokenAuth, unlikePost);
app.post('/post/:postId/comment', tokenAuth, commentOnPost);

// Users Routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", tokenAuth, uploadImage);
app.post('/user', tokenAuth, addUserDetails);
app.get('/user', tokenAuth, getAuthenticatedUser);




// Exporting the Express routes to Firebase: https://baseurl.com/api/
exports.api = functions.https.onRequest(app);
