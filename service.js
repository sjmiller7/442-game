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


// API requests
// Tester to make sure server is connected
router.get('/test', (req, res) => {
    return res.send(biz.test());
});
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
                return res.send(result);
            }
        }
        // Token error
        return res.send({ error: 'There was an issue with your session. Refresh and try again.' })
    }
    // If errors, send message
    return res.send({ error: 'Invalid username or password. Try again.' })
})


// Pages 
// Create account
app.get('/newUser', async (req, res) => {
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

// Log in
app.get('/login', (req, res) => {
    return res.sendFile(path.join(__dirname, '/pages/login/login.html'));
});


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