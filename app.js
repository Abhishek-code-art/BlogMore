require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require('lodash');
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");


// backend
const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// cookies and sessions
app.use(session({
    secret: "This is Abhishek.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

mongoose.connect("mongodb+srv://abhishek_code_art:Tiwari123@cluster0.ttmhigx.mongodb.net/blogDB?retryWrites=true&w=majority", {useNewUrlParser: true});

// schema of user and its model
const userSchema = new mongoose.Schema({
  fullname: String,
  username: {
      type: String,
      required: true,
      unique: true
  },
  password: String,
  googleId: String,
  blogs: [{
      blogtitle: {type: String, trim: true},
      blogbody: String
  }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// user model
const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});


// google authentication
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/home"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({googleId: profile.id, username: profile._json.email}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
  User.find({}, function(err, foundBlogs) {
    if(err) {
      console.log(err);
    } else {
      if(foundBlogs) {
        res.render("home", {blogPosts: foundBlogs});
      }
    }
  });
});


// route to authenticate user by google 
app.route("/auth/google")
.get(passport.authenticate("google", {scope: ["profile", "email"]}));

// after authenticate user by google, google will redirect user to this route or url
app.get("/auth/google/home", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  });

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/blogs", (req, res) => {
   if(req.isAuthenticated()) {
     User.find({}, function(err, foundBlogs) {
      if(err) {
        console.log(err);
      } else {
        if(foundBlogs) {
          res.render("blogs", {blogPosts: foundBlogs});
        }
      }
  });
  } else {
    res.redirect('/login');
  }
});


app.get("/login", function(req, res) {
  res.render('login');
});

// to logout an user
app.get("/logout", function(req, res) {
  if(req.isAuthenticated()) {
    req.logOut((err) => {
        if(err) {
            console.log(err);
        } else {
          res.redirect("/");
        }
    });
  } else {
    res.redirect('/login');
  }
});


app.get("/register", function(req, res) {
  res.render('register');
});

app.get("/posts/:postName", function(req, res) {
  if(req.isAuthenticated()) {
    User.find({"blogs.blogtitle": req.params.postName}, function(err, foundUser){
      if(err) {
        console.log(err);
      } else { 
        if(foundUser) {
            res.render('post', {foundUsers: foundUser, requestedTitle: req.params.postName});
        }
      }
    }); 
  } else {
    res.redirect('/login');
  }
});

app.route("/compose")
.get(function(req, res) {
  if(req.isAuthenticated()) {
    res.render('compose');
  } else {
    res.redirect('/login');
  }
})
.post(function(req, res) {
  const blogTitle = req.body.postTitle;
  const blogBody = req.body.postBody;

  User.findById(req.user.id, function(err, foundUser) {
        if(err) {
            console.log(err);
        } else {
            if(foundUser) {
                blog = {blogtitle: blogTitle, blogbody: blogBody}
                foundUser.blogs.push(blog);
                foundUser.save(function() {
                    res.redirect("/posts/" + blogTitle);
                });
            }
        }
    });
})


app.post("/register", function(req, res) {

  User.register({fullname: req.body.fullname, username: req.body.username}, req.body.password, function(err, user) {
        if(err) {
            console.log(err);
            res.redirect('/register');
        } else {
            passport.authenticate("local")(req, res, function() {
              res.redirect('/');
            });
        }
    });
});

app.post("/login", function(req, res) {

  const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect('/');
            })
        }
    });
});



app.listen(3000, function() {
  console.log("Server started on port 3000");
});
