var methodOverride = require('method-override');
var express = require("express");
var bodyParser = require("body-parser");

var app = express();
var port = 3000;

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: false }));

var driverLogin = require("./controllers/DriverLoginControllers.js");
var driverBooking = require("./controllers/DriverBookingControllers.js");
var driverPrime = require("./controllers/DriverPrimeControllers.js");
var calculateTripCharge = require("./controllers/CalculateTripChargeControllers.js");
var complaint = require("./controllers/ComplaintControllers.js");
var rating = require("./controllers/RatingControllers.js");
var billty = require("./controllers/BilltyControllers.js");
var cancelBooking = require("./controllers/CancelBookingControllers.js");

app.use("/api/v1/driverMobile/", driverLogin);
app.use("/api/v1/driverMobile/", driverBooking);
app.use("/api/v1/driverMobile/", driverPrime);
app.use("/api/v1/driverMobile/", calculateTripCharge);
app.use("/api/v1/driverMobile/", complaint);
app.use("/api/v1/driverMobile/", billty);
app.use("/api/v1/driverMobile/", cancelBooking);
app.listen(port);