var methodOverride = require('method-override');
var express = require("express");
var bodyParser = require("body-parser");

var app = express();
var port = 3000;

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: false }));

var driverLogin = require("./controllers/LoginControllers.js");

app.use("/api/", driverLogin);

app.listen(port);