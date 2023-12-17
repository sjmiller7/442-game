// Imports and setup
const express = require('express');
const { check, validationResult } = require('express-validator');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
var app = express(); // Express app
const server = http.createServer(app); // server for ws
const lobbyWSS = new WebSocket.Server({ noServer: true }); // websockets server (lobby)
const gameWSS = new WebSocket.Server({ noServer: true }); // websockets server (games)
app.use(express.json()); // JSON parsing for input
app.use(cookieParser()); // Cookie parsing
var router = express.Router(); // Router for /api stuff. Anything on router is api, anything on app is a page
var biz = require('./business/business'); // Business layer


// Validators/sanitizers with express-validator
var usernameValidate = () => check('username').escape().notEmpty().isLength({ max: 45 }).trim();
var passValidate = () => check('password').escape().notEmpty().isLength({ max: 45 }).trim();
var idValidate = () => check('id').escape().notEmpty().isNumeric().trim();

// API requests (outide of login)
// Tester to make sure server is connected
router.get('/test', async (req, res) => {
    let test = await biz.test();
    return res.send(test);
});
// XSS tester
router.post('/test', usernameValidate(), (req, res) => {
    const result = validationResult(req);
    if (result.isEmpty()) {
        return res.send(`<p>${req.body.username}</p>`);
    }
    return res.send({ errors: result.array() });
});

// Create account
router.post('/newUser', usernameValidate(), passValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // Check register token
        let token = req.cookies.register_token;
        let id = req.cookies.visitor_id;
        if (token) {
            let tokenValidate = await biz.checkRegToken(token, id, req.headers['user-agent'], req.ip);
            if (tokenValidate) {
                // Create user
                let result = await biz.newUser(req.body.username, req.body.password);

                // Clear cookies
                if (result.inserted) {
                    res.clearCookie('register_token');
                    res.clearCookie('visitor_id');
                }

                return res.send(result);
            }
        }
        // Token error
        return res.send({ error: 'There was an issue with your session. Refresh and try again.' })
    }
    // If errors, send message
    return res.send({ error: 'Invalid username or password. Try again.' })
});

// Login
router.post('/login', usernameValidate(), passValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // Login
        let result = await biz.login(req.body.username, req.body.password, req.headers['user-agent'], req.ip, Date.now() + 3600000);
        
        // If credentials invalid, send error
        if (result.error) {
            return res.send(result);
        }
        // Put token in cookie
        res.cookie('session_token', result.token, {
            httpOnly: true,
            sameSite: 'strict',
            overwrite: true,
            maxAge: 3600000
        });
        // Send valid message
        return res.send({success: true});
    }
    // If errors, send message
    return res.send({ error: 'Invalid username or password. Try again.' })
});



// Pages (outside of login)
// Create account
app.get('/newUser', async (req, res) => {
    // if they're actually logged in, send them to log out first
    if (req.cookies.session_token) {
        return res.redirect('/othello/logout');
    }

    // Generate register token
    let tokenData = await biz.createRegToken(req.headers['user-agent'], req.ip, Date.now() + 3600000);

    // Put token in cookie
    res.cookie('register_token', tokenData.token, {
        httpOnly: true,
        sameSite: 'strict',
        overwrite: true,
        maxAge: 3600000
    });

    // Put token in cookie
    res.cookie('visitor_id', tokenData.id, {
        httpOnly: true,
        sameSite: 'strict',
        overwrite: true,
        maxAge: 3600000
    });

    // Send page
    return res.sendFile(path.join(__dirname, '/pages/login/newUser.html'));
});

// Login
app.get('/login', (req, res) => {
    // if they're actually logged in, send them to log out first
    if (req.cookies.session_token) {
        return res.redirect('/othello/logout');
    }

    return res.sendFile(path.join(__dirname, '/pages/login/login.html'));
});

// Login middleware starts here

// API requests (inside of login)
// Check that they're logged in
router.use('/', async (req, res, next) => {
    let token = req.cookies.session_token;
    if (token) {
        let result = biz.checkSessToken(token, req.headers['user-agent'], req.ip);
        if (result) {
            // Logged in, proceed
            next();
        }
        else {
            // Force logout bc token might be stolen and we want the real user to be safe
            let result = await biz.logout(token);
            if (result.deleted) {
                res.clearCookie('session_token');
            }

            // badSession is so we can check in AJAX results and just auto redirect if we want
            // Error is in case we don't check haha
            res.send({badSession: true, error: 'Your session timed out. Please <a href="/login">log in</a>.'});
        }
    }
    else {
        // badSession is so we can check in AJAX results and just auto redirect if we want
        // Error is in case we don't check haha
        res.send({badSession: true, error: 'Your session timed out. Please <a href="/login">log in</a>.'});
    }
})

// Logout
router.post('/logout', async (req, res) => {
    // Get session token
    let token = req.cookies.session_token;
    if (token) {
        let result = await biz.logout(token);
        if (result.deleted) {
            res.clearCookie('session_token');
        }
        return res.send(result);
    }
    else {
        // Token error
        return res.send({ error: 'There was an issue with your session. Refresh and try again.' })
    }
});

// Lobby info
router.get('/lobby', async (req, res) => {
    // Get session token
    let token = req.cookies.session_token;

    // Get user info
    let userInfo = await biz.getUserInfo(token);

    // Get list of users for invitations
    let online = await biz.getUserList(token);

    // Get list of invitations 
    let invitations = await biz.getInvites(token);

    return res.send({ user: userInfo, userList: online, invitations: invitations });
});

// Invite user to a game
router.post('/invite', idValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // Get session token
        let token = req.cookies.session_token;

        // Generate invite
        let invite = await biz.invite(token, req.body.id);

        // Tell clients to refresh their invites if they're involved
        if (!invite.error) {
            lobbyWSS.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                client.send(`{"type": "invite", "users": [${invite}]}`);
                }
            });
        }

        // Send response
        return res.send(invite);
    }
    res.send({error: 'Invalid user. Please try again.'});
})

// Get users for display
router.get('/users', async (req, res) => {
    // Get session token
    let token = req.cookies.session_token;

    // Get list of users for invitations
    let online = await biz.getUserList(token);

    // Send response
    return res.send(online);
})

// Get invitations for display
router.get('/invites', async (req, res) => {
    // Get session token
    let token = req.cookies.session_token;

    // Get invites for this user
    let invites = await biz.getInvites(token);

    // Send response
    return res.send(invites);
})

// Decline a game invite
router.put('/decline', idValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // Decline invite
        let declined = await biz.decline(req.body.id);

        // Tell clients to refresh their invites if they're involved
        if (!declined.error) {
            lobbyWSS.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    // Invite can serve double purpose, since all it's doing is triggering a ui refresh for listed users
                    client.send(`{"type": "invite", "users": [${declined}]}`);
                }
            });
        }

        // Send response
        return res.send(declined);
    }
    res.send({error: 'Invalid invite. Please try again.'});
})

// Accept a game invite
router.put('/accept', idValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // Accept invite + set up game
        let accepted = await biz.accept(req.body.id);

        // Send notif to players to redirect to game
        if (!accepted.error) {
            lobbyWSS.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    // This will trigger a redirect to the game page 
                    client.send(`{"type": "game", "users": [${accepted.users}], "gID": ${accepted.gID}}`);
                }
            });
        }

        // Send data/errors
        return res.send(accepted);
    }
    res.send({error: 'Invalid invite. Please try again.'});
})

// Game info
router.get('/game', async (req, res) => {
    // Get session token
    let token = req.cookies.session_token;

    // Get user info
    let userInfo = await biz.getUserInfo(token);

    // Get the game that the user is in
    let game = await biz.gameInfoPlayer(userInfo.uID);

    // Building return object out of the data recieved
    game.user = userInfo;

    return res.send(game);
});


// Pages (inside of login)
// Check that they're logged in
app.use('/othello', async (req, res, next) => {
    let token = req.cookies.session_token;
    if (token) {
        let result = biz.checkSessToken(token, req.headers['user-agent'], req.ip);
        if (result) {
            // Logged in, proceed
            next();
        }
        else {
            // Force logout bc token might be stolen and we want the real user to be safe
            let result = await biz.logout(token);
            if (result.deleted) {
                res.clearCookie('session_token');
            }

            res.redirect('/login');
        }
    }
    else {
        res.redirect('/login');
    }
});

// Lobby
app.get('/othello/lobby', (req, res) => {
    return res.sendFile(path.join(__dirname, '/pages/lobby/lobby.html'));
});

// Game
app.get('/othello/game', (req, res) => {
    // Regenerate session token-- just to be safe on timing if someone's been playing for a while
    // req.body.username, req.headers['user-agent'], req.ip, Date.now() + 3600000
    // or maybe just pass in current token

    // Put token in cookie
    // res.cookie('session_token', result.token, {
    //     httpOnly: true,
    //     sameSite: 'strict',
    //     overwrite: true,
    //     maxAge: 3600000
    // });

    return res.sendFile(path.join(__dirname, '/pages/game/game.html'));
});

// Logout
app.get('/othello/logout', (req, res) => {
    return res.sendFile(path.join(__dirname, '/pages/login/logout.html'));
});



// WebSockets
// Lobby chat connection
lobbyWSS.on('connection', async function connection(ws) {
    // Error handling
    ws.on('error', console.error);

    // Message handling
    ws.on('message', async (message) => {
        // Store message
        let messageJS = JSON.parse(message);
        if (messageJS.type === 'msg') {
            let messageInsert = await biz.storeLobbyMsg(messageJS);
        }

        // Send message along
        lobbyWSS.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(`${message}`);
            }
          });
    });
});
// Game chat connection
gameWSS.on('connection', async function connection(ws) {
    // Error handling
    ws.on('error', console.error);

    // Message handling
    ws.on('message', async (message) => {
        // Store message
        let messageJS = JSON.parse(message);
        if (messageJS.type === 'msg') {
            let messageInsert = await biz.storeGameMsg(messageJS);
        }

        // Send message along
        gameWSS.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(`${message}`);
            }
          });
    });
});

// Handle routing of lobby vs game chats
server.on('upgrade', async function upgrade(request, socket, head) {
    // Authenticate
    let cookieToken = biz.getTokenCookie(request.headers.cookie);
    if (cookieToken) {
        let result = await biz.checkSessToken(cookieToken, request.headers['user-agent'], socket.remoteAddress);
        if (result) {
            // Authenticated, proceed with connection
            const { pathname } = url.parse(request.url);

            if (pathname === '/lobby') {
                lobbyWSS.handleUpgrade(request, socket, head, function done(ws) {
                lobbyWSS.emit('connection', ws, request);
                });
            } else if (pathname === '/game') {
                gameWSS.handleUpgrade(request, socket, head, function done(ws) {
                gameWSS.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        } else {
            socket.destroy();
        }
    } else {
        socket.destroy();
    }
});

// Start server for ws
server.listen(8080)

// Periodic check to delete expired sessions (1 minute interval)
setInterval(async function () { await biz.delExpSess()}, 60000);

// Finishing setup
app.use('/api', router);

// 404 err
// May be commented out because it was overriding some methods for literally no reason
app.get('*', (req, res) => {
    // redirect lost souls to the lobby'
    return res.send('<p>This page does not exist.</p><p><a href="/othello/lobby">Go to lobby</a></p><p><a href="/login">Go to login</a></p>');
})

app.use(cors({
    credentials: true,
    origin: 'http://localhost:5000'
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.listen(5000, function () {
    console.log('Started application on port %d', 5000);
});