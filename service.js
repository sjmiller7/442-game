const express = require('express');
const { check, validationResult } = require('express-validator');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

var app = express();
app.use(express.json());

var router = express.Router();

var biz = require('./business/business');

// Validators/sanitizers with express-validator
var usernameValidate = () => check('username').notEmpty().isLength({max: 45}).trim().escape();
var passValidate = () => check('password').notEmpty().isLength({max: 45}).trim().escape();

// API requests
// Tester to make sure server is connected
router.get('/test', (req, res) => {
    res.send(biz.test());
});
router.post('/test', usernameValidate(), (req, res) => {
    const result = validationResult(req);
    if (result.isEmpty()) {
        return res.send(`<p>${req.body.username}</p>`);
    }
    res.send({ errors: result.array() });
});
// Create account
router.post('/newUser', usernameValidate(), passValidate(), async (req, res) => {
    // Checks that there were no validation errors
    const result = validationResult(req);
    if (result.isEmpty()) {
        // If no validation errors, send to business to create user
        let result = await biz.newUser(req.body.username, req.body.password);
        return res.send(result);
    }
    // If errors, send message
    res.send({error: 'Invalid username or password. Try again.'})
})

// Pages 
// Create account
app.get('/newUser', (req, res) =>{
    res.sendFile(path.join(__dirname, '/pages/login/newUser.html'));
});
// Log in
app.get('/login', (req, res) =>{
    res.sendFile(path.join(__dirname, '/pages/login/login.html'));
});

app.use('/api', router);
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.listen(5000, function () {
    console.log('Started application on port %d', 5000);
});