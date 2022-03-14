/* jshint node: true */

/*
 * This builds on the webServer of previous projects in that it exports the current
 * directory via webserver listing on a hard code (see portno below) port. It also
 * establishes a connection to the MongoDB named 'cs142project6'.
 *
 * To start the webserver run the command:
 *    node webServer.js
 *
 * Note that anyone able to connect to localhost:portNo will be able to fetch any file accessible
 * to the current user in the current directory or any of its children.
 *
 * This webServer exports the following URLs:
 * /              -  Returns a text status message.  Good for testing web server running.
 * /test          - (Same as /test/info)
 * /test/info     -  Returns the SchemaInfo object from the database (JSON format).  Good
 *                   for testing database connectivity.
 * /test/counts   -  Returns the population counts of the cs142 collections in the database.
 *                   Format is a JSON object with properties being the collection name and
 *                   the values being the counts.
 *
 * The following URLs need to be changed to fetch there reply values from the database.
 * /user/list     -  Returns an array containing all the User objects from the database.
 *                   (JSON format)
 * /user/:id      -  Returns the User object with the _id of id. (JSON format).
 * /photosOfUser/:id' - Returns an array with all the photos of the User (id). Each photo
 *                      should have all the Comments on the Photo (JSON format)
 *  
 */

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var async = require('async');

// Fetch express & middleware modules
var express = require('express');
var app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const processFormBody = multer({storage: multer.memoryStorage()}).single('uploadedphoto');
const fs = require("fs");

// Load the Mongoose schema for User, Photo, and SchemaInfo
var User = require('./schema/user.js');
var Photo = require('./schema/photo.js');
var SchemaInfo = require('./schema/schemaInfo.js');
var Activity = require('./schema/activity.js');
mongoose.connect('mongodb://localhost/cs142project6', { useNewUrlParser: true, useUnifiedTopology: true });

// We have the express static module (http://expressjs.com/en/starter/static-files.html) do all
// the work for us.
app.use(express.static(__dirname));

// Set session secret key as 'HelloWorld'
app.use(session({secret: 'HelloWorld', resave: false, saveUninitialized: false})); 
app.use(bodyParser.json());

app.get('/', function (request, response) {
    response.send('Simple web server of files from ' + __dirname);
});

/*
 * Use express to handle argument passing in the URL.  This .get will cause express
 * To accept URLs with /test/<something> and return the something in request.params.p1
 * If implement the get as follows:
 * /test or /test/info - Return the SchemaInfo object of the database in JSON format. This
 *                       is good for testing connectivity with  MongoDB.
 * /test/counts - Return an object with the counts of the different collections in JSON format
 */
/* eslint no-useless-return: "off"*/
app.get('/test/:p1', function (request, response) {
    // Express parses the ":p1" from the URL and returns it in the request.params objects.
    console.log('/test called with param1 = ', request.params.p1);

    var param = request.params.p1 || 'info';

    if (param === 'info') {
        // Fetch the SchemaInfo. There should only one of them. The query of {} will match it.
        SchemaInfo.find({}, function (err, info) {
            if (err) {
                // Query returned an error.  We pass it back to the browser with an Internal Service
                // Error (500) error code.
                console.error('Doing /test/info error:', err);
                response.status(500).send(JSON.stringify(err));
                return;
            }
            if (info.length === 0) {
                // Query didn't return an error but didn't find the SchemaInfo object - This
                // is also an internal error return.
                console.error('SchemaInfo object not found');
                response.status(500).send('Missing SchemaInfo');
                return;
            }

            // We got the object - return it in JSON format.
            console.log('SchemaInfo is:', info[0]);
            response.end(JSON.stringify(info[0]));
        });
    } else if (param === 'counts') {
        // In order to return the counts of all the collections we need to do an async
        // call to each collections. That is tricky to do so we use the async package
        // do the work.  We put the collections into array and use async.each to
        // do each .count() query.
        var collections = [
            {name: 'user', collection: User},
            {name: 'photo', collection: Photo},
            {name: 'schemaInfo', collection: SchemaInfo}
        ];
        async.each(collections, function (col, done_callback) {
            col.collection.countDocuments({}, function (err, count) {
                col.count = count;
                done_callback(err);
            });
        }, function (err) {
            if (err) {
                response.status(500).send(JSON.stringify(err));
            } else {
                var obj = {};
                for (var i = 0; i < collections.length; i++) {
                    obj[collections[i].name] = collections[i].count;
                }
                response.end(JSON.stringify(obj));

            }
        });
    } else {
        // If we know understand the parameter we return a (Bad Parameter) (400) status.
        response.status(400).send('Bad param ' + param);
    }
});

/*
 * URL /user/list - Return all the User object.
 */
app.get('/user/list', function (request, response) {    
    console.log('Express/user/list | Called');  
    if(request.session.user === undefined) {
        console.log('Express/user/list | 401. No user logged in.');
        response.status(401).send();
        return;
    }
       
    var query = User.find({});
    query.select("_id first_name last_name").exec(function(err, users) {
        if(err) {
            console.error('Error in /user/list call to MongoDB' + JSON.stringify(err));
            response.status(400).send(JSON.stringify(err));  
            return;          
        } else {            
            response.send(JSON.stringify(users));
            return;
        }
    });
});

/*
 * URL /user/:id - Return the information for User (id)
 */
app.get('/user/:id', function (request, response) {    
    var id = request.params.id;
    console.log("Express/user/id | Called with id: " + id);
    if(request.session.user === undefined) {
        console.log('Express/user/id | 401. No user logged in.');
        response.status(401).send();
        return;
    }

    var query = User.findOne({_id: id});    
    query.select("_id first_name last_name location description occupation");
    query.exec(function(err, user) {
        if(err) {
            console.error('Express/user/id | Error in Mongo /user/id call for id: ' + id + '. Error: ' +
             JSON.stringify(err));
            response.status(400).send(JSON.stringify(err));
            return;
        } else {            
            response.send(JSON.stringify(user));
            return;
        }
    });
});

/*
 * URL /photosOfUser/:id - Return the Photos for User (id)
 */
app.get('/photosOfUser/:id', function (request, response) {
    var user_id = request.params.id;    
    console.log("Express/photosOfUser/:id | Called with id: " + user_id);
    if(request.session.user === undefined) {
        console.log('Express/photosOfUser/id | 401. No user logged in.');
        response.status(401).send();
        return;
    }    

    var query = Photo.find({user_id: user_id});
    query.select("_id file_name date_time user_id comments likes likedBy");
    query.sort("-likes -date_time");
    query.exec(function (err, photosObj) {        
        if(err){
            console.error("Error in extracting photos for user :" + user_id +
            ". Error: " + err);
            response.status(400).send(JSON.stringify(err));        
            return;    
        } else {            
            var photos = JSON.parse(JSON.stringify(photosObj));

            async.each(photos, function(photo, photoCallback) {
                async.each(photo.comments, function(comment, commentCallback) {
                    var userQuery = User.findOne({_id: comment.user_id});    
                    userQuery.select("_id first_name last_name");
                    userQuery.exec(function(error, user) {
                        if(error) {
                            console.error('Error in creating user for comment id: ' + comment._id + '. Error: ' +
                            JSON.stringify(error));
                            response.status(400).send(JSON.stringify(err));                            
                        } else {
                            delete comment.user_id; // remove the user ID field                            
                            comment.user = JSON.parse(JSON.stringify(user)); // replace it with the user object
                            commentCallback();
                        }
                    });
                // Main callback - for comments
                }, function(error2) {
                    if(error2) {
                        console.error("Error in comment async main callback: " + error2);
                        response.status(400).send(JSON.stringify(error2));
                        return;
                    }
                    photo.isLikedByUser = photo.likedBy?.includes(request.session.user._id);
                    photoCallback();
                });  
            },
            // Main callback - for photos
            function (error3) {                
                if(error3) {
                    console.error("Error in photo async main callback: " + error3);
                    response.status(400).send(JSON.stringify(error3));                    
                    return;
                }                                
                response.send(JSON.stringify(photos));
                return;
            });            
        }
    });    
});

/*
 * URL /activities - Return the most recent 5 activities
 */
app.get('/activities', function (request, response) {    
    console.log("Express/activities | Called");
    if(request.session.user === undefined) {
        console.error('Express/activities | 401. No user logged in.');
        response.status(401).send();
        return;
    }

    var query = Activity.find({}).sort("-date_time").limit(5);
    query.exec(function(err, activities) {
        if(err) {
            console.error("Express/activities | Error in Mongo call: " + err);
            response.status(400).send();
            return;
        } else {            
            console.log('Express/activities | Status 200.');
            response.status(200).send(JSON.stringify(activities));
            return;
        }
    });
});

/*
 * URL /admin/login - Login a user
 */
app.post('/admin/login', function (request, response) {    
    var login_name = request.body.login_name;
    var password = request.body.password;
    console.log("Express/admin/login | Called with username " + login_name);
    var query = User.findOne({login_name: login_name, password: password});
    query.select("_id login_name first_name last_name");
    query.exec(function(err, user) {
        if(err) {
            console.error('Express/admin/login | Error in Mongo search for login_name: ' + login_name + '. Error: ' +
             JSON.stringify(err));
            response.status(400).send(JSON.stringify(err));    
            return;        
        } else if (user === null) {
            // If user not found, send 400 to client, which it must handle
            response.status(400).send();
            console.log("Express/admin/login | Status 400. Bad login for login_name: " + login_name);
            return;
        } else {            
            // Log activity & send response
            Activity.create({ date_time: Date.now(),
                activity: user.first_name + " " + user.last_name + " logged in.",
                user_id: user._id,
                photo_file_name: null,
                photo_user_id: null,
                comment_id: null
            }, (err2, newAct) => {
                if(err2) {
                    console.error("Express/admin/login | Status 400. Activity creation error: " + err2);
                    response.status(400).send();
                    return;
                } else {
                    request.session.user = user; // Set session user
                    response.status(200).send(JSON.stringify(user));
                    console.log("Express/admin/login | Status 200. Successful auth of " + user.login_name);
                    console.log("Express/admin/login | Activity logged: " + newAct.activity);
                    return;
                }
            });            
        }
    });
});

/* 
URL /user - Register a new user
 */
app.post('/user', function (request, response) {
    console.log("Express/user | Called with attempt to register login_name: " + request.body?.login_name);
    var errorText = "";
    // Double check client side validation: nonempty(user, pass, first, last)
    if(request.body?.login_name === "") {
        errorText = "Enter a unique username";
    } else if(request.body?.password === "") {
        errorText ="Enter a password";    
    } else if(request.body?.first_name === "" || request.body?.last_name === "") {
        errorText = "Enter your first and last name";
    }   
    if(errorText !== "")
    {
        response.status(400).send(errorText);
        return;
    }    

    // Server-side validation: check unique username
    var query = User.findOne({login_name: request.body?.login_name});    
    query.exec(function(err, user) {
        if(err) {
            console.error('Express/user | Error in Mongo search for login_name: ' + request.body.login_name + '. Error: ' +
             JSON.stringify(err));
            response.status(400).send(JSON.stringify(err));
            return;
        } else if(user === null) {
            // User is unique, create user
            User.create({login_name: request.body.login_name,
                password: request.body.password,
                first_name: request.body.first_name,
                last_name: request.body.last_name,
                location: request.body.location,
                occupation: request.body.occupation,
                description: request.body.description,
            // User creation callback
            }, (err2, newUser) => {                    
                if(err2) {
                    console.error("Express/user | Status 400. Error in Mongo User creation: " + err2);
                    response.status(400).send(err2);
                    return;
                } else {                    
                    Activity.create({ date_time: Date.now(),
                        activity: newUser.first_name + " " + newUser.last_name + " registered.",
                        user_id: newUser._id,
                        photo_file_name: null,
                        photo_user_id: null,
                        comment_id: null
                    }, (err3, newAct) => {
                        if(err3) {
                            console.error("Express/user | Status 400. Activity creation error: " + err3);
                            response.status(400).send();
                            return;
                        } else {
                            response.status(200).send({status: "Success"});
                            console.log("Express/user | Status 200. Created User with login_name: " + newUser.login_name);
                            console.log("Express/user | Activity logged: " + newAct.activity);
                            return;
                        }
                    });                    
                }
            });               
        // User is not unique
        } else {                
            console.error("Express/user | Status 200. Username not unique");
            response.status(200).send({status: "Username not unique"});
            return;         
        }
    });
});

/*
 * URL /admin/logout - Logout the current user
 */
app.post('/admin/logout', function (request, response) {        
    console.log("Express/admin/logout | Called");

    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/admin/logout | Status 400. No user logged in");
        return;
    }    
    
    // Log the user logout; upon completion, delete the session & respond with 200
    Activity.create({ date_time: Date.now(),
        activity: request.session.user.first_name + " " +
            request.session.user.last_name + " logged out.",
        user_id: request.session.user._id,
        photo_file_name: null,
        photo_user_id: null,
        comment_id: null
    }, (err, newAct) => {
        if(err) {
            console.error("Express/admin/logout | Status 400. Activity creation error: " + err);
            response.status(400).send();
            return;
        } else {            
            console.log("Express/admin/logout | Status 200. Successful logout of " + request.session.user.login_name);
            delete request.session.user;
            request.session.destroy();
            console.log("Express/admin/logout | Activity logged: " + newAct.activity);
            response.status(200).send();
            return;
        }
    });    
});

/*
 * URL /commentsOfPhoto/:photo_id - Add a comment to the photoID
 */
app.post('/commentsOfPhoto/:photo_id', function (request, response) {
    var photo_id = request.params.photo_id;
    console.log("Express/commentsOfPhoto | Called for photo_id: " + photo_id);

    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.error("Express/commentsOfPhoto | Status 400. No user logged in");
        return;
    }

    // If comment is empty, return 400
    if(request.body.comment === "" || request.body.comment === undefined)
    {
        response.status(400).send();
        console.error("Express/commentsOfPhoto | Status 400. Comment is empty");
        return;
    }

    // Create the comment object    
    var newComment = {comment: request.body.comment, user_id: request.session.user._id, date_time: Date.now() };
    
    // Fetch the Photo object from Mongo, add the comment, save
    var query = Photo.findOne({_id: photo_id});
    query.exec((err, photo) => {
        if(err) {
            console.error("Express/commentsOfPhoto | Status 400. Error in Mongo call: " + err);
            response.status(400).send();
            return;
        } else {
            photo.comments.push(newComment);
            photo.save();
            console.log("Express/commentsOfPhoto | Status 200. Comment added for photo id: " + photo_id);
            // Log the comment creation & return 200
            Activity.create({ date_time: Date.now(),
                activity: request.session.user.first_name + " " +
                    request.session.user.last_name + " commented on a photo.",
                user_id: request.session.user._id,
                photo_file_name: photo.file_name,
                photo_user_id: photo.user_id,
                comment_id: photo.comments[photo.comments.length-1]._id
            }, (err2, newAct) => {
                if(err2) {
                    console.error("Express/commentsOfPhoto | Status 400. Activity creation error: " + err2);
                    response.status(400).send();
                    return;
                } else {            
                                
                    console.log("Express/commentsOfPhoto | Activity logged: " + newAct.activity);
                    console.log("Express/commentsOfPhoto | Activity comment id: " + newAct.comment_id);
                    response.status(200).send();
                    return;
                }
            });                                    
        }
    });
});

/*
 * URL /photos/new - Logged in user adds a new photo
 */
app.post('/photos/new', function (request, response) {        
    console.log("Express/photos/new | Called");

    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/photos/new | Status 400. No user logged in");
        return;
    }

    // Use processFormBody to write the file to /images and then upload it to the database
    processFormBody(request, response, function (err) {
        if (err || !request.file || request.file?.size === 0) {
            console.error("Express/photos/new | Status 400 with processFormBody error: " + err);
            response.status(400).send();
            return;
        }
        // request.file has the following properties of interest
        //      fieldname      - Should be 'uploadedphoto' since that is what we sent
        //      originalname:  - The name of the file the user uploaded
        //      mimetype:      - The mimetype of the image (e.g. 'image/jpeg',  'image/png')
        //      buffer:        - A node Buffer containing the contents of the file
        //      size:          - The size of the file in bytes    
                
        const date_time = new Date().valueOf();
        const file_name = 'U' +  String(date_time) + request.file.originalname;
    
        fs.writeFile("./images/" + file_name, request.file.buffer, function (err2) {
            if(err2)
            {
                console.error("Express/photos/new | Status 400. Writefile error: " + err2);
                response.status(400).send();
                return;
            }          
                      
            Photo.create({user_id: request.session.user._id, date_time: date_time, file_name: file_name, likes: 0, likedBy: []},
            // Photo creation callback
            (err3) => {                    
                if(err3) {
                    console.error("Express/photos/new | Status 400. Error in Mongo Photo creation: " + err3);
                    response.status(400).send(err3);
                    return;
                } else {
                    // Log the activity, send back 200
                    Activity.create({ date_time: Date.now(),
                        activity: request.session.user.first_name + " " +
                            request.session.user.last_name + " uploaded a photo.",
                        user_id: request.session.user._id,
                        photo_file_name: file_name,
                        photo_user_id: request.session.user._id,
                        comment_id: null
                    }, (err4, newAct) => {
                        if(err4) {
                            console.error("Express/photos/new | Status 400. Activity creation error: " + err4);
                            response.status(400).send();
                            return;
                        } else {            
                            console.log("Express/photos/new | Status 200. Added new photo for user: " + request.session.user.login_name);                            
                            console.log("Express/photos/new | Activity logged: " + newAct.activity);
                            response.status(200).send();
                            return;
                        }
                    });                    
                }
            });
        });
    });
    
});

/*
 * URL /likePhoto/:photo_id - Logged in user likes / unlikes a photo
 */
app.post("/likePhoto/:photo_id", function (request, response) {
    var photo_id = request.params.photo_id;   
    console.log("Express/likePhoto | Called on photo id: " + photo_id);

    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/likePhoto | Status 400. No user logged in");
        return;
    }
    
    // Get the photo from the Mongo database, update likes based on whether
    // current logged in user likes the photo
    var query = Photo.findOne({_id: photo_id});
    query.exec((err, photo) => {
        if(err) {
            console.error("Express/likePhoto | Status 400. Error in Mongo call: " + err);
            response.status(400).send();
            return;
        } else {
            var id = request.session.user._id;

            // If the user already likes the photo, remove the user & reduce the # of likes
            if(photo.likedBy.includes(id)) {
                photo.likedBy.splice(photo.likedBy.indexOf(id),1);
                photo.likes--;
                photo.save();
                console.log("Express/likePhoto | Status 200. Like removed. Total likes: " + photo.likes);                
            // User hasn't like the photo; add him to list of likedBy and increase # of likes
            } else {
                photo.likedBy.push(id);
                photo.likes++;
                photo.save();
                console.log("Express/likePhoto | Status 200. Like added. Total likes: " + photo.likes);
            }
            response.status(200).send();
            return;
        }
    });
});

/*
 * URL /delete/comment - Delete a comment made by logged in user
 * comment_id and photo_id passed in the request body
 */
app.post('/delete/comment', function (request, response) {    
    var com_id = request.body.com_id;
    var photo_id = request.body.photo_id;
    console.log("Express/delete/comment | Called");

    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/delete/comment | Status 400. No user logged in");
        return;
    }

    // Get the photo by id, delete the comment with comment_id
    var query = Photo.findOne({_id: photo_id});
    query.exec((err, photo) => {
        if(err) {
            console.error("Express/delete/comment | Mongo error: " + err);
            response.status(400).send();
            return;
        } else {
            // Find index of comment
            var index = -1;           
            for(var i = 0; i < photo.comments.length; i++) {                            
                if (String(photo.comments[i]._id) === String(com_id))
                {                    
                    index = i;
                }
            }
            photo.comments.splice(index,1);
            photo.save();
            console.log("Express/delete/comment | Comment deleted");
            Activity.remove({comment_id: com_id}, err2 => {
                if(err2) {
                    console.error("Express/delete/comment | Activity delete error " + err2);
                    response.status(400).send();
                    return;
                } else {
                    console.log("Express/delete/comment | Activities deleted. 200.");                    
                    response.status(200).send();
                    return;
                }
            });        
        }
    });
});

/*
 * URL /delete/photo - Delete a photo made by logged in user
 * photo_id & file_name passed in the request body
 */
app.post('/delete/photo', function (request, response) {        
    var photo_id = request.body.photo_id;
    var file_name = request.body.file_name;
    console.log("Express/delete/photo | Called");
    
    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/delete/photo | Status 400. No user logged in");
        return;
    }

    Photo.remove({_id: photo_id, user_id: request.session.user._id}, err => {
        if(err) {
            console.error("Express/delete/photo | Error: " + err);
            response.status(400).send();
            return;
        } else {
            console.log("Express/delete/photo | Photo deleted.");
            // Delete associated activities
            Activity.remove({photo_file_name: file_name}, err2 => {
                if(err2) {
                    console.error("Express/delete/photo | Activity delete error " + err2);
                    response.status(400).send();
                    return;
                } else {
                    console.log("Express/delete/photo | Activities deleted. 200.");                    
                    response.status(200).send();
                    return;
                }
            });                        
        }
    });
});

/*
 * URL /delete/user - Delete the currently logged in user 
 */
app.post('/delete/user', function (request, response) {            
    console.log("Express/delete/user | Called");
    
    // If no user logged in, return 400
    if(request.session.user === undefined) {
        response.status(400).send();        
        console.log("Express/delete/user | Status 400. No user logged in");
        return;
    }

    var user_id = request.session.user._id;
    // First, delete all photos
    Photo.remove({user_id: user_id}, (err) => {
        if(err) {
            console.error("Express/delete/user | Photo deletion failed: " + err);
            response.status(400).send();
            return;
        } else {
            console.log("Express/delete/user | Photo deletion success.");
            // Second, delete all comments
            // For every photo, search through every comment; identify and delete
            // the ones associated with this user            
            var query = Photo.find({});
            query.exec((err2, photos) => {
                if(err2) {
                    console.error("Express/delete/user | Comment deletion failed: " + err2);
                    response.status(400).send();
                    return;
                } else {
                    for(var i = 0; i < photos.length; i++)
                    {
                        var numComments = photos[i].comments.length;
                        for(var j = 0; j < numComments; j++)
                        {
                            if(String(photos[i].comments[j].user_id) === String(user_id))
                            {
                                photos[i].comments.splice(j,1);
                                numComments--;
                            }
                        }
                        photos[i].save();
                    }
                    console.log("Express/delete/user | Comment deletion success.");
                    // Third, delete activites (a) done by user, (b) done on photos of user
                    Activity.remove({ $or: [{ user_id: user_id }, { photo_user_id: user_id }] }, (err3) => {
                        if(err3) {
                            console.error("Express/delete/user | Activities deletion failed");
                            response.status(400).send();
                            return;
                        } else {
                            console.log("Express/delete/user | Activities deletion success.");
                            // Finally, delete the User object
                            User.remove({_id: user_id}, (err4) => {                                
                                if(err4) {
                                    console.error("Express/delete/user | User deletion error");
                                    response.status(400).send();
                                } else {
                                    console.log("Express/delete/user | User deletion success.");                                    
                                    // Logout the user & respond to request
                                    console.log("Express/delete/user | Successful logout of " + request.session.user.login_name);
                                    delete request.session.user;
                                    request.session.destroy();
                                    response.status(200).send();
                                    console.log("Express/delete/user | Status 200. Entire user deletion complete.");
                                }
                            });
                        }
                    });
                }                
            });
        }
    });
});

var server = app.listen(3000, function () {
    var port = server.address().port;
    console.log('Listening at http://localhost:' + port + ' exporting the directory ' + __dirname);
});