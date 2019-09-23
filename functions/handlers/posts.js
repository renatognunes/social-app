const { db } = require('../util/admin');

exports.getAllPosts = (req, res) => {
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let posts = [];
      data.forEach(doc => {
        posts.push({
          postId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt
        });
      });
      return res.json(posts);
    })
    .catch(err => console.error(err));
}

exports.post = (req, res) => {
  // This is the document properties to be post in the db.
  const newPost = {
    body: req.body.body, // the second body here is because we have a body property in the db.
    userHandle: req.user.handle,
    createdAt: new Date().toISOString()
  };

  db.collection("posts")
    .add(newPost)
    .then(doc => {
      res.json({ message: `Document ${doc.id} created successfully` });
    })
    .catch(err => {
      res.status(500).json({ error: "Something went worng" });
      console.error(err);
    });
}