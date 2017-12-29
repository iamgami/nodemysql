var express = require('express');
var router = express.Router();
var _ = require('underscore');
const settings = require('../config/db.json');
const model = require('../models/model.json');
const qb = require('node-querybuilder').QueryBuilder(settings, 'mysql', 'single');
var datetime = require('node-datetime');
var dt = datetime.create();
var async      = require('async');

/* This function is used to set driver login details
# Request : device Id ,lat , lng, status, device_info
# Response : 
*/
router.all('/calculateTripCharge', function (req, res) {
    if(req.method == 'POST')
    {
        var Req = req.body;
    }
    else
    {
        var Req = req.query;
    }
    if(Req.driver_id == undefined || Req.driver_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.booking_id == undefined || Req.booking_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.lang == undefined || Req.lang == 'en')
    {
        const message = require('../lang/messages_en.json');
    }
    if(Req.distance == undefined || Req.distance == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.waiting_time == undefined || Req.waiting_time == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.payment_option == undefined || Req.payment_option == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    
    if(Req.distance == 0)
    {
        var distance = 0;
        var distanceInMeter = 0;
    }
    else
    {
        //distance coming in meters
        var distanceInMeter = Req.distance;
        var distance        = Math.round(Req.distance/1000);    
    }
    var waitingTime = Req.waiting_time;
    var paymentOption = Req.payment_option
    var bookingId = Req.booking_id;
    var driverId = Req.driver_id;
    var data = {
            waiting_time : waitingTime,
            payment_option : paymentOption,
            distance : distance,
            booking_id : bookingId,
            driver_id : driverId
        };
    
    
    
});



module.exports = router;