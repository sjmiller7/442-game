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
function test() {
    return db.getUserExists('sjm');
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
        return {error: 'There was an issue creating your sesion. Please try again.'};
    }
    else {
        return {error: 'There was an issue creating your sesion. Please try again.'};
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
        return null;
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

module.exports = {
    test,
    createRegToken,
    checkRegToken,
    newUser,
}