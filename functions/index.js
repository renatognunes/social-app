const functions = require("firebase-functions");
const express = require("express");
const tokenAuth = require('./util/tokenAuth');

const { getAllPosts, post } = require('./handlers/posts');
const { signup, login, uploadImage } = require('./handlers/users');

const app = express();


// Posts Routes
app.get("/posts", getAllPosts);
app.post("/post", tokenAuth, post);

// Users Routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", tokenAuth, uploadImage);




// Exporting the Express routes to Firebase: https://baseurl.com/api/
exports.api = functions.https.onRequest(app);
