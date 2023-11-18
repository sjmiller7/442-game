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

// Get user info
async function getUser(username) {
  // Query for like usernames
  const rows = await db.query(
    'SELECT * FROM user WHERE username=?',
    [username]
  );
  const data = helper.emptyOrRows(rows);
  // Username does not yet exist
  if (data.length == 0) {
    return {error: true};
  }
  // Username already exists
  return data[0];
}

// Update user status
async function updateUserStatus(uID, status) {
  // Query for update
  const result = await db.query(
    'UPDATE user SET status=? WHERE uID=?',
    [status, uID]
  );
  // Return success if updated
  if (result.affectedRows > 0) {
    return { updated: true };
  }
  // Errors
  return { updated: false };
}

// Make a new session for user login
async function newUserSess(id, token) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO session (uID, session_token) VALUES (?, ?)',
    [id, token]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return { inserted: true };
  }
  // Errors
  return { inserted: false };
}

// Verify user session
async function checkSess(id) {
  // Query 
  const rows = await db.query(
    'SELECT * FROM session WHERE uID=?',
    [id]
  );
  const data = helper.emptyOrRows(rows);
  // Session does not exist
  if (data.length == 0) {
    return {hash: false};
  }
  return {hash: data[0].session_token};
}

// Delete user session
async function delSess(id) {
  // Query for deletion
  const result = await db.query(
    'DELETE FROM session WHERE uID = ?',
    [id]
  );
  // Return success if deleted
  if (result.affectedRows > 0) {
    return { deleted: true };
  }
  // Errors
  return { deleted: false };
}


module.exports = {
  newRegSess,
  checkRegSess,
  getUserExists,
  insertNewUser,
  getUser,
  updateUserStatus,
  newUserSess,
  checkSess,
  delSess
}