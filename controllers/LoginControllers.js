var express = require('express');
var router = express.Router();
var _ = require('underscore');
const settings = require('../config/db.json');
const model = require('../models/model.json');
const qb = require('node-querybuilder').QueryBuilder(settings, 'mysql', 'single');
var datetime = require('node-datetime');
var dt = datetime.create();
var async      = require('async');

/* This function is default function
# Request : Any 
# Response : Message
*/
router.get('/', function (req, res) {
    res.json({"success" : false, "message" : message.UNAUTHORIZED , "data" : {}});
});


/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/getUserDetails', function (req, res) {
    if(req.method == 'POST')
    {
        var Req = req.body;
    }
    else
    {
        var Req = req.query;
    }
    if(Req.lang == undefined || Req.lang == 'en')
    {
        var message = require('../lang/messages_en.json');
    }
    else
    {
        var message = require('../lang/messages_hi.json');
    }
    if(Req.user_id == undefined || Req.user_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var userId = Req.user_id;
    
    var driverStatus = Req.driver_status;
    var locals = {};
    async.series([
        function(callback) {
            qb.select('*').where({id: userId}).order_by('id', 'desc').get(model.User, (err,user) => {
                if (err || user.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    locals.user = user[0];
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({user_id: userId}).get(model.UserAddress, (err,userAddress) => {
                        if (err) return callback(err);
                        locals.userAddress = userAddress;
                        callback();
                    });
                },
                
            ], callback);
        },
        
    ], function(err) {
        if (err) return next(err);
        
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : locals.user });
    });
});


module.exports = router;