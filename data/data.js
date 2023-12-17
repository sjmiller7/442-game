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

// Store game messages
async function insertGameMsg(id, message, date, game) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO game_message (uID, gID, message, date) VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000))',
    [id, game, message, date]
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

// Verify that an invite exists (from and to)
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

// Verify that an invite exists (id)
async function verifyInviteId(id) {
  // Query 
  const rows = await db.query(
    'SELECT `from`, `to` FROM invitation WHERE `id`=? AND `status`="pending";',
    [id]
  );
  const data = helper.emptyOrRows(rows);
  // Invite does not exist
  if (data.length == 0) {
    return false;
  }
  return data[0];
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

// Decline an invitation
async function declineInvite(id) {
  // Query for update
  const result = await db.query(
    'UPDATE invitation SET status="declined" WHERE id=?',
    [id]
  );
  // Return success if updated
  if (result.affectedRows > 0) {
    return { updated: true };
  }
  // Errors
  return { updated: false };
}

// Accept an invitation
async function acceptInvite(id) {
  // Query for update
  const result = await db.query(
    'UPDATE invitation SET status="accepted" WHERE id=?',
    [id]
  );
  // Return success if updated
  if (result.affectedRows > 0) {
    return { updated: true };
  }
  // Errors
  return { updated: false };
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

// Verify that users are availble for a game
async function verifyAvailability(users) {
  // Query 
  const rows = await db.query(
    'SELECT status FROM user WHERE uID IN (?, ?)',
    users
  );
  const data = helper.emptyOrRows(rows);
  // Something has gone horrifically wrong / a user doesn't exist
  if (data.length != 2) {
    return false;
  }
  // Check statuses
  if (data[0].status !== 'online' || data[1].status !== 'online') {
    return false;
  }
  return true;
}

// Create a game
async function createGame(from, to) {
  // Query for insertion
  const result = await db.query(
    'INSERT INTO game (black, white, turn, status) VALUES (?, ?, "black", "ongoing")',
    [from, to]
  );
  // Return success if inserted
  if (result.affectedRows > 0) {
    return result.insertId;
  }
  // Errors
  return false;
}

// Create pieces for a game
async function createPieces(gID) {
  // We're gonna call this half-assed safety. 

  // Piece statuses (30 assigned to white, 30 assigned to black, 4 placed on board) template
  // ?s for the gID
  let insertData = '';
  for (let a = 0; a < 4; a++) {
    insertData += '("board", ?), ';
  }
  for (let b = 0; b < 30; b++) {
    insertData += '("white", ?), ("black", ?), '
  }
  insertData = insertData.substring(0, insertData.length - 2); // cut off trailing comma & space
  insertData += ';';

  // gID in array 64 times to fill the ?s
  let ids = Array(64).fill(gID);

  // Query for insertion
  const result = await db.query(
    'INSERT INTO piece (status, gID) VALUES ' + insertData,
    ids
  );
  // Return success if inserted
  if (result.affectedRows == 64) {
    return true;
  }
  // Errors
  return false;
}

// Create board for a game
async function createBoard(gID) {
  // Get the pieces that go on the board
  const rows = await db.query(
    'SELECT id FROM piece WHERE gID = ? AND status = "board";',
    [gID]
  );
  const data = helper.emptyOrRows(rows);
  // ERR checking
  if (data.length != 4) {
    return false;
  }

  // Make JSON gameboard
  let board = {
    rows: 
    [
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
      {cols: [{}, {}, {}, {id: data[0], color: "black"}, {id: data[0], color: "white"}, {}, {}, {}]},
      {cols: [{}, {}, {}, {id: data[0], color: "white"}, {id: data[0], color: "black"}, {}, {}, {}]},
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
      {cols: [{}, {}, {}, {}, {}, {}, {}, {}]},
    ]
  }

  // Query for insertion
  const result = await db.query(
    'INSERT INTO board (gID, board) VALUES (?, ?);',
    [gID, board]
  );
  // Return success if inserted
  if (result.affectedRows == 1) {
    return true;
  }
  // Errors
  return false;
}

// Get game info based on a player's id
async function getGamePlayer(uID) {
  // Query 
  const rows = await db.query(
    'SELECT * FROM game WHERE (black = ? OR white = ?) AND status = "ongoing";',
    [uID, uID]
  );
  const data = helper.emptyOrRows(rows);
  // Something has gone horrifically wrong / a game doesnt exist
  if (data.length != 1) {
    return false;
  }
  return data[0];
}

// Get board info
async function getBoard(gID) {
  // Query 
  const rows = await db.query(
    'SELECT board FROM board WHERE gID = ?;',
    [gID]
  );
  const data = helper.emptyOrRows(rows);
  // Something has gone horrifically wrong
  if (data.length != 1) {
    return false;
  }
  return data[0];
}

// Get piece info
async function getPieces(gID) {
  // Query 
  const rows = await db.query(
    'SELECT id, status FROM piece WHERE gID = ?;',
    [gID]
  );
  const data = helper.emptyOrRows(rows);
  // Something has gone horrifically wrong
  if (data.length != 64) {
    return false;
  }
  return data;
}

// Get opponent info based on a player's id
async function getOpponent(uID) {
  // Query 
  const rows = await db.query(
    'SELECT uID, username FROM user WHERE uID = ?;',
    [uID]
  );
  const data = helper.emptyOrRows(rows);
  // Something has gone horrifically wrong / a game doesnt exist
  if (data.length != 1) {
    return false;
  }
  return data[0];
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
  insertGameMsg,
  getUserList,
  verifyInvite,
  verifyInviteId,
  createInvite,
  declineInvite,
  acceptInvite,
  getInvitesTo,
  getInvitesFrom,
  verifyAvailability,
  createGame,
  createPieces,
  createBoard,
  getGamePlayer,
  getBoard,
  getPieces,
  getOpponent,
}