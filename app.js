const http = require('http');
const path = require("path");
const express = require("express");
const app = express();
const port = process.env.PORT || "5000";
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');
const util = require('util');
var ejs = require('ejs');
var bodyParser = require('body-parser');


//app.use(express.static(__dirname + "/views"));
//app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

var AES = require("crypto-js/aes");
var SHA256 = require("crypto-js/sha256");
var CryptoJS = require("crypto-js");
console.log(CryptoJS.HmacSHA1("Message", "Key"));

var nodemailer = require('nodemailer');
var fs = require('fs') // notice this
const { promisify } = require('util');
const readFile = promisify(fs.readFile);


app.use(cookieParser());
app.use(session({ secret: 'Does this work?' }));
app.use(bodyParser.urlencoded({ extended: false }));



app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', function (req, res, html) {
  res.sendFile(path.join(__dirname + '/signup.html'));
});

app.get('/login', function (req, res, html) {
  res.sendFile(path.join(__dirname + '/login.html'));
});

app.get('/discover', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  if (Object.keys(req.query).length == 0) {
    user.find(function (err, users) {
      //render all users
      res.render('discovery_page', { users: users });
    });
  } else {
    //render only users matching what user typed in
    user.find({ username: { $regex: "^" + req.query.search + ".*", $options: 'i' } }, function (err, users) {
      if (err) {
        console.log(err);
      } else {
        res.render('discovery_page', { users: users });
      }
    });
  }
});



app.get('/posted', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  post.find(function (err, posts) {
    var filtered_posts = [];
    
    if (err) {
      console.log(err);
    } else {
      //send the filtered version of posts to ejs
      //go through user's followings, and get user topic combinations 

      // console.log("following array of logged in user ", req.session.username);
      var filtering_criteria = "";
      var highlighting_criteria = "";
      user.findOne({ username: req.session.username }, 'following newUserTopicList', (err, userData) => {
        //console.log("following array of logged in user ", userData.following);
        filtering_criteria = userData.following;
        highlighting_criteria = userData.newUserTopicList;
        if (userData.following.length == 0) {
          res.render('display-posts', { posts: []});
        } else {
          post.find(function (err, posts) {
            //for the user...
            //console.log('first part is ', filtering_criteria[0].username);
            var users = filtering_criteria.map(function (value) {
              return value.username;
            });

            var highlight = highlighting_criteria.map(function (value) {
              return value;
            });

            //console.log("all users are ", users);
            newHighlightedTopics = userData.newUserTopicList;
            
            for (var i = 0; i < posts.length; i++) {
              //see if posts username matches and one of the topics match for each post
             
              var index = -1;
              var pConcat = posts[i].user + posts[i].topic;
              if (users.indexOf(posts[i].user) !== -1) {
                index = users.indexOf(posts[i].user);
                if (filtering_criteria[index].topics.indexOf(posts[i].topic) != -1) {
                  //console.log("here, post found");
                  filtered_posts.push({
                    post: posts[i], 
                    isHighlighted: false
                  });
                }
              }
              if (highlight.indexOf(pConcat) !== -1 && pConcat !== null) {
                filtered_posts.push({
                  post: posts[i],
                  isHighlighted: true
                });
                }
            }
            
            userData.newUserTopicList = [];
            userData.save();

            filtered_posts.sort(function (a, b) {
              var keyA = new Date(a.date),
                keyB = new Date(b.date);
              // Compare the 2 dates
              if (keyA < keyB) return -1;
              if (keyA > keyB) return 1;
              return 0;
            });
            //console.log('posts are ', filtered_posts);
            res.render('display-posts', { posts: filtered_posts });

          });
        }
      });




    }
  });
});

app.get('/user-followed', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  // console.log('req is', req);
  // console.log('req topics are ', req.query.topics);
  // console.log('req username is ', req.query.user_followed);
  user.findOne({ username: req.session.username }, 'following', (err, userData) => {

    var userExists = false;
    //check if person is already following user
    userData.following.forEach(function (following_person) {
      if (following_person.username == req.query.user_followed) {
        userExists = true;
        console.log("person already follows user");

        //clears whole user-topic list for specified user and updates with new followed topics
        var j, k, l;
        //loop for finding user in user-topic
        for (j = 0; j < userData.following.length; j++) {
          //once user is found, delete all topics from list
          if (userData.following[j].username == req.query.user_followed) {

            if (req.query.topics == null) {
              console.log("empty");
              if (j > -1) {
                userData.following.splice(j, 1);
                console.log('SPLICING');
              }
            } else {
              console.log("not empty");
              console.log(userData.following[j].username + '=' + req.query.user_followed);
              console.log(j);
              var topicSize = userData.following[j].topics.length
              for (k = 0; k < topicSize; k++) {
                userData.following[j].topics.pop();
              }
              break;
            }//end else
          }
        }
        /* req.query.topics is a String if only one topic is selected
           for following. Else, it is of type Array */
        if (req.query.topics != null) {
          if (Object.getPrototypeOf(req.query.topics) === String.prototype) {
            userData.following[j].topics.push(req.query.topics);
          } else {
            for (l = 0; l < req.query.topics.length; l++) {
              userData.following[j].topics.push(req.query.topics[l]);
            }
          }
          // console.log(userData.following[j].topics);
        } else {
          //completely unfollowed this user (following[j]) so must also remove userData from following[j]'s followingMeList (for highlighting)
          user.findOne({ username: following_person.username }, 'followingMeList', (err, unfollowMe) => {
            unfollowMe.followingMeList.forEach(function (personThatUnfollowed) {
              console.log(personThatUnfollowed._id);
              if (personThatUnfollowed._id == req.session.userID) {
                unfollowMe.followingMeList.pull(personThatUnfollowed);
                unfollowMe.save();
              }
            });
          });
        }
        userData.save();
      }
    });

    //if person is not following user, add them
    if (!userExists) {
      var newFollowing = {
        username: req.query.user_followed,
        topics: req.query.topics
      };
      userData.following.push(newFollowing);
      userData.save();
      console.log("user added successfully");
      var duplicateUser = false;
      user.findOne({ username: req.query.user_followed }, 'username followingMeList', (err, posterData) => {
        posterData.followingMeList.forEach(function (other_followers) {
          if(other_followers.username == req.session.username){
            duplicateUser = true;
            //break;
          }

        })
        if(!duplicateUser){
          
          posterData.followingMeList.push(req.session.userID);
          posterData.save();
        }
      });

    }

    //redirect them to the timeline instead
    res.redirect('/posted');

  });

});

app.get('/id', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  var user_clicked_id = ""
  var userTopics = ""
  var followedTopics = "";

  //represents the current topics the logged-in user is following from the viewed user 
  var checked = []

  var user_clicked = user.findOne({ username: req.query.username }, function (err, document) {
    // user_clicked_id = document._id;
    user_clicked_id = document.username;
    app.locals.userlineID = user_clicked_id;
    console.log('user_clicked_id is', app.locals.userlineID);

    //get all the users
    user.findOne({ username: req.session.username }, 'following', (err, userData) => {
      var following_users = userData.following.map(function (value) {
        return value.username;
      });
      var index = following_users.indexOf(user_clicked_id);

      //get array of topics user follows from viewed user
      var following_topics_user = userData.following.map(function (value) {
        return value.topics;
      });

      console.log("following_topics_user is", following_topics_user);

      topic_followed = [];
      if (index != -1) { //logged-in user follows no topics from viewed user

        for (var i = 0; i < document.topics.length; i++) {
          if (following_topics_user[index].indexOf(document.topics[i]) != -1) { //user follows topic
            topic_followed[i] = true;
          } else { //user does not follow topic
            topic_followed[i] = false;
          }
        }
      } else { //user follows no topics from viewed user
        console.log("IN HERE, DON'T FOLLOW ANYTHING"); 
        var arraySize = document.topics.length;
        while(arraySize--) 
        topic_followed.push(false);
      }

      app.locals.topic_followed = topic_followed;
      post.find(function (err, posts) {
        if (err) {
          console.log(err);
        } else {
          //get the user topics
          if (document.topics === null) {
            userTopics = "";
          } else {
            userTopics = document.topics;
            app.locals.userTopics = userTopics;
          }
          //pass in the user's posts and topics
          res.render('display-others-posts', { posts: posts});
        }
      });
    });


  });
});



app.get('/display_personal', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  app.locals.userIDejs = req.session.username;
  //THERE IS SOMETIMES AN ISSUE HERE WHERE THE DOCUMENT IS NULL
  //IF IT IS NULL, THEN WE CAN RENDER A PAGE WHERE WE PROMPT THE USER TO LOGIN
  //THIS HAPPENS WHEN I REFRESH THE PAGE
  console.log("THE USER IS", app.locals.userIDejs);
  var userTopics = ""
  user.findOne({ username: req.session.username }, 'username topics', (err, document) => {
    console.log()
    if (document.topics == null) {
      console.log("THIS IS NULL");
      userTopics = ""
    } else {
      console.log("NOT NULL");
      userTopics = document.topics;
    }
    app.locals.finalUserTopics = userTopics;
    post.find(function (err, posts) {
      if (err) {
        console.log(err);
      } else {
        res.render('display-personal-posts', { posts: posts, email: req.session.email, username: req.session.username });
        // console.log(posts);
      }
    });
  });


});

app.get('/settings', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  user.find(function (err, users) {
    if (err) {
      console.log(err);
    } else {
      res.render('settings', { username: req.session.username, email: req.session.email, password: req.session.password });
      console.log(user);
    }
  });
});


app.get('/deleteUser', function (req, res) {
  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  post.find(function (err, posts) {
    if (err) {
      console.log(err);
    } else {
      console.log(posts);
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].user == req.session.username) {
          console.log(posts[i]);
          post.findByIdAndRemove(posts[i]._id, function (err) {
            if (err) {
              console.log(err);
            }
          });
        }
      }
    }
  });

  user.findByIdAndRemove(req.session.userID, function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/editName', function (req, res) {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }

  console.log(req.body.uname);
  user.findByIdAndUpdate(req.session.userID,
    { $set: { username: req.body.uname } },
    function (err) {
      if (err) {
        console.log(err);
      }
      else {
        req.session.username = req.body.uname;
        res.redirect('/settings');
      }
    });

});

app.post('/editEmail', function (req, res) {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }

  console.log(req.body.email);
  user.findByIdAndUpdate(req.session.userID,
    { $set: { email: req.body.email } }, function (err) {
      if (err) {
        console.log(err);
      }
      else {
        req.session.email = req.body.email;
        res.redirect('/settings');
      }
    });

});

app.post('/editPw', function (req, res) {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }

  console.log(req.body.pw);
  //encrypting the password for storing in DB
  encrypttedP = CryptoJS.SHA1(req.body.pw);
  console.log(encrypttedP);
  encrypttedP = encrypttedP.toString(CryptoJS.enc.Base64);
  user.findByIdAndUpdate(req.session.userID,
    { $set: { password: encrypttedP } }, function (err) {
      if (err) {
        console.log(err);
      }
      else {
        req.session.password = req.body.pw; //displaying unencrypted password
        res.redirect('/settings');
      }
    });

});

var mongoose = require("mongoose");
var passport = require("passport");
var bodyParser = require("body-parser");
var user = require("./models/user"); //reference to user schema
var post = require("./models/post"); //reference to post schema
//var Posts = mongoose.model('Posts', postSchema);

//Connection start
mongoose.Promise = global.Promise;
mongoose.connect('mongodb+srv://Twistter:CS30700!@twistter-dcrea.mongodb.net/Twistter307?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true }, function (error) {
  if (error) {
    console.log("Couldn't connect to database");
  } else {
    console.log("Connected To Database");
  }
});
mongoose.set('useFindAndModify', false);


//Login, Logout, Signup
app.use(express.urlencoded())
app.post("/signup", (req, res) => {
  //receiving form information from signup.html
  const e = req.body.email;
  const u = req.body.username;
  const p = req.body.password;

  //Sending email to new user
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'twistter307@gmail.com',
      pass: 'CS30700!'
    }
  });

  var mailOptions = {
    from: 'twistter307@gmail.com',
    to: e,
    subject: 'Thank you for signing up with Twistter',
    text: 'Hello, Hope you enjoy the application :)'
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

  //using CryptoJS to encrypt password
  encrypttedP = CryptoJS.SHA1(p);
  encrypttedP = encrypttedP.toString(CryptoJS.enc.Base64);
  //res.status(204).send();
  //res.end();

  //formatting the email and password info into the user schema
  var newUser = new user({
    email: e,
    username: u,
    password: encrypttedP,
    topics: [],
    newtopics: []
  });
  //saving the new user to the database

  newUser.save(function (err, e) {

    console.log(err);
    var alert = "alert('Yikes! There's been an error. Please try again at a different time.')";

    if (err) {
      if (err.name == 'ValidationError') {
        if (err.message.includes('username')) {
          alert = "alert('Username already exists. Please try a different one.')";
        } else if (err.message.includes('email')) {
          alert = "alert('Email already registered with account. Please try a different email.')"
        }
      }
      fs.readFile('./signup.html', 'utf8', function (err, data) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        var result = data.replace(/\<\/script>/g, alert + '</script>');
        res.write(result);
        res.end();
        return;
      });
    } else {
      res.sendFile(path.join(__dirname + '/login.html'));
      console.log("new user successfully saved");
    }
  })
});


//Login
app.post("/login", (req, res) => {
  //receiving form information from signup.html
  const e = req.body.email;
  const p = req.body.password;
  encrypttedP = CryptoJS.SHA1(p);
  encrypttedP = encrypttedP.toString(CryptoJS.enc.Base64);

  //looks for a user in the database with the same email

  user.findOne({ email: e }, 'email username password', (err, userData) => {
    //console.log(userData);
    if (userData == null) {
      res.sendFile(path.join(__dirname + '/login.html'))
      //res.status(200).send("UserData is null")
    } else if (encrypttedP === userData.password) {
      //Redirect here!
      //Redirect to main posts page
      console.log("Login Successful")
      req.session.email = req.body.email;
      req.session.userID = userData._id;
      req.session.username = userData.username;
      req.session.posts = userData.posts;
      req.session.password = p;
      //console.log(userData.username);
      //console.log(req.session.userID);
      res.redirect('/posted');
    } else {
      //res.status(200).send("Failed Login");
      //res.send('Your username/password is incorrect, try again')
      res.sendFile(path.join(__dirname + '/login.html'), 'Error your username/password is incorrect, try again')
    }
  });
})

//Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.sendFile(path.join(__dirname + '/login.html'));
})

app.post("/posted", (req, res) => {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }

  // console.log("POSTS");
  var currDate = new Date();
  var newPost = new post({
    title: req.body.title,
    description: req.body.description,
    topic: req.body.topic,
    date: currDate,
    user: req.session.username,
    likes: 0,
    dislikes: 0
  });

  user.findOne({ username: req.session.username }, 'username topics followingMeList', (err, userData) => {
    if (!userData.topics.includes(req.body.topic)) {//Save this to the topics list and remove it once it is done.
      userData.topics.push(req.body.topic);
      userData.save();
      var i;
      var newCombo = req.session.username + req.body.topic;
      for(i = 0; i < userData.followingMeList.length; i++){
        
        user.findOne({_id: userData.followingMeList[i]}, 'newUserTopicList', (err, followerData) => {
          followerData.newUserTopicList.push(newCombo);
          followerData.save();
        });
      }
    }
  });

  //console.log("newPost is", newPost);
  newPost.save(function (err, e) {
    if (err) return console.error(err);
    else return console.log('succesfully saved');
  })
  res.redirect('/posted');
});

app.post("/like", (req, res) => {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }

  user.findOne({ username: req.session.username }, 'interactions', (err, userData) => {
    var newInteraction = {
      postID: req.body.id.toString(),
      liked: true,
      disliked: false
    };
    //check to see if user has already liked this post
    var alreadyInteracted = false;
    var beenDisliked = false;
    userData.interactions.forEach(function (post) {
      if (post.postID === req.body.id.toString()) {
        if (!post.disliked) {
          //console.log("CANT LIKE-------------------------------------------------");
          //console.log(post);
          beenDisliked = post.disliked;
          alreadyInteracted = true;
        } else {
          //undo a dislike and like instead
          beenDisliked = post.disliked;
          alreadyInteracted = false;
          //console.log(post);
        }

      }
    })

    if (!alreadyInteracted) {
      //update user's liked posts
      userData.interactions.push(newInteraction);
      userData.save();
      //update the like count on the post
      post.findOne({ _id: req.body.id }, 'likes dislikes', (err, postData) => {
        postData.likes += 1;
        //if has been disliked, switch to a like
        if (beenDisliked) {
          postData.dislikes -= 1;
        }
        postData.save();
        //console.log("LIKED----------------------------------");
      });
    }
    res.redirect('/posted');
  });
});

app.post("/dislike", (req, res) => {

  if (req.session.username == null) {
    return res.sendFile(path.join(__dirname + '/login.html'));
  }
  
  user.findOne({ username: req.session.username }, 'interactions', (err, userData) => {
    var newInteraction = {
      postID: req.body.id.toString(),
      liked: false,
      disliked: true
    };
    //check to see if user has already liked this post
    var alreadyInteracted = false;
    var beenLiked = false;
    userData.interactions.forEach(function (post) {
      if (post.postID === req.body.id.toString()) {
        if (!post.liked) {
          //console.log("CANT DISLIKE-------------------------------------------------");
          //console.log("TEST@: " + post);
          alreadyInteracted = true;
        } else {
          //undo a dislike and like instead
          beenLiked = post.liked;
          alreadyInteracted = false;
          //console.log("TEST: " + post);
        }
      }
    })

    if (!alreadyInteracted) {
      //update user's liked posts
      userData.interactions.push(newInteraction);
      userData.save();

      //update the like count on the post
      post.findOne({ _id: req.body.id }, 'likes dislikes', (err, postData) => {
        postData.dislikes += 1;
        //if has been disliked, switch to a like
        if (beenLiked) {
          postData.likes -= 1;
        }

        postData.save();
        //console.log("DISLIKED---------------------------------");
      });
    }
    res.redirect('/posted');
  });
});

module.exports = router

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});
