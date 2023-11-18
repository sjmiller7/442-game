// Imports and setup
const express = require('express');
const { check, validationResult } = require('express-validator');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
var app = express();
app.use(express.json());
app.use(cookieParser());
var router = express.Router();
var biz = require('./business/business');


// Validators/sanitizers with express-validator
var usernameValidate = () => check('username').escape().notEmpty().isLength({ max: 45 }).trim();
var passValidate = () => check('password').escape().notEmpty().isLength({ max: 45 }).trim();


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
        let result = await biz.login(req.body.username, req.body.password, req.headers['user-agent'], req.ip, Date.now());
        
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
        return res.sendFile(path.join(__dirname, '/pages/login/logout.html'));
    }

    // Generate register token
    let tokenData = await biz.createRegToken(req.headers['user-agent'], req.ip, Date.now());

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
        return res.sendFile(path.join(__dirname, '/pages/login/logout.html'));
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

            res.sendFile(path.join(__dirname, '/pages/login/login.html'));
        }
    }
    else {
        res.sendFile(path.join(__dirname, '/pages/login/login.html'));
    }
})

// Lobby
app.get('/othello/lobby', (req, res) => {
    return res.sendFile(path.join(__dirname, '/pages/lobby/lobby.html'));
});

// Logout
app.get('/othello/logout', (req, res) => {
    return res.sendFile(path.join(__dirname, '/pages/login/logout.html'));
});

// 404 err
app.get('*', (req, res) => {
    // redirect lost souls to the lobby
    return res.send('<p>This page does not exist.</p><p><a href="/othello/lobby">Go to lobby</a></p><p><a href="/login">Go to login</a></p>');
})


// Finishing setup
app.use('/api', router);
app.use(cors({
    credentials: true,
    origin: 'http://localhost:5000'
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.listen(5000, function () {
    console.log('Started application on port %d', 5000);
});