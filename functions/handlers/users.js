const { db, admin } = require('../util/admin');
const firebase = require('firebase');
const config = require('../util/config');

const { validateSignUpData, validateLoginData, reduceUserDetails} = require('../util/validators');

firebase.initializeApp(config);

exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };
  
  // Validate User Sign Up
  const { valid, errors } = validateSignUpData(newUser);
  if(!valid) res.status(400).json(errors);

  const noImage = 'no-image.png';

  let token;
  let userId;

  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`,
        userId: userId
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email is already in use" });
      } else {
        res.status(500).json({ error: err.code });
      }
    });
}

exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  // Validate User Login
  const { valid, errors } = validateLoginData(user);
  if(!valid) res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.json({ token });
    })
    .catch(err => {
      console.log(err);
      if (err.code === "auth/wrong-password") {
        return res
          .status(403)
          .json({ general: "Wrong password, please try again" });
      } else if (err.code === "auth/invalid-email") {
        return res
          .status(403)
          .json({ general: "Invalid Email, please try again" });
      } else return res.status(500).json({ error: err.code });
    });
}

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
      return res.json({ message: "Details added successfully"})
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    })
}

// Get User public profile
exports.getUserDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.params.handle}`).get()
    .then(doc => {
      if(doc.exists) {
        userData.user = doc.data()
        return db.collection('posts').where('userHandle', '==', req.params.handle)
          .orderBy('createdAt', 'desc')
          .get()
      }
    })
    .then(data => {
      userData.posts = [];
      data.forEach(doc => {
        userData.posts.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          postId: doc.id
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code })
    })
}


// Get user data (Credentials, Details and likes)
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
      if(doc.exists) {
        userData.credentials = doc.data();
        return db.collection('likes').where('userHandle', '==', req.user.handle).get()
      } else {
        return res.status(404).json({ error: "User not found" })
      }
    })
    .then(data => {
      userData.likes = [];
      data.forEach(doc => {
        userData.likes.push(doc.data());
      });
      return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          postId: doc.data().postId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id
        })
      })
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: err.code})
    });
}

// Upload Image profile for User
exports.uploadImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const busboy = new BusBoy({ headers: req.headers });

  let imageFileName;
  let imageToBeUploaded = {};

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

    // Check file format
    if(mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: "Wrong file format submitted" });
    }

    // my.image.png
    const imageExtension = filename.split(".")[filename.split('.').length - 1];
    // 685496576835.png
    imageFileName = `${Math.round(Math.random() * 100000000000)}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  // Upload image to Firebase Storage
  busboy.on("finish", () => {
    admin.storage().bucket(`${config.storageBucket}`).upload(imageToBeUploaded.filepath, {
      resumable: false,
      metadata: {
        metadata: {
          contentType: imageToBeUploaded.mimetype
        }
      }
    })
    // Add the image url stored in the firebase storage to the user document.
    .then(() => {
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
      return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
    })
    .then(() => {
      return res.json({message: "Image uploaded successfully"});
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: err.code});
    })
  })
  busboy.end(req.rawBody);
}

// Clean Notifications 
exports.markNotificationsRead = (req ,res) => {
  let batch = db.batch() // Batch is used when you want to update multiple documents at once.
  req.body.forEach((notificationId) => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, { read: true });
  });
  batch.commit()
    .then(() => {
      return res.json({ message: 'Notifications marked as read' });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: err.code});
    })
}