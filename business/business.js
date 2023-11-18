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
    if (decoded.user_agent != uAgent || decoded.address != ip || parseInt(decoded.date) > Date.now() + 3600000) {
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
        return {error: `This user does not exist. <a href='/newUser'>Create Account</a>`}
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
        let sessionCreated = await db.newUserSess(user.uID, hash);
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
    if (decoded.user_agent != uAgent || decoded.address != ip || parseInt(decoded.date) > Date.now() + 3600000) {
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

module.exports = {
    test,
    createRegToken,
    checkRegToken,
    newUser,
    login,
    checkSessToken,
    logout,
}