var express = require('express');
var router = express.Router();
var _ = require('underscore');
const settings = require('../config/db.json');
const model = require('../models/model.json');
const qb = require('node-querybuilder').QueryBuilder(settings, 'mysql', 'single');
var datetime = require('node-datetime');
var dt = datetime.create();
var async      = require('async');

/* This function is used to get Billty box details
# Request : Lang only
# Response : Object with message
# Author : Vinod Kumar
*/
router.all('/getNearByDropBox', function (req, res) {
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
    qb.select('lat, lng, main_address, sub_address').where({display_status: 1}).get(model.NearByBillty, (err,rows) => {
        if (err || rows.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD, "data" : Response});
        }
        else
        {
           return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : rows});
        }
    });
});


/* This function is used to get Billty box details
# Request : device Id 
# Response : result array with message
# Author : Vinod Kumar
*/
router.all('/getPendingBillties', function (req, res) {
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
    if(Req.device_id == undefined || Req.device_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var deviceId = Req.device_id;
    var locals = {};
    var mgCode;
    var date = '2017-09-01 00:00:00';
    var bookingIdArray = [0];
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : [{}] });
                } 
                else
                {
                    mgCode = driver[0].mg_id;
                    locals.driver = driver[0];
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('booking_id, booking_date, customer_org, customer_number, customer_address').where({mg_id: mgCode , pick_status : 0, pod : 1, 'booking_date >=': date}).get(model.BilltyReport, (err,billtyDetials) => {
                    if (err || billtyDetials.length == 0)
                    {
                        return res.json({"success" : false, "message" : message.NO_RECORD , "data" : [{}] });
                        callback();
                    }
                        locals.billtyDetials = billtyDetials;
                        for (var i = 0; i < billtyDetials.length; i++) {
                            bookingIdArray.push(billtyDetials[i].booking_id);
                        }
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where_in('booking_id',bookingIdArray).get(model.BookingStatus, (err,bookingStatus) => {
                        var statusObj = {};
                        for (var i = 0; i < bookingStatus.length; i++) {
                            statusObj[bookingStatus[i].booking_id] = bookingStatus[i];
                        }
                        locals.bookingStatus = statusObj;

                        callback();
                    });
                }
         ], callback);
        },

    ], function(err) {
        if (err) return next(err);
        var val = {};
        var mainResultArray = [];
        for (var i = 0; i < locals.billtyDetials.length; i++) {
            var value = locals.billtyDetials[i];
            val.billing_time =  locals.bookingStatus[value.booking_id].billing_time;
            val.booking_time =  locals.bookingStatus[value.booking_id].booking_time;
            val.cancel_time  =  locals.bookingStatus[value.booking_id].cancel_time;
            val.complete     =  locals.bookingStatus[value.booking_id].complete;
            val.loading_time =  locals.bookingStatus[value.booking_id].loading_time;
            val.pod_time     =  locals.bookingStatus[value.booking_id].pod_time;
            val.start_time   =  locals.bookingStatus[value.booking_id].start_time;
            val.stop_time    =  locals.bookingStatus[value.booking_id].stop_time;
            val.to_customer_time =  locals.bookingStatus[value.booking_id].to_customer_time;

            val.booking_id = value.booking_id;
            val.booking_date = value.booking_date;
            val.customer_org = value.customer_org;
            val.customer_number = value.customer_number;
            val.customer_address = value.customer_address;
            mainResultArray.push(val);
        }
        
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : mainResultArray });
    });

    
});

/* This function is used to upload billty image
# Request : Image and booking id
# Response : Message
# Author : Vinod Kumar
*/
router.all('/uploadPOD', function (req, res) {
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
    var AWS = require('aws-sdk');
	AWS.config.loadFromPath('./s3_config.json');
	var s3Bucket = new AWS.S3( { params: {Bucket: 'maalgaadipod'} } );
	buf = new Buffer(Req.image.replace(/^data:image\/\w+;base64,/, ""),'base64');
	var seconds = new Date().getTime() / 1000;
	var imageName = 'maalgaadi'+seconds+'.png';
	var data = {
				Key: imageName, 
				Body: buf,
				ContentEncoding: 'base64',
				ContentType: 'image/png',
				ACL: 'public-read'
			};
	s3Bucket.putObject(data, function(err, data){
		if (err) 
		{ 
			return res.json({"success" : false, "message" : message.ERROR_UPLOAD , "data" : {}});
		} 
		else
		{
			var s3URL = 'https://s3-ap-southeast-1.amazonaws.com/maalgaadipod/'+imageName;
			var dataObj = {pod_image_url : s3URL};
			qb.update(model.Booking, dataObj, {id: bookingId}, (err, result) => {
                if (err) return console.error(err);

                return res.json({"success" : true, "message" : message.SUCCESS_UPLOAD , "data" : {} });
            });

		}
	});
});


module.exports = router;