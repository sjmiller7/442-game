const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

var app = express();

var router = express.Router();

var biz = require('./business/business')

router.get('/test', (req, res) => {
    res.send(biz.test());
});

app.use('/api', router);
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.listen(5000, function () {
    console.log("Started application on port %d", 5000);
});