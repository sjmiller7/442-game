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
async function newUserSess(id, token, date) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO session (uID, session_token, expires) VALUES (?, ?, FROM_UNIXTIME(? / 1000))',
    [id, token, date]
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

// Delete all expired sessions
async function delExpSess() {
    // Query for expired sessions
    const sessRows = await db.query(
      'SELECT uID FROM session WHERE expires <= NOW();',
      []
    );
    const sessData = helper.emptyOrRows(sessRows);
    // No expired sessions? we're done
    if (sessData.length == 0) {
      return true;
    }

    // Convert ids to query
    let convertedIDs = sessData.map(function (sess) { return sess.uID; });

    // Dynamic amount of question marks for prepared statements
    // For why, follow this github thread: https://github.com/sidorares/node-mysql2/issues/1524
    let placeholders = Array(convertedIDs.length).fill("?").join();

    // Delete expired sessions
    const delResult = await db.query(
      'DELETE FROM session WHERE uID IN (' + placeholders + ')',
      convertedIDs
    );
    // Return failure if not deleted
    if (delResult.affectedRows == 0) {
      return false;
    }

    // Change statuses to offline
    const statResult = await db.query(
      'UPDATE user SET status="offline" WHERE uID IN (' + placeholders + ')',
      convertedIDs
    );
    // Return failure if not updated
    if (statResult.affectedRows == 0) {
      return false;
    }
  
    // Everything's done
    return true;
}

// Store lobby messages
async function insertLobbyMsg(id, message, date) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO lobby_message (uID, message, date) VALUES (?, ?, FROM_UNIXTIME(? / 1000))',
    [id, message, date]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return true;
  }
  // Errors
  return false;
}

// Get online users
async function getUserList(uID) {
  // Query for other users
  const rows = await db.query(
    'SELECT uID, status, username FROM user WHERE uID != ? ORDER BY FIELD(status, "online", "in game", "offline");',
    [uID]
  );
  const data = helper.emptyOrRows(rows);
  // No error checking-- if there's no users, there's just nothing in the box
  return data;
}

// Verify that an invite exists
async function verifyInvite(from, to) {
  // Query 
  const rows = await db.query(
    'SELECT id FROM invitation WHERE (`from`=? AND `to`=? AND `status`="pending") OR (`to`=? AND `from`=? AND `status`="pending")',
    [from, to, from, to]
  );
  const data = helper.emptyOrRows(rows);
  // Invite does not exist
  if (data.length == 0) {
    return false;
  }
  return true;
}

// Create an invitation
async function createInvite(from, to) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO invitation (`from`, `to`, `status`) VALUES (?, ?, "pending")',
    [from, to]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return true;
  }
  // Errors
  return false;
}

// Get invites to a user
async function getInvitesTo(uID) {
  // Query for invites
  const rows = await db.query(
    'SELECT id, `from`, username, invitation.status FROM invitation INNER JOIN user ON `from` = uID WHERE `to` = ? AND invitation.status = "pending";',
    [uID]
  );
  const data = helper.emptyOrRows(rows);
  // No error checking-- if there's no invites, there's just nothing in the box
  return data;
}

// Get invites to a user
async function getInvitesFrom(uID) {
  // Query for invites
  const rows = await db.query(
    'SELECT id, `to`, username, invitation.status FROM invitation INNER JOIN user ON `to` = uID WHERE `from` = ? AND invitation.status = "pending";',
    [uID]
  );
  const data = helper.emptyOrRows(rows);
  // No error checking-- if there's no invites, there's just nothing in the box
  return data;
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
  delSess,
  delExpSess,
  insertLobbyMsg,
  getUserList,
  verifyInvite,
  createInvite,
  getInvitesTo,
  getInvitesFrom
}