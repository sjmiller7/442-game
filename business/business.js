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

    // Check that the user isn't supposed to be in a game
    let inGame = await db.getGamePlayer(user.uID);
    let userStatus;
    // Update user status to in game
    if (inGame) {
        userStatus = 'in game';
        let status = await db.updateUserStatus(user.uID, 'in game');
        if (!status.updated) {
            return {error: `There was an error logging you in. Please try again.`}
        }
    }
    // Update user status to online
    else {
        userStatus = 'online';
        let status = await db.updateUserStatus(user.uID, 'online');
        if (!status.updated) {
            return {error: `There was an error logging you in. Please try again.`}
        }
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
            return {token: token, status: userStatus};
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

// Store messages from the game
async function storeGameMsg(message) {
    var inserted = await db.insertGameMsg(message.id, message.msg, message.date, message.game);
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

// Decline an invitation
async function decline(id) {
    // Check that this exists
    //      also get the ids so we know whose uis to refresh
    var inviteExists = await db.verifyInviteId(id);
    if (!inviteExists) {
        return {error: 'This invitation does not exist. Please invite the user to a game.'}
    }

    // Decline invitation
    var declineInvite = await db.declineInvite(id);
    if (!declineInvite.updated) {
        return {error: 'There was an issue declining your invitation. Please try again.'}
    }

    // Send back the users whose uis need to be refreshed
    return [inviteExists.to, inviteExists.from];
}

// Accept an invitation
async function accept(id) {
    // Check that this exists
    //      also get the ids so we know who's meant to be in the game
    var inviteExists = await db.verifyInviteId(id);
    if (!inviteExists) {
        return {error: 'This invitation does not exist. Please invite the user to a game.'}
    }

    // Check that both users are online and not in a game
    var playersAvailable = await db.verifyAvailability([inviteExists.to, inviteExists.from]);
    // I'm checking both instead of just one because why not 
    if (!playersAvailable) {
        return {error: 'The other player is offline or in a game. Please wait to accept the invitation when they are online.'}
    }

    // Accept invitation
    var acceptInvite = await db.acceptInvite(id);
    if (!acceptInvite) {
        return {error: 'There was an issue accepting your invitation. Please try again.'}
    }

    // Create game object
    var game = await db.createGame(inviteExists.from, inviteExists.to);
    if (!game) {
        return {error: 'There was an error creating the game. Please try to invite again.'}
    }

    // Create pieces
    var pieces = await db.createPieces(game);
    if (!pieces) {
        return {error: 'There was an error creating the game. Contact an admin for help.'}
    }

    // Create board
    var board = await db.createBoard(game);
    if (!board) {
        return {error: 'There was an error creating the game. Contact an admin for help.'}
    }
    
    // Change statuses to in game
    var fromStatus = db.updateUserStatus(inviteExists.from, "in game");
    var toStatus = db.updateUserStatus(inviteExists.to, "in game");

    // Send back the users whose uis need to be refreshed
    return {users: [inviteExists.to, inviteExists.from], gID: game};
}

// Get game info based on user id of a player
async function gameInfoPlayer(uID) {
    // Get general game info
    var game = await db.getGamePlayer(uID);
    if (!game) {
        return {error: 'You are not in a game. Please return to the lobby.'};
    }

    // Get board info
    var board = await db.getBoard(game.gID);
    if (!board) {
        return {error: 'Error retrieving game data. Please contact an admin.'}
    }

    // Get piece info
    var piecesArr = await db.getPieces(game.gID);
    if (!piecesArr) {
        return {error: 'Error retrieving game data. Please contact an admin.'}
    }

    // Reformat piece data into a more processable format for the ui
    let pieces = {
        board: [],
        white: [],
        black: [],
    };
    piecesArr.forEach(function(piece) {
        switch(piece.status) {
            case "board":
                pieces.board.push(piece.id);
                break;
            case "white":
                pieces.white.push(piece.id);
                break;
            case "black":
                pieces.black.push(piece.id);
                break;
        }
    });

    // Get opponent info (sends the uID that isn't our user)
    var oppID;
    let color;
    if (uID == game.black) {
        oppID = game.white;
        color = "white";
    }
    else {
        oppID = game.black;
        color = "black";
    }
    var opponent = await db.getOpponent(oppID);
    if (!opponent) {
        return {error: 'Error retrieving opponent data.'};
    }
    opponent.color = color;

    return {game: {gID: game.gID, turn: game.turn, status: game.status}, board: board, pieces: pieces, opponent: opponent};
}

// Get game info based on game id
async function gameInfo(gID) {
    // Get general game info
    var game = await db.getGame(gID);
    if (!game) {
        return {error: 'This game does not exist or has completed. Please return to the lobby.'};
    }

    return {game: {gID: game.gID, turn: game.turn, status: game.status}};
}

// Check if the user is supposed to be in a game
async function inGame(uID) {
    // Get possible game user is in
    let inGame = await db.getGamePlayer(uID);

    if (inGame) {
        return true;
    }

    return false;
}

// Get moves to play
async function getMoves(gID) {
    // Get general game info
    var game = await db.getGame(gID);
    if (!game) {
        return {error: 'This game does not exist or has completed. Please return to the lobby.'};
    }

    // Get board info
    var board = await db.getBoard(game.gID);
    if (!board) {
        return {error: 'Error retrieving game data. Please contact an admin.'}
    }

    // Go square by square to check for available moves
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (canOutflank(board, r, c, board.rows[r].cols[c], game.turn)) {
                moves.push(`#square${r}${c}`); // puts the exact id of the square so we can queryselect it 
            }
        }
    }

    return {moves: moves};
}

// INTERNAL FUNCTION - checks to see if placing a piece of a given color in a given square can outflank any of the opponents pieces
// (stops with first outflank found)
// im sorry this is so horrendous im sure i could have figured out something more efficeint with more time and energy but i have 12 hours until its due so no
function canOutflank(board, startRow, startCol, square, color) {
    // Check that the square is empty in the first place
    if (square.id) {
        return false;
    }

    // Check up
    if (startRow > 1) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        for (let r = startRow - 1; r >= 0; r--) {
            // There's not a piece here
            if (!board.rows[r].cols[startCol].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[startCol].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }
    
    // Check down
    if (startRow < 6) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        for (let r = startRow + 1; r <= 7; r++) {
            // There's not a piece here
            if (!board.rows[r].cols[startCol].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[startCol].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check left
    if (startCol > 1) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        for (let c = startCol - 1; c >= 0; c--) {
            // There's not a piece here
            if (!board.rows[startRow].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[startRow].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check right
    if (startCol < 6) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        for (let c = startCol + 1; c <= 7; c++) {
            // There's not a piece here
            if (!board.rows[startRow].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[startRow].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check up-left
    if (startRow > 1 && startCol > 1) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        let r = startRow - 1;
        let c = startCol - 1;
        while (r >= 0 && c >= 0) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
            r--;
            c--;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check up-right
    if (startRow > 1 && startCol < 6) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        let r = startRow - 1;
        let c = startCol + 1;
        while (r >= 0 && c <= 7) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
            r--;
            c++;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check down-right
    if (startRow < 6 && startCol < 6) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        let r = startRow + 1;
        let c = startCol + 1;
        while (r <= 7 && c <= 7) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
            r++;
            c++;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // Check down-left
    if (startRow < 6 && startCol > 1) { // Need at least two so we can outflank
        let outflanked = 0;
        let endReached = false;
        let r = startRow + 1;
        let c = startCol - 1;
        while (r <= 7 && c >= 0) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked++;
            }
            r++;
            c--;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked > 0) {
            return true;
        }
    }

    // No ways to outflank
    return false;
}



// Make move
async function makeMove(token, gID, row, col) {
    // Get uID of user
    var decoded = await jwt.verify(token, process.env.TOKEN_KEY);

    // Get general game info
    var game = await db.getGame(gID);
    if (!game) {
        return {error: 'This game does not exist or has completed. Please return to the lobby.'};
    }

    // Check that it's the user's turn
    if ((game.turn == 'black' && game.black != decoded.uID) || (game.turn == 'white' && game.white != decoded.uID)) {
        return {error: 'It is not your turn please wait.'}
    }

    // Get board info
    var board = await db.getBoard(game.gID);
    if (!board) {
        return {error: 'Error retrieving game data. Please contact an admin.'}
    }

    // Check that the move is possible and get bits to flip
    let flips = toFlip(board, row, col, board.rows[row].cols[col], game.turn)
    if (flips.length == 0) {
        return {error: 'This move does not outflank any squares.'};
    }

    // Move piece in DB
    var moved = await db.movePiece(gID, board, row, col, flips, game.turn);
    if (!moved) {
        return {error: 'Issue moving piece'};
    }

    // Change turn
    var changed = await db.changeTurn(gID, game.turn);
    if (!changed) {
        return {error: 'Issue changing turn'};
    }

    return {flips: flips, moved: moved};
}

// INTERNAL FUNCTION - checks to see what pieces need to be flipped 
// (doubles as a move validator)
// im sorry this is so horrendous im sure i could have figured out something more efficeint with more time and energy but i have 12 hours until its due so no
function toFlip(board, startRow, startCol, square, color) {
    let flips = [];

    // Check that the square is empty in the first place
    if (square.id) {
        return flips;
    }

    // Check up
    if (startRow > 1) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        for (let r = startRow - 1; r >= 0; r--) {
            // There's not a piece here
            if (!board.rows[r].cols[startCol].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[startCol].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[startCol].id);
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }
    
    // Check down
    if (startRow < 6) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        for (let r = startRow + 1; r <= 7; r++) {
            // There's not a piece here
            if (!board.rows[r].cols[startCol].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[startCol].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[startCol].id);
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Check left
    if (startCol > 1) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        for (let c = startCol - 1; c >= 0; c--) {
            // There's not a piece here
            if (!board.rows[startRow].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[startRow].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[startRow].cols[c].id);
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Check right
    if (startCol < 6) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        for (let c = startCol + 1; c <= 7; c++) {
            // There's not a piece here
            if (!board.rows[startRow].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[startRow].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[startRow].cols[c].id);
            }
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked)
        }
    }

    // Check up-left
    if (startRow > 1 && startCol > 1) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        let r = startRow - 1;
        let c = startCol - 1;
        while (r >= 0 && c >= 0) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[c].id);
            }
            r--;
            c--;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Check up-right
    if (startRow > 1 && startCol < 6) { // Need at least two so we can outflank
        console.log('this');
        let outflanked = [];
        let endReached = false;
        let r = startRow - 1;
        let c = startCol + 1;
        console.log('r:' + r + 'c:' + c)
        while (r >= 0 && c <= 7) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[c].id);
            }
            r--;
            c++;
        }
        // Determine if we've outflanked anything
        console.log(endReached);
        console.log(outflanked);
        console.log(color);
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Check down-right
    if (startRow < 6 && startCol < 6) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        let r = startRow + 1;
        let c = startCol + 1;
        while (r <= 7 && c <= 7) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[c].id);
            }
            r++;
            c++;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Check down-left
    if (startRow < 6 && startCol > 1) { // Need at least two so we can outflank
        let outflanked = [];
        let endReached = false;
        let r = startRow + 1;
        let c = startCol - 1;
        while (r <= 7 && c >= 0) {
            // There's not a piece here
            if (!board.rows[r].cols[c].id) {
                break;
            }
            // There's a piece here and it's the user's color
            else if (board.rows[r].cols[c].color == color) {
                endReached = true; // shows that we can outflank bc there's something on the other side
                break;
            }
            // There's a piece you can flip here 
            else {
                outflanked.push(board.rows[r].cols[c].id);
            }
            r++;
            c--;
        }
        // Determine if we've outflanked anything
        if (endReached && outflanked.length > 0) {
            flips = flips.concat(outflanked);
        }
    }

    // Send back pieces to flip
    return flips;
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
    storeGameMsg,
    getUserList,
    invite,
    getInvites,
    decline,
    accept,
    gameInfoPlayer,
    gameInfo,
    inGame,
    getMoves,
    makeMove
}