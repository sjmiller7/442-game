const db = require('./dbquery');
const helper = require('../dbhelper');
const config = require('../config');

// Make a new session for user registration
async function newRegSess(token) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO register_session (session_token) VALUES (?)',
    [token]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return { inserted: true, id: result.insertId };
  }
  // Errors
  return { inserted: false };
}

// Verify user registration session
async function checkRegSess(id) {
  // Query 
  const rows = await db.query(
    'SELECT * FROM register_session WHERE id=?',
    [id]
  );
  const data = helper.emptyOrRows(rows);
  // Session does not exist
  if (data.length == 0) {
    return {hash: false};
  }
  return {hash: data[0].session_token};
}

// Check if a username exists already
async function getUserExists(username) {
  // Query for like usernames
  const rows = await db.query(
    'SELECT username FROM user WHERE username=?',
    [username]
  );
  const data = helper.emptyOrRows(rows);
  // Username does not yet exist
  if (data.length == 0) {
    return {exists: false};
  }
  // Username already exists
  return {exists: true};
}

// Create new user
async function insertNewUser(username, password) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO user (status, username, password) VALUES ("offline", ?, ?)',
    [username, password]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return { inserted: true };
  }
  // Errors
  return { inserted: false };
}

module.exports = {
  newRegSess,
  checkRegSess,
  getUserExists,
  insertNewUser
}