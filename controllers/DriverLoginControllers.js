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
router.all('/getDriverDetails', function (req, res) {
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
    var fcmToken = Req.fcm_token; 
    if(fcmToken == undefined)
    {
        fcmToken = '';
    }
    var lat = Req.lat;
    var lng = Req.lng;
    if(Req.lat == '')
    {
        lat = 0.0;
    }
    if(Req.lng == '')
    {
        lng = 0.0;
    }
    var deviceInfo = '';
    if(Req.device_info != undefined)
    {
        var  deviceInfo = Req.device_info;
    }
    var driverStatus = Req.driver_status;
    var vehcleId;
    var locals = {};
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    driverId = driver[0].id;
                    locals.driver = driver[0];
                    vehcleId = driver[0].vehicle_category_id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).get(model.DriverLogin, (err,driverLogin) => {
                        if (err) return callback(err);
                        locals.driverLogin = driverLogin;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('vehicle_name').where({id: vehcleId}).get(model.VehicleCategory, (err,vehicleCategory) => {
                        if (err) return callback(err);
                        locals.vehicleCategory = vehicleCategory[0];

                        callback();
                    });
                },
                function(callback) {
                    if(fcmToken != '')
                    {
                        var updateDriverData = {fcm_token : fcmToken};
                        qb.update(model.Driver, updateDriverData, {id:driverId}, (err, result) => {
                            callback();
                        });
                    }
                    else
                    {
                        callback();
                    }
                    
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    if(lat != '' && lng != '')
                    {
                        var updateData = {lat : lat ,lng : lng, status :driverStatus, screen : deviceInfo, driver_id : driverId};
                        if(locals.driverLogin.length > 0)
                        {
                            qb.update(model.DriverLogin, updateData, {driver_id:driverId}, (err, result) => {
                                callback();
                            });
                        }
                        else
                        {
                            qb.insert(model.DriverLogin, updateData, (err, res) => {
                                callback();
                            });
                        }
                    }
                    else
                    {
                        callback();
                    }
                }
         ], callback);
        },

    ], function(err) {
        if (err) return next(err);
        
        locals.driver.vehicle_category_name = locals.vehicleCategory.vehicle_name;
        var response = locals.driver;
        
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response });
    });
});

/* This function is used to set driver login details
# Request : device Id ,lat , lng, status, device_info
# Response : 
*/
router.all('/driverLogin', function (req, res) {
    
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
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    var deviceId = Req.device_id;
    var lat = 1.1;
    var lng = 1.1;
    if(Req.lat != undefined || Req.lat != '')
    {
        lat = Req.lat;
    }
    if(Req.lng != undefined ||  Req.lng != '')
    {
        lng = Req.lng;
    }

    var locals = {};
    var driverId;
    var vehcleId;
    var rating = 5;
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    driverId = driver[0].id;
                    locals.driver = driver[0];
                    vehcleId = driver[0].vehicle_category_id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var insertData         = {};
                    insertData.driver_id   = driverId;
                    insertData.lat         = lat;
                    insertData.lng         = lng;
                    insertData.logout_time = null;
                    insertData.created_at  = dt.format('Y-m-d H:M:S');
                    insertData.updated_at  = dt.format('Y-m-d H:M:S');
                    if(Req.l_ul_status != undefined && Req.l_ul_status == 'true') 
                    {
                        insertData.loading_unloading_status = "yes";
                    }
                    else if(Req.l_ul_status != undefined && Req.l_ul_status == 'false') 
                    {
                        insertData.loading_unloading_status = "no";
                    }
                    
                    if(Req.helper_status != undefined && Req.helper_status == 'true' ) 
                    {
                        insertData.helper_status = "yes";
                    }
                    else if(Req.helper_status != undefined && Req.helper_status == 'false' ) 
                    {
                        insertData.helper_status = "no";
                    }
                    insertData.covered_status = 'no';
                    if(Req.covered_status != undefined && Req.covered_status == 'true')
                    {
                        insertData.covered_status = 'yes';
                    }
                    qb.insert(model.DriverDetials, insertData, (err, res) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).get(model.DriverRegular, (err,driverRegular) => {
                        if (err) return callback(err);
                        locals.driverRegular = driverRegular;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({user_id: driverId,user_type: 'driver'}).get(model.AverageRating, (err,averageRating) => {
                        if(averageRating.length > 0)
                        {
                            locals.averageRating = averageRating[0];
                            rating = averageRating[0].average_rating;
                        }
                        callback();
                    });
                },

                
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var dataObj = {
                            driver_id : driverId,
                            booking_id : 0,
                            lat : lat,
                            lng : lng,
                            status : 'free',
                            distance_travelled : 0,
                            battery_status : 0
                    };
                    if(locals.driverRegular.length == 0)
                    {
                        dataObj.created_at = dt.format('Y-m-d H:M:S');
                        qb.insert(model.DriverRegular, dataObj, (err, res) => {
                            if (err) return console.error(err);
                            callback();
                        });
                    }
                    else
                    {
                        dataObj.updated_at = dt.format('Y-m-d H:M:S');
                        qb.update(model.DriverRegular, dataObj, {driver_id: driverId}, (err, result) => {
                            if (err) return console.error(err);
                            callback();
                        });
                    }
                }
         ], callback);
        },
    ], function(err) {
        if (err) return next(err);
        
        
        
        var response = { mg_id : locals.driver.mg_id, rating : rating, is_prime : locals.driver.is_prime == 1 ? true : false};
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response});
    });

});

/* This function is used to set driver logout details
# Request : Token
# Response : Json Messages and data
*/
router.all('/driverLogout', function (req, res) {
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
    if(Req.token == undefined || Req.token == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    
    qb.select('id')
        .where({token: Req.token})
        .get(model.DriverToken, (err,rows) => {
            if (err || rows.length == 0)
            {
                return res.json({"success" : false, "message" : message.NO_RECORD, "data" : {}});
            }
            else
            {
                _.each(rows, function(record) {
                    
                    qb.update(model.DriverToken, {token: ''}, {driver_id:record.driver_id}, (err, result) => {
                        if (err) return console.error(err);
                    });

                    qb.update(model.DriverDetials, {logout_time: dt.format('Y-m-d H:M:S')}, {driver_id:record.driver_id}, (err, result) => {
                        if (err) return console.error(err);
                    });

                    qb.delete(model.DriverRegular, {driver_id: record.driver_id}, (err, res) => {
                        if (err) return console.error(err);
                    });
                    
                    return res.json({"success" : true, "message" : message.LOGOUT_SUCCESS , "data" : {} });
                });
            }
        }
    );
});

/* This function is used to Generate The OTP
# Request : Mobile Number
# Response : Json Messages and data
*/
router.all('/generateOtp', function (req, res) {
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
    if(Req.mobile == undefined || Req.mobile == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    qb.select('id,driver_number,driver_name,driver_device_id')
        .where({driver_number: Req.mobile})
        .get(model.Driver, (err,rows) => {
            if (err || rows.length == 0)
            {
                return res.json({"success" : false, "message" : message.NO_RECORD, "data" : {}});
            }
            else
            {
                _.each(rows, function(record) {

                    if(record.id != '' && record.driver_device_id == 0)
                    {
                        var otp = Math.floor(100000 + Math.random() * 900000);
                        var messageString = 'Hello! Welcome to MaalGaadi. Your OTP: '+otp;
                        var insertData = {};
                        insertData.name   = record.driver_name;
                        insertData.mobile = record.driver_number;
                        insertData.apikey = otp;
                        insertData.status = 0;
                        insertData.created_at = dt.format('Y-m-d H:M:S');
                        var mobileNo = record.driver_number;

                        qb.insert(model.UserOtp, insertData, (err, res) => {
                            if (err) return console.error(err);
                        });
                        const apiSetting = require('../config/msg91.json');
                        var msg91 = require("msg91")(apiSetting.API_KEY, apiSetting.SENDER_ID, apiSetting.ROUTE_NO );

                        msg91.send(mobileNo, messageString, function(err, response){
                            if(err)
                            {
                                return res.json({"success" : true, "message" : message.MOBILE_NUMBER_NOT_FOUND , "data" : {} });
                            }
                        });
                        var resposeData = { login : 1 , otp : otp};
                        return res.json({"success" : true, "message" : message.MESSAGE_SENT , "data" : resposeData });
                    }
                    else if(record.id != '' && record.driver_device_id != 0) 
                    {
                        var resposeData = { login : 2 };
                        return res.json({"success" : true, "message" : message.ALREADY_REGISTER_DEVICE , "data" : resposeData });
                    }
                    else
                    {
                        var resposeData  = { login : 3 };
                        return res.json({"success" : false, "message" : message.MOBILE_NUMBER_NOT_FOUND , "data" : resposeData });
                    }
                });
            }
        }
    );
});

/* This function is used to Verify The OTP
# Request : Mobile Number
# Response : Json Messages and data
*/
router.all('/verifyOtp', function (req, res) {
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
    if(Req.otp == undefined || Req.otp == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    
    qb.select('*').where({apikey: Req.otp , mobile: Req.mobile}).get(model.UserOtp, (err,rows) => {
        if (err || rows.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD, "data" : {}});
        }
        else
        {
            _.each(rows, function(record) {
                qb.update(model.UserOtp, {status: 1 , 'updated_at' : dt.format('Y-m-d H:M:S')}, {mobile:Req.mobile}, (err, result) => {
                    if (err) return console.error(err);
                });
                qb.select('*').where({driver_number: Req.mobile}).get(model.Driver, (err,row) => {
                    if (err || rows.length == 0)
                    {
                        return res.json({"success" : false, "message" : message.DEVICE_ID_NOT_REGISTER , "data" : {}});
                    }
                    else
                    {
                        qb.update(model.Driver, {driver_device_id: Req.device_id}, {id: row.id}, (err, result) => {
                            if (err) return console.error(err);
                        });
                        _.each(row, function(result) {
                            qb.select('vehicle_name').where({id: result.vehicle_category_id}).get(model.VehicleCategory, (err,rows) => {
                                if (err) return console.error(err);
                                
                                result.vehicle_category_name = rows[0].vehicle_name;
                                return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : result });
                            });
                        });
                        
                    }
                });
            });
        }
    });
});

/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/

router.all('/setDriverRegularData', function (req, res) {
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
    if(Req.lng == undefined || Req.lng == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED_LNG , "data" : {} });
    }
    if(Req.driver_status == undefined || Req.driver_status == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED_DRIVER_STATUS , "data" : {} });
    }
    
    if(Req.battery_status == undefined || Req.battery_status == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED_BATTERY_STATUS , "data" : {} });
    }
    
    if(Req.trip_distance == undefined || Req.trip_distance == '')
    {
        var tripDistance = 0;
    }
    else
    {
        var tripDistance = Req.trip_distance;
    }
    if(Req.booking_id == undefined || Req.booking_id == '')
    {
        var bookingId = 0;
    }
    else
    {
        var bookingId = Req.booking_id;
    }
    var deviceId = Req.device_id;
    var lat = Req.lat;
    var lng = Req.lng;
    var driverStatus = Req.driver_status;
    var batteryStatus = Req.battery_status;
    var random = Req.random;
    var FCM = require('fcm-node');
    var google = require('../config/google.json');
    var serverKey = google.FCMAPIKEY; 
    var driverId;
    var locals = {};
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    driverId = driver[0].id;
                    locals.driver = driver[0];
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).get(model.DriverRegular, (err,driverRegular) => {
                        if (err) return callback(err);
                        locals.driverRegular = driverRegular;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({id: bookingId}).get(model.Booking, (err,booking) => {
                        if (err) return callback(err);
                        locals.booking = booking[0];
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var dataObj = {
                            driver_id : driverId,
                            booking_id : bookingId,
                            lat : lat,
                            lng : lng,
                            status : driverStatus,
                            distance_travelled : tripDistance,
                            battery_status : batteryStatus
                    };
                    if(locals.driverRegular.length == 0)
                    {
                        dataObj.created_at = dt.format('Y-m-d H:M:S');
                        qb.insert(model.DriverRegular, dataObj, (err, res) => {
                            if (err) return console.error(err);
                            callback();
                        });
                    }
                    else
                    {
                        dataObj.updated_at = dt.format('Y-m-d H:M:S');
                        qb.update(model.DriverRegular, dataObj, {driver_id: driverId}, (err, result) => {
                            if (err) return console.error(err);
                            callback();
                        });
                    }
                }
         ], callback);
        },

    ], function(err) {
        if (err) return next(err);
        
        if(locals.booking != undefined)
        {
            if(locals.booking.driver_id != locals.driver)
            {
                var deviceToken   = locals.driver.fcm_token;
                var fcm = new FCM(serverKey);
                var messageData = { 
                    to: 'fMTL9TviGSU:APA91bEqxx3mRucjmc7Ei6sAKFQfUe4DNgp3lcznO6fSXn64PHjXnbgpz5H8QeFMJPM6lxmlGrWhW_tTibhiTm1dagqjeOpR7Xy8JbF4J9irKfSqu7SIeV9zoM9bQ7l2EClpVXV-aUKM', 
                    collapse_key: 'your_collapse_key',
                    
                    notification: {
                        title: message.NOTIFICATION_CANCEL_TITLE, 
                        body: message.NOTIFICATION_CANCEL_BODY 
                    },
                    
                    data: {  
                        booking_id: locals.booking.id
                    }
                };
                
                fcm.send(messageData, function(err, response){
                    if (err) {
                        console.log("Something has gone wrong!");
                    } else {
                        var response = {battery : batteryStatus , random : random}; 
                        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response });
                    }
                });
            }
        }
        var response = {battery : batteryStatus , random : random}; 
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response });
    });
});


/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/getConfig', function (req, res) {
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
    qb.select('city_id').where({driver_device_id: Req.device_id}).get(model.Driver, (err,rows) => {
        if (err || rows.length == 0)
        {
            return res.json({"success" : false, "message" : message.DEVICE_ID_NOT_REGISTER , "data" : {}});
        }
        else
        {
            _.each(rows, function(record) {
                qb.select('geo_fencing_radius,geo_fencing_radius_for_call_btn,driver_app_allow_tab').where({id: record.city_id}).get(model.MaalgaadiSettings, (err,rows) => {
                    if (err || rows.length == 0)
                    {
                        return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {}});
                    }
                    var result = rows[0];
                    response = {};
                    response.geo_fencing_radius = result.geo_fencing_radius;
                    response.geo_fencing_radius_for_call_btn = result.geo_fencing_radius_for_call_btn;
                    var driver_app_allow_tab = JSON.parse(result.driver_app_allow_tab);
                    response.driver_app_allow_tab = driver_app_allow_tab[0];
                    return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response});
                });
            });
        }
    });
});

/* This function is used to get driver Wallet details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/getDriverWalletAPI', function (req, res) {
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
    var driverId;
    var locals = {};
    var driverBalance = 0;
    var driverSecurityBalanceLast = 0;
    var avoidRemarkArray = ['DTC Charges', 'Distance to Customer', 'Commission'];
    var remarkDTCArray = ['DTC Charges', 'Distance to Customer'];
    var remarkComArray = ['Commission'];
    var bookingIdArray = [];
    var driverWalletDTCDetailsArray = [];
    var driverWalletComDetailsArray = [];
    var remarkArray =   {
                            'Amount Recieved'     : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Amount Recieved',
                            'Driver Cash Receive' : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Driver Cash Receive',
                            'Random'              : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Random',
                            'Security Deposit'    : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Security Deposit',
                            'Offline Trip'        : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Offline Trip',
                            'Bill Amount'         : Req.lang == 'hi' ? 'ट्रिप' : 'Bill Amount',
                            'Toll Charges'        : Req.lang == 'hi' ? 'टोल' : 'Toll Charges',
                            'Driver Cash Paid'    : Req.lang == 'hi' ? 'पेमेंट' : 'Driver Cash Paid',
                            'Commission'          : Req.lang == 'hi' ? 'कमीशन' : 'Commission' ,
                            'Driver Penalty'      : Req.lang == 'hi' ? 'पेनल्टी' : 'Driver Penalty',
                            'Cancellation Charges': Req.lang == 'hi' ? 'कैंसलेशन चार्ज' :  'Cancellation Charges',
                            'Distance to Customer': Req.lang == 'hi' ? 'खाली किलोमीटर्स' : 'Distance to Customer',
                            'Waiting Charges'     : Req.lang == 'hi' ? 'वेटिंग चार्ज ' : 'Waiting Charges',
                            'Swap Charges'        : Req.lang == 'hi' ? 'स्वैप' : 'Waiting Charges',
                            'Chaalan Amount'      : Req.lang == 'hi' ? 'चालान' : 'Chaalan Amount',
                            'Overload Amount'     : Req.lang == 'hi' ? 'ओवरलोडिंग' : 'Overload Amount',
                            'Penalty Amount Reverse' : Req.lang == 'hi' ? 'एडजस्टमेंट' : 'Penalty Amount Reverse',
                            'Prime Driver Subscription Charge'   : Req.lang == 'hi' ? 'प्राइम चार्जेज' : 'Prime DriverCharges',
                        };
    async.series([
        //Load Booking
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err) return callback(err);
                driverId = driver[0].id;
                locals.driver = driver[0];
                callback();
            });
        },
        function(callback) {
            async.parallel([
                
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').limit(1).get(model.DriverWallet, (err,driverWalletBalance) => {
                        if (err) return callback(err);
                        driverBalance = driverWalletBalance[0].balance;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').limit(1).get(model.DriverSecurityBalance, (err,driverSecurityBalance) => {
                        if (err) return callback(err);
                        
                        driverSecurityBalanceLast = driverSecurityBalance[0].balance;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).where_not_in('remark',avoidRemarkArray).order_by('id', 'desc').limit(10).get(model.DriverWallet, (err,driverWallet) => {
                        if (err) return callback(err);
                        for (var i = 0; i < driverWallet.length; i++) {
                            bookingIdArray.push(driverWallet[i].booking_id);
                        }
                        locals.driverWallet = driverWallet;
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where_in('booking_id', bookingIdArray).where_in('remark',remarkDTCArray).get(model.DriverWallet, (err,driverWalletDTCDetails) => {
                        if (err) return callback(err);
                        var walletDTCDetails = {};
                        for (var i = 0; i < driverWalletDTCDetails.length; i++) {
                            walletDTCDetails[driverWalletDTCDetails[i].booking_id] = driverWalletDTCDetails[i];
                        }
                        locals.driverWalletDTCDetails = walletDTCDetails;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where_in('booking_id', bookingIdArray).where_in('remark',remarkComArray).get(model.DriverWallet, (err,driverWalletComDetails) => {
                        if (err) return callback(err);
                        var walletComDetails = {};  
                        for (var i = 0; i < driverWalletComDetails.length; i++) {
                            walletComDetails[driverWalletComDetails[i].booking_id] = driverWalletComDetails[i];
                        }
                        locals.driverWalletComDetails = walletComDetails;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({'user_type': 'driver'}).where_in('booking_id', bookingIdArray).get(model.Rating, (err,bookingRatingDetails) => {
                        if (err) return callback(err);
                        var ratingDetails = {};
                        for (var i = 0; i < bookingRatingDetails.length; i++) {
                            ratingDetails[bookingRatingDetails[i].booking_id] = bookingRatingDetails[i];
                        }
                        locals.bookingRatingDetails = ratingDetails;
                        callback();
                    });
                }
         ], callback);
        }

    ], function(err) {
        if (err) console.log(err);
        var driverWallet = locals.driverWallet;
        var bookingRatingDetails = locals.bookingRatingDetails;
        var mainResultArray = []; 
        for (var i = 0; i < driverWallet.length; i++) {
            var value = driverWallet[i];
            var val = {};
            if(value.booking_id == 10001)
            {
                val.booking_id = "";   
            }
            else
            {
                val.booking_id = value.booking_id;   
            }
            if((bookingRatingDetails[value.booking_id]) && bookingRatingDetails[value.booking_id].rating)
            {
                val.rating = bookingRatingDetails[value.booking_id].rating;
            }
            else
            {
                val.rating = 0;
            }

            if(value.remark == 'Amount Recieved' || value.remark == 'Random' || value.remark == 'Driver Cash Receive' || value.remark == 'Security Deposit')
            {
                val.type = remarkArray['Amount Recieved'];
                val.color       = 1;
            }
            else if(value.remark == '')
            {
                val.type = remarkArray['Bill Amount'];
                val.color       = 2;
            }
            else if(value.remark == 'Bill Amount')
            {
                val.type = 'एडजस्टमेंट';
                val.color       = 1;   
            }
            else if(value.remark == 'Toll Charges')
            {
                val.type = remarkArray['Toll Charges'];
                val.color       = 1;
            }
            else if(value.remark == 'Driver Cash Paid')
            {
                val.type = remarkArray['Driver Cash Paid'];
                val.color       = 3;
            }
            else if(value.remark == 'Commission')
            {
                val.type = remarkArray['Commission'];
                val.color       = 1;   
            }
            else if(value.remark == 'Driver Penalty')
            {
                val.type = remarkArray['Driver Penalty'];
                val.color       = 1;   
            }
            else if(value.remark == 'Cancellation Charges')
            {
                val.type = remarkArray['Cancellation Charges'];
                val.color       = 3;   
            }
            else if(value.remark == 'Distance to Customer')
            {
                val.type = remarkArray['Distance to Customer'];
                val.color       = 4; 
            }
            else if(value.remark == 'Waiting Charges')
            {
                val.type = remarkArray['Waiting Charges'];
                val.color       = 1; 
            }
            else if(value.remark == 'Swap Charges')
            {
                val.type = remarkArray['Swap Charges'];
                val.color       = 1;   
            }
            else if(value.remark == 'Overload Amount')
            {
                val.type = remarkArray['Overload Amount'];
                val.color       = 1;   
            }
            else if(value.remark == 'Chaalan Amount')
            {
                val.type = remarkArray['Chaalan Amount'];
                val.color       = 1;   
            }
            else if(value.remark == 'Penalty Amount Reverse')
            {
                val.type = remarkArray['Penalty Amount Reverse'];
                val.color       = 4;   
            }
            else if(value.remark == 'Prime Driver Subscription Charge')
            {
                val.type = remarkArray['Prime Driver Subscription Charge'];
                val.color       = 1;   
            }
            else
            {
                val.type = 'Trip Charge';
                val.color       = 2;
            }

            if(value.remark == '')
            {
                var commission = 0;
                var dtc        = 0;
                var tripCharge = value.credit;
                var balance    = value.balance;
                val.dtc = 0;
                val.commission = 0;
                if((locals.driverWalletComDetails[value.booking_id] != undefined) && locals.driverWalletComDetails[value.booking_id].remark == 'Commission')
                {
                    var commission = locals.driverWalletComDetails[value.booking_id].debit;
                    val.commission = commission;
                }
                
                if((locals.driverWalletDTCDetails[value.booking_id] != undefined ) && locals.driverWalletDTCDetails[value.booking_id].remark == 'DTC Charges')
                {
                    dtc = locals.driverWalletDTCDetails[value.booking_id].credit;
                    val.dtc = dtc;
                }
                
                tripCharge     = tripCharge - commission + dtc;
                val.trip_charge     = tripCharge;
                val.balance    = balance  - commission + dtc;
                val.payment_received = value.debit;

            }
            else
            {
                val.trip_charge     = value.credit;
                val.payment_received = value.debit;
                val.balance = value.balance;
                val.dtc = 0;
                val.commission = 0;

            }
            if(value.booking_id == 0 )
            {
                val.booking_id  = '';
            }
            
            var entryTime = new Date(value.created_at);

            val.time = getDateINyyyyMmDd(value.created_at);
            var k = 0;
            var screen_parameters = {};

           
            screen_parameters[k] = {};
            screen_parameters[k].label = 'यात्रा शुल्क';
            screen_parameters[k].value = '₹ '+val.trip_charge;
            k++;
                
            screen_parameters[k] = {};
            screen_parameters[k].label = 'प्राप्त  राशि';
            screen_parameters[k].value = '₹ '+val.payment_received;
            k++;
                
            
            
            val.screen_parameters = screen_parameters;
            mainResultArray.push(val);

        }
        
        var current_balance = driverBalance;
        var security_balance = driverSecurityBalanceLast;

        var finalObj = {
                current_balance : current_balance,
                security_balance : security_balance,
                data : mainResultArray
        }
        
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : finalObj });
    });
});

/* This function is used to get driver Wallet details
# Request : device Id 
# Response : Json respose with data and messages
# Author : Vinod Kumar
*/
router.all('/getPendingFavouriteDriverList', function (req, res) {
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
    var driverId;
    var locals = {};
    var favouritecustomerIds = [];
    async.series([
        //Load Booking
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err) return callback(err);
                if(driver.length > 0)
                {
                    driverId = driver[0].id;
                    locals.driver = driver[0];
                    callback();
                }
                else
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                }
                
            });
        },
        function(callback) {
            async.parallel([
                
                function(callback) {
                    qb.select('*').where({driver_id: driverId, delete_flag : 0}).order_by('id', 'desc').get(model.FavouriteDriver, (err,favouriteDriver) => {
                        if (err) return callback(err);
                        if(favouriteDriver.length > 0)
                        {
                            locals.favouriteDriver = favouriteDriver;
                            for (var i = 0; i < favouriteDriver.length; i++) {
                                favouritecustomerIds.push(favouriteDriver[i].customer_id);
                            }
                            callback();
                        }
                        else
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                        }
                       
                    });
                },
                
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where_in('id', favouritecustomerIds).get(model.Customer, (err,customer) => {
                        if (err) return callback(err);
                        var customerComDetails = { };  
                        for (var i = 0; i < customer.length; i++) {
                            customerComDetails[customer[i].id] = customer[i];
                        }
                        locals.customer = customerComDetails;
                        callback();
                    });
                },
            ], callback);
        }

    ], function(err) {
        if (err) console.log(err);

        var result = [];
        var favouriteDriverDetails = locals.favouriteDriver;
        var mainResultArray = []; 
        var pending = [];
        var accepted = []; 
        if(favouriteDriverDetails.length > 0)
        {
            for (var i = 0; i < favouriteDriverDetails.length; i++) {
                var favouriteCustomer = {};
                if(locals.customer[favouriteDriverDetails[i].customer_id])
                {
                    favouriteCustomer['customer_id'] = favouriteDriverDetails[i].customer_id;
                    if(locals.customer[favouriteDriverDetails[i].customer_id].cust_organization == 'NA' || locals.customer[favouriteDriverDetails[i].customer_id].cust_organization == '')
                    {
                        favouriteCustomer['name'] = locals.customer[favouriteDriverDetails[i].customer_id].cust_name;
                    }
                    else
                    {
                        favouriteCustomer['name'] = locals.customer[favouriteDriverDetails[i].customer_id].cust_organization;
                    }
                    if(favouriteDriverDetails[i].status == 'Request Sent')
                    {
                        pending.push(favouriteCustomer);
                        
                    }
                    if(favouriteDriverDetails[i].status == 'Active')
                    {
                        accepted.push(favouriteCustomer);
                    }
                }
            }
            var mainObj = {};
            mainObj['pending'] = pending;
            mainObj['accepted'] = accepted;
            mainResultArray.push(mainObj);
            return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" :  mainResultArray[0]});
        }
        else
        {
            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
        }
        
    });
});

/* This function is used to get driver Wallet details
# Request : device Id 
# Response : Json respose with data and messages
# Author : Vinod Kumar
*/
router.all('/updateFavouriteDriverStatus', function (req, res) {
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
    if(Req.customer_id == undefined || Req.customer_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.is_accepted == undefined || Req.is_accepted == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var customerId = Req.customer_id;
    var deviceId = Req.device_id;
    var isAccepted = Req.is_accepted;
    if(isAccepted == 'true')
    {
        var favouriteDetails = {
                        status : 'Active',
                        delete_flag : 0,
                        notification_flag : 2,
                        updated_at : dt.format('Y-m-d H:M:S')
                    };
    }
    else
    {
        var favouriteDetails = {
                        status : 'Declined',
                        notification_flag : 0,
                        updated_at : dt.format('Y-m-d H:M:S')
                    };
    }
    var driverId;
    var locals = {};
    var customerIdentification;
    async.series([
        function(callback) {
            qb.select('*').where({id: customerId}).order_by('id', 'desc').get(model.Customer, (err,customer) => {
                if (err) return callback(err);
                if(customer.length > 0)
                {
                    locals.customer = customer[0];
                    if(customer[0].cust_organization == 'NA' || customer[0].cust_organization == '')
                    {
                        customerIdentification = customer[0].cust_name;
                    }
                    else
                    {
                        customerIdentification = customer[0].cust_organization;
                    }
                    callback();
                }
                else
                {
                    return res.json({"success" : false, "message" : message.CUSTOMER_NOT_FOUND , "data" : {} });
                }
            });
        },
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err) return callback(err);
                driverId = driver[0].id;
                callback();
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId, customer_id : customerId}).order_by('id', 'desc').get(model.FavouriteDriver, (err,favouriteDriver) => {
                        console.log("Query Ran: " + qb.last_query());
                        if(favouriteDriver.length > 0)
                        {
                            locals.favouriteDriver = favouriteDriver[0];
                            if(favouriteDriver[0].status == 'Request Sent')
                            {
                                qb.update(model.FavouriteDriver, favouriteDetails, {driver_id:driverId,customer_id:customerId}, (err, result) => {
                                    callback();
                                });
                            }
                            else
                            {
                                return res.json({"success" : false, "message" : message.TRY_AGAIN , "data" : {} });
                                callback();
                            }
                        }
                        else
                        {
                            return res.json({"success" : false, "message" : message.TRY_AGAIN , "data" : {} });
                        }
                       
                    });
                },
                
            ], callback);
        },
    ], function(err) {
        if (err) console.log(err);
        
        if(locals.favouriteDriver.status == 'Request Sent')
        {
            var msg = customerIdentification+' '+message.FAV_DRIVER_UPDATE_SUCCESS;
            return res.json({"success" : true, "message" : msg , "data" : {} });
        }
        else if(locals.favouriteDriver.status == 'Active')
        {
            var msg = customerIdentification+' '+message.FAV_DRIVER_UPDATE_ALREADY_EXIST;
            return res.json({"success" : false, "message" : msg , "data" : {} });
        }
        else
        {
            var msg = customerIdentification+' '+message.FAV_DRIVER_UPDATE_REMOVE;;
            return res.json({"success" : false, "message" : msg , "data" : {} });
        }
        
    });
});
/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/saveFireBase', function (req, res) {
    var db = admin.database();
    var ref = db.ref("server/saving-data/fireblog");
    var id = tokenGenerate();
    var driverdata = {"id":id,"mg_id":"Loadin","driver_name":"Saurabh Pixel","archive_number":"","city_id":1,"driver_number":"1111111111","driver_number1":"- 25","driver_device_id":null,"vehicle_category_id":5,"tokenid":"","driver_image":"","vehicle_reg_no":"CH01AM2628","driver_address":"NA","driver_category":"","driver_status":"active","reason":"test driver terminate 122","resume_date":null,"terminated_time":"2017-09-12 17:37:11","terminated_by":1,"is_prime":0,"prime_auto_renew":0,"created_at":"2016-10-15 16:36:15","updated_at":"2017-10-08 19:35:41","container":"No","rate":5,"created_at_new":"15-10-2016 16:36:15","vehicle_name":"Eicher","owner_mobile":"","screen":"Google, google Pixel, 7.1.2, App Version: 6.4, Installation Date: 18 Jul 17, 10:43 AM"};

    var driverRef = ref.child("drivers");

    var newDriverRef = driverRef.push();
    newDriverRef.set(driverdata);
    return res.json({"success" : true, "message" : "Data saved" , "data" : {} });
});
router.all('/getFireBase', function (req, res) {
    var db = admin.database();
    var ref = db.ref("server/saving-data/fireblog");

    ref.on("child_added", function(snapshot, prevChildKey) {
      var newDriver = snapshot.val();
      console.log(newDriver);
      //return res.json({"success" : true, "message" : "Data saved" , "data" : newDriver.drivers });
    });
    
});


function tokenGenerate() 
{
    var text = "";
    var possible = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (var i = 0; i < 25; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function  getDateINyyyyMmDd(date)
{
    var time = new Date(date); 
    var dd = ("0" + time.getDate()).slice(-2);
    var mm = ("0" + (time.getMonth() + 1)).slice(-2)
    var yyyy = time.getFullYear();
    var H = time.getHours();
    var i = time.getMinutes();
    var s = time.getSeconds();
    var completeDate = yyyy+'-'+mm+'-'+dd +' '+H+':'+i+':'+s;
    return completeDate;
}

module.exports = router;