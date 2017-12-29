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

router.all('/getPrimeDriverSetting', function (req, res) {
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
        return res.json({"success" : false, "message" : message.DRIVER_ID_REQUIRED , "data" : {} });
    }
    else
    {
        var deviceId = Req.device_id;
    }
    var cityId;
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
                    locals.driver = driver[0];
                    cityId = driver[0].city_id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.DriverPrimeSetting, (err,primeDriverSetting) => {
                        if (err) return callback(err);
                        locals.primeDriverSetting = primeDriverSetting[0];
                        callback();
                    });
                },
                

            ], callback);
        },
    ], function(err) {
        if (err) return next(err);
        var result = {};
        if(locals.primeDriverSetting != undefined)
        {
            var result = locals.primeDriverSetting;
            var strArray = result.prime_membership_profit.split(",");
            result.prime_membership_profit = strArray;
        }
        
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : result });
    });
});

/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/addDriverPrime', function (req, res) {

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
        return res.json({"success" : false, "message" : message.DRIVER_ID_REQUIRED , "data" : {} });
    }
    else
    {
        var deviceId = Req.device_id;
    }
    if(Req.amount == undefined || Req.amount == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    else
    {
        var primeAmount = Req.amount;
    }
    var primeAutoRenew = 0;
    if(Req.prime_auto_renew != undefined || Req.prime_auto_renew != '')
    {
        var primeAutoRenew = Req.prime_auto_renew;
    }
       
    var cityId;
    var driverId;
    var createDate;
    var bookingIdArray = [0];
    var locals = {};
    var allowNumOfBookings = 30;
    var allowNumOfBookingsInDriver = 30;
    var allowNumOfDays = 30;
    var servicesResume = false;
    var expiredDate;
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
                    cityId = driver[0].city_id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.update(model.DriverPrime, {status: 1}, {driver_id:driverId}, (err, result) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({ city_id : cityId}).get(model.DriverPrimeSetting, (err,driverPrimeSetting) => {
                        if (err) return callback(err);
                        locals.driverPrimeSetting = driverPrimeSetting[0];
                        var allowNumOfBookings = driverPrimeSetting[0].prime_allow_number_of_booking;
                        var allowNumOfDays = driverPrimeSetting[0].prime_allow_number_of_days;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverPrime, (err,primeDriver) => {
                        if(primeDriver.length > 0)
                        {
                            locals.primeDriver = primeDriver[0];
                            createDate = primeDriver[0].created_at;
                            allowNumOfBookingsInDriver = locals.primeDriver.allow_number_of_booking;
                            expiredDate = locals.primeDriver.expired_date;
                        }
                        else
                        {
                            servicesResume = true;
                        }
                        
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId, 'requirement_time >=': createDate }).get(model.Booking, (err,booking) => {
                        if (err) return callback(err);
                        for (var i = 0; i < booking.length; i++) {
                            bookingIdArray.push(booking[i].id);
                        }
                        callback();
                    });
                }
                    
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({ 'complete !=': ''}).where_in('booking_id',bookingIdArray).get(model.BookingStatus, (err,completedBooking) => {
                        if (err) return callback(err);
                        locals.completedBooking = completedBooking;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({ 'created_at >=': createDate, driver_id : driverId}).where_in('emp_id',[1,49]).get(model.DashboardNotification, (err,rejectedBooking) => {
                        if (err) return callback(err);
                        locals.rejectedBooking = rejectedBooking;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId }).order_by('id', 'desc').get(model.DriverWallet, (err,driverWallet) => {
                        if (err) return callback(err);
                        locals.driverWallet = driverWallet[0];
                        callback();
                    });
                },
                    
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var bookingCount = locals.completedBooking.length + locals.rejectedBooking.length;
                    var currentDate  = dt.format('Y-m-d H:M:S');
                    if( bookingCount >= allowNumOfBookingsInDriver &&  expiredDate < currentDate)
                    {
                        servicesResume = true;
                    }
                    if(servicesResume == true)
                    {
                        var primeData = {
                                    driver_id : driverId,
                                    amount : primeAmount,
                                    allow_number_of_booking : allowNumOfBookings,
                                    expired_date : dt.format('Y-m-d H:M:S'),
                                    created_at : dt.format('Y-m-d H:M:S'),
                                    updated_at : dt.format('Y-m-d H:M:S'),
                                    status : 0,
                                    added_by : 49
                                };
                        qb.insert(model.DriverPrime, primeData, (err, res) => {
                            if (err) return console.error(err);
                            var finalBalanceForPrimeCharge = primeAmount;
                            if(locals.driverWallet.length != 0)
                            {
                                finalBalanceForPrimeCharge = locals.driverWallet.balance - primeAmount;
                            }
                            var driverWalletData = {
                                                booking_id : 0,
                                                driver_id : driverId,
                                                credit : 0,
                                                debit : primeAmount,
                                                remark : 'Prime Driver Subscription Charge',
                                                note : 'Prime Driver Subscription Charge Apply',
                                                balance : finalBalanceForPrimeCharge,
                                                created_at : dt.format('Y-m-d H:M:S')
                                            };
                             qb.insert(model.DriverWallet, driverWalletData, (err, res) => {
                                if (err) return console.error(err);
                                callback();
                             });

                        });

                        callback();
                    }
                    else
                    {
                        var updateData = {
                                    status : 0,
                                    added_by :49,
                                    updated_at : dt.format('Y-m-d H:M:S')
                                };
                        qb.update(model.DriverPrime, updateData, {id:locals.primeDriver.id}, (err, result) => {
                            if (err) return console.error(err);
                            callback();
                        });
                    }
                },
                function(callback) {
                    var updateDriverData = {
                                is_prime : 1,
                                prime_auto_renew : primeAutoRenew
                            };
                    qb.update(model.Driver, updateDriverData, {id:driverId}, (err, result) => {
                        if (err) return console.error(err);
                        callback();
                    });
                }
            ], callback);
        },

    ], function(err) {
        if (err) return next(err);
        
        var result = {};
        var bookingCount = locals.completedBooking.length + locals.rejectedBooking.length;
        var date1 = new Date();
        var date2 = new Date(createDate);
        var timeDiff = Math.abs(date2.getTime() - date1.getTime());
        var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
        var day = date2.getDay();
        var month = new Array();
        if(Req.lang == undefined || Req.lang == 'en')
        {
            month[0] = "January";
            month[1] = "February";
            month[2] = "March";
            month[3] = "April";
            month[4] = "May";
            month[5] = "June";
            month[6] = "July";
            month[7] = "August";
            month[8] = "September";
            month[9] = "October";
            month[10] = "November";
            month[11] = "December";
        }
        else
        {
            month[0] = "जनुअरी";
            month[1] = "फेब्रुअरी";
            month[2] = "मार्च";
            month[3] = "अप्रैल";
            month[4] = "मई";
            month[5] = "जून";
            month[6] = "जुलाई";
            month[7] = "अगस्त";
            month[8] = "सितम्बर";
            month[9] = "अक्टूबर";
            month[10] = "नवंबर";
            month[11] = "दिसंबर";
        }
        var monthName = month[date2.getMonth()];
        var year = date2.getYear();
        var signUpDate = day +' '+monthName +' '+year;

        result.primeDriver = locals.primeDriver;
        result.primeDriver.is_prime = locals.driver.is_prime;
        result.primeDriver.prime_auto_renew = locals.driver.prime_auto_renew;
        result.primeDriver.number_of_booking_completed = bookingCount;
        result.primeDriver.number_of_remaining_days = diffDays;
        result.primeDriver.created_at = signUpDate;
        return res.json({"success" : true, "message" : message.PRIME_DRIVER_SUCCESS , "data" : result });
    });
});

/* This function is used to set driver login details
# Request : device Id ,lat , lng, status, device_info
# Response : 
*/
router.all('/getDriverPrimeData', function (req, res) {
    
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
        return res.json({"success" : false, "message" : message.DRIVER_ID_REQUIRED , "data" : {} });
    }
    else
    {
        var deviceId = Req.device_id;
    }
    var createDate;
    var bookingIdArray = [0];
    var locals = {};
    var driverId;
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
                    cityId = driver[0].city_id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverPrime, (err,primeDriver) => {
                        if (err) return callback(err);
                        locals.primeDriver = primeDriver[0];
                        createDate = primeDriver[0].created_at
                        callback();
                    });
                },
                function(callback) {
                    async.parallel([
                        
                        function(callback) {
                            qb.select('*').where({driver_id: driverId, 'requirement_time >=': createDate }).get(model.Booking, (err,booking) => {
                                if (err) return callback(err);
                                for (var i = 0; i < booking.length; i++) {
                                    bookingIdArray.push(booking[i].id);
                                }
                                callback();
                            });
                        }
                    ], callback);
                },
            ], callback);
        },    
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({ 'complete !=': ''}).where_in('booking_id',bookingIdArray).get(model.BookingStatus, (err,completedBooking) => {
                        if (err) return callback(err);
                        locals.completedBooking = completedBooking;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({ 'created_at >=': createDate, driver_id : driverId}).where_in('emp_id',[1,49]).get(model.DashboardNotification, (err,rejectedBooking) => {
                        if (err) return callback(err);
                        locals.rejectedBooking = rejectedBooking;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('prime_auto_renew,is_prime').where({ id : driverId}).get(model.Driver, (err,driver) => {
                        if (err) return callback(err);
                        locals.driver = driver;
                        callback();
                    });
                },
         ], callback);
        },

    ], function(err) {
        if (err) return next(err);
        
        var result = {};
        var bookingCount = locals.completedBooking.length + locals.rejectedBooking.length;
        var date1 = new Date();
        var date2 = new Date(locals.primeDriver.created_at);
        var timeDiff = Math.abs(date2.getTime() - date1.getTime());
        var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
        var day = date2.getDay();
        var month = new Array();
        if(Req.lang == undefined || Req.lang == 'en')
        {
            month[0] = "January";
            month[1] = "February";
            month[2] = "March";
            month[3] = "April";
            month[4] = "May";
            month[5] = "June";
            month[6] = "July";
            month[7] = "August";
            month[8] = "September";
            month[9] = "October";
            month[10] = "November";
            month[11] = "December";
        }
        else
        {
            month[0] = "जनुअरी";
            month[1] = "फेब्रुअरी";
            month[2] = "मार्च";
            month[3] = "अप्रैल";
            month[4] = "मई";
            month[5] = "जून";
            month[6] = "जुलाई";
            month[7] = "अगस्त";
            month[8] = "सितम्बर";
            month[9] = "अक्टूबर";
            month[10] = "नवंबर";
            month[11] = "दिसंबर";
        }
        var monthName = month[date2.getMonth()];
        var year = date2.getYear();
        var signUpDate = day +' '+monthName +' '+year;

        result.primeDriver = locals.primeDriver;
        result.primeDriver.is_prime = locals.driver.is_prime;
        result.primeDriver.prime_auto_renew = locals.driver.prime_auto_renew;
        result.primeDriver.number_of_booking_completed = bookingCount;
        result.primeDriver.number_of_remaining_days = diffDays;
        result.primeDriver.created_at = signUpDate;
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : result });
    });
});

/* This function is used to set driver logout details
# Request : Token
# Response : Json Messages and data
*/
router.all('/autoPrimeRenew', function (req, res) {
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
        return res.json({"success" : false, "message" : message.DRIVER_ID_REQUIRED , "data" : {} });
    }
    else
    {
        var deviceId = Req.device_id;
    }
    var primeAutoRenew = 0;
    if(Req.prime_auto_renew != undefined || Req.prime_auto_renew != '')
    {
        var primeAutoRenew = Req.prime_auto_renew;
    }
    primeAutoRenew == 'true' ? 1 : 0;
    console.log(primeAutoRenew);
    qb.update(model.Driver, {prime_auto_renew: primeAutoRenew}, {driver_device_id:deviceId}, (err, result) => {
        if (err) 
        {
            return res.json({"success" : false, "message" : message.DRIVER_ID_REQUIRED , "data" : {} });
        }
        else
        {
            return res.json({"success" : true, "message" : message.DRIVER_UPDATE_SUCCESS , "data" : {} });
        }
        
    });
    
});



module.exports = router;