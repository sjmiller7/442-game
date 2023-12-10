// Data layer
var db = require('../data/data');

// Password hashing
const bcrypt = require('bcrypt');
const saltRounds = 13;

// Token generation
const jwt = require('jsonwebtoken');

// Env 
require('dotenv').config();

// Test stuff
async function test() {
    let test = await db.getUserExists('sjm');
    return test;
}

// Creating registration tokens
async function createRegToken(uAgent, ip, date) {
    // Create jwt
    const token = jwt.sign(
        { 
            user_agent: uAgent,
            address: ip,
            date: date
        },
        process.env.TOKEN_KEY
    );

    // Hash jwt
    let hash = await new Promise((resolve, reject) => { 
        bcrypt.hash(token, saltRounds, function(err, hash) {
            if (err) {
                reject(err);
            }
            resolve(hash);
        });
    });

    // Store hash
    if (hash.length > 0) {
        let sessionCreated = await db.newRegSess(hash);
        if (sessionCreated.inserted) {
            return {token: token, id: sessionCreated.id};
        }
        // Error
        return {error: 'There was an issue creating your session. Please try again.'};
    }
    else {
        return {error: 'There was an issue creating your session. Please try again.'};
    }
}

// Check registration tokens
async function checkRegToken(token, id, uAgent, ip) {
    // Check token data
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);
    if (decoded.user_agent != uAgent || decoded.address != ip || parseInt(decoded.date) <= Date.now()) {
        return false;
    }

    // Check for token in stored register sessions
    let sessionCreated = await db.checkRegSess(id);
    if (sessionCreated.hash) {
        // Verify hash
        let result = await new Promise((resolve, reject) => {
            bcrypt.compare(token, sessionCreated.hash).then(function(result) {
                resolve(result);
            });
        });
        return result;
    }
    else {
        // Error
        return false;
    }
}

// Make new user acct
async function newUser(username, password) {
    // Check for unique username
    let unameExists = await db.getUserExists(username);
    if (unameExists.exists) {
        // Return duplicate username error
        return {error: 'That username already exists. Please try again.'};
    }
    else {
        // Hash password
        let hash = await new Promise((resolve, reject) => { 
            bcrypt.hash(password, saltRounds, function(err, hash) {
                if (err) {
                    reject(err);
                }
                resolve(hash);
            });
        });

        // Insert into db
        if (hash.length > 0) {
        let userCreated = await db.insertNewUser(username, hash);
            if (userCreated.inserted) {
                return userCreated;
            }
            // Error
            return {error: 'There was an issue creating your account. Please try again.'};
        }
        else {
            return {error: 'There was an issue with your password. Please try again.'};
        }
    }
}

// Login
async function login(username, password, uAgent, ip, date) {
    // Get user from db
    let user = await db.getUser(username)
    if (user.error) {
        return {error: `This user does not exist.`}
    }

    // Check password
    let validPass = await new Promise((resolve, reject) => {
        bcrypt.compare(password, user.password).then(function(result) {
            resolve(result);
        });
    });
    if(!validPass) {
        return {error: `Invalid username or password. Please try again.`}
    }

    // Update user status
    let status = await db.updateUserStatus(user.uID, 'online');
    if (!status.updated) {
        return {error: `There was an error logging you in. Please try again.`}
    }

    // Check for any existing sessions
    let sess = await db.checkSess(user.uID);
    if (sess.hash) {
        return {error: `There was an error logging you in. Please check that you are not logged in on another device and then try again in one minute.`}
    }
    
    // Create jwt
    const token = jwt.sign(
        { 
            user_agent: uAgent,
            address: ip,
            date: date,
            uID: user.uID,
            username: user.username
        },
        process.env.TOKEN_KEY
    );

    // Hash jwt
    let hash = await new Promise((resolve, reject) => { 
        bcrypt.hash(token, saltRounds, function(err, hash) {
            if (err) {
                reject(err);
            }
            resolve(hash);
        });
    });
    
    // Store hash
    if (hash.length > 0) {
        let sessionCreated = await db.newUserSess(user.uID, hash, date);
        if (sessionCreated.inserted) {
            // Send back token
            return {token: token};
        }
        // Error
        return {error: 'There was an issue creating your session. Please try again.'};
    }
    else {
        return {error: 'There was an issue creating your session. Please try again.'};
    }
}

// Check session tokens
async function checkSessToken(token, uAgent, ip) {
    // Check token data
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);
    if (decoded.user_agent != uAgent || decoded.address != ip || parseInt(decoded.date) <= Date.now()) {
        return false;
    }

    // Check for token in stored register sessions
    let sessionCreated = await db.checkSess(decoded.uID);
    if (sessionCreated.hash) {
        // Verify hash
        let result = await new Promise((resolve, reject) => {
            bcrypt.compare(token, sessionCreated.hash).then(function(result) {
                resolve(result);
            });
        });
        return result;
    }
    else {
        // Error
        return false;
    }
}

// Logout
async function logout(token) {
    // Decode token
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    // Delete session
    let del = await db.delSess(decoded.uID);
    if (!del.deleted) {
        return {error: 'There was an error logging you out. Please try again.'}
    }

    // Change status to offline
    let status = await db.updateUserStatus(decoded.uID, 'offline');
    if (!status.updated) {
        return {error: `There was an error logging you out. Please try again.`}
    }

    return {deleted: true}
}

// Parsing a cookie (for the one place I can't use cookieParser with ws)
function getTokenCookie(cookie) {
    let name = "session_token=";
    let decodedCookie = decodeURIComponent(cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}

// Getting user info from their token
async function getUserInfo(token) {
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    return {uID: decoded.uID, username: decoded.username}
}

// Deleting all expired sessions
async function delExpSess() {
    var deleted = await db.delExpSess();
    return {deleted: deleted};
}

// Store messages from the lobby
async function storeLobbyMsg(message) {
    var inserted = await db.insertLobbyMsg(message.id, message.msg, message.date);
    return {inserted: inserted};
}

// Getting list of users
async function getUserList(token) {
    // Getting uID to exclude user
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    // Get user list
    let users = await db.getUserList(decoded.uID);

    return users;
}

// Invite user to a game
async function invite(token, id) {
    // Get uID of from user
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    // Check that this doesn't exist already
    var inviteExists = await db.verifyInvite(decoded.uID, id);
    if (inviteExists) {
        return {error: 'You already have an invitation with this user. Check your invitations list.'}
    }

    // Create invitation
    var createInvite = await db.createInvite(decoded.uID, id);
    if (!createInvite) {
        return {error: 'There was an issue making your invitation. Please try again.'}
    }
    return [decoded.uID, id];
}

// Get invites to display for user
async function getInvites(token) {
    // Get uID of from user
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    // Why are these seperate queries/lists? To make UI handling easier. 

    // Why show invitationh status if all of them are pending? preventing confusion ig idk

    // Get invites to this user
    var toUser = await db.getInvitesTo(decoded.uID);

    // Get invites from this user
    var fromUser = await db.getInvitesFrom(decoded.uID);

    // Send invites
    return {to: toUser, from: fromUser};
}

module.exports = {
    test,
    createRegToken,
    checkRegToken,
    newUser,
    login,
    checkSessToken,
    logout,
    getTokenCookie,
    getUserInfo,
    delExpSess,
    storeLobbyMsg,
    getUserList,
    invite,
    getInvites,
}