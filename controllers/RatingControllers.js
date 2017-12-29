var express = require('express');
var router = express.Router();
var _ = require('underscore');
const settings = require('../config/db.json');
const message = require('../lang/messages_hi.json');
const model = require('../models/model.json');
const qb = require('node-querybuilder').QueryBuilder(settings, 'mysql', 'single');
var datetime = require('node-datetime');
var dt = datetime.create();


/* This function is used to get Billty box details
# Request : device Id 
# Response : result array with message
# Author : Vinod Kumar
*/
router.all('/customerRating', function (req, res) {
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
    if(Req.booking_id == undefined || Req.booking_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }

    var bookingId = Req.booking_id;
    if(Req.rating == undefined || Req.rating == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var rating = Req.rating;
    
    var reason = Req.reason;
    if(reason == undefined || reason == '')
    {
        reason = 'NA';
    }
    var locals = {};
    var responseCode = 0;
    var customerId;
    async.series([
        function(callback) {
            qb.select('*').where({id: bookingId}).order_by('id', 'desc').get(model.Booking, (err,booking) => {
                if (err || booking.length != 0)
                {
                    return res.json({"success" : false, "message" : 'We already have Rating for this booking id' , "data" : {} });
                } 
                else
                {
                   locals.booking = booking[0];
                   customerId = booking[0].customer_id;
                   callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).order_by('id', 'desc').get(model.Rating, (err,rating) => {
                        if (err || rating.length != 0)
                        {
                            return res.json({"success" : false, "message" : 'We already have Rating for this booking id' , "data" : {} });
                            callback();
                        } 
                        else
                        {
                           dataObj = {
                                        booking_id : bookingId,
                                        user_id : customerId,
                                        user_type : 'customer',
                                        rating : rating,
                                        notes : reason,
                                        created_at : dt.format('Y-m-d H:M:S')
                                    };
                            qb.insert(model.Rating, dataObj, (err, res) => {
                                if (err) return console.error(err);
                                responseCode = 1;
                                callback();
                            });
                        }
                    });
                },
                
            ], callback);
        },
        
    ], function(err) {
        if (err) console.log(err);
        
        if(responseCode == 0)
        {
            return res.json({"success" : false, "message" : "Rating not updated successfully" , "data" : {} });
        }
        else
        {
            return res.json({"success" : true, "message" : "Rating updated successfully" , "data" : {} });
        }
    });
});



/* This function is used to get Billty box details
# Request : none
# Response : result array with message
# Author : Vinod Kumar
*/
router.all('/getDriverRatingReason', function (req, res) {
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
    
    qb.select('*').get(model.RatingReason, (err,ratingReason) => {
        if (err || ratingReason.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
        } 
        else
        {
           return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : RatingReason });
        }
    });
});


module.exports = router;