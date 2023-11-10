var db = require('../data/data');

// Password hashing
const bcrypt = require('bcrypt');
const saltRounds = 13;

function test() {
    return db.getUserExists('sjm');
}

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
            if (userCreated) {
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
    newUser
}