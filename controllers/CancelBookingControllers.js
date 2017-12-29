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
# Request : device Id 
# Response : result array with message
# Author : Vinod Kumar
*/
router.all('/cancelBookingByDriver', function (req, res) {
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
    var distanceToCustomer = Req.distance_to_customer;
    if(distanceToCustomer == undefined)
    {
        distanceToCustomer = 0;
    }
    var tripDistance = Req.trip_distance;
    if(tripDistance == undefined)
    {
        tripDistance = 0;
    }
    var distanceFree = Req.distance_free;
    if(distanceFree == undefined)
    {
        distanceFree = 0;
    }
    var locals = {};
    var bookingIdArray = [0];
    var reason = 'Cancelled by driver';
    var issuesType = 'all';
    var action = 'Scrapped Off';
    var driverId;
    var vehicleId;
    var customerId;
    var bookingIsEdit = 0;
    var driverVehicleId;
    var penaltyCharge;
    var finalBalanceForPenaltyCharge;
    var cancellationCharges;
    var actualDtcKm;
    var paidToDriver;
    var responseCode = 0;
    async.series([
        function(callback) {
            qb.select('*').where({id: bookingId}).order_by('id', 'desc').get(model.Booking, (err,booking) => {
                if (err || booking.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    mgCode = booking[0].mg_id;
                    driverId = booking[0].driver_id;
                    vehicleId = booking[0].vehicle_id;
                    customerId = booking[0].customer_id;
                    bookingIsEdit = booking[0].updated_by;
                    locals.bookingFinalDetials = booking[0];
                    dataObj = {
                                distance_to_customer : distanceToCustomer/1000,
                                actual_trip_distance : tripDistance/1000,
                                driver_id : '-1'
                            };
                    qb.update(model.Booking, dataObj, {id: bookingId}, (err, result) => {
                        if (err) return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                        callback();
                    });
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var driverFreeDetials = {
                                        driver_id : driverId,
                                        free_travelled_distance : distanceFree,
                                        total_distance_distance : 0,
                                        created_at : dt.format('Y-m-d H:M:S')
                                    };
                    qb.insert(model.DriverFreeDetials, driverFreeDetials, (err, res) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    
                    qb.select('*').where({id: bookingId}).order_by('id', 'desc').get(model.CancelBooking, (err,cancelBooking) => {
                        if(cancelBooking.length == 0)
                        {
                            var cancelBookingData = {
                                        employee_id : 49,
                                        booking_id : bookingId,
                                        reason : reason,
                                        issues_type : issuesType,
                                        action : action,
                                        created_at : dt.format('Y-m-d H:M:S'),
                                        updated_at : dt.format('Y-m-d H:M:S')
                                    };
                                    
                            qb.insert(model.CancelBooking, cancelBookingData, (err, res) => {
                                if (err) return console.error(err);
                                callback();
                            });
                        }
                        else
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        }
                        
                    });
                },
                function(callback) {
                    
                    qb.select('*').where({booking_id: bookingId}).order_by('id', 'desc').get(model.BookingStatus, (err,bookingStatus) => {
                        
                        if(bookingStatus.length > 0)
                        {
                            locals.bookingStatus = bookingStatus[0];
                            var bookingstatusData = {
                                        cancel_time : dt.format('Y-m-d H:M:S')
                                    };
                            qb.update(model.BookingStatus, bookingstatusData, {booking_id: bookingId}, (err, result) => {
                                if (err) console.log(err);
                                callback();
                            });
                        }
                        else
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        }
                        
                    });
                },
                function(callback) {
                    qb.select('*').where({id: driverId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                        if (driver.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        }
                        else
                        {
                            locals.driver = driver[0];
                            driverVehicleId = driver[0].vehicle_category_id;
                            callback();
                        }
                        
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).order_by('id', 'desc').get(model.BookingDriverDetails, (err,bookingDriverDetails) => {
                        if(bookingDriverDetails.length == 0 )
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        }
                        locals.bookingDriverDetails = bookingDriverDetails[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverWallet, (err,driverWallet) => {
                        if (err) return console.error(err);
                        locals.driverWallet = driverWallet;
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    
                    qb.select('*').where({id: driverVehicleId}).order_by('id', 'desc').get(model.VehicleCategory, (err,vehicleCategory) => {
                        if(vehicleCategory.length == 0 )
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        }
                        locals.vehicleCategory = vehicleCategory[0];
                        penaltyCharge = vehicleCategory[0].driver_fixed_cancellation_charge;
                        cancellationCharges = vehicleCategory[0].driver_cancellation_per_km;
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    if(locals.bookingStatus != undefined) 
                    {
                        if((locals.bookingStatus.to_customer_time != '' && locals.bookingStatus.loading_time == '') || (locals.bookingStatus.to_customer_time == '' && bookingIsEdit == 0))
                        {
                            //addDriverPanelty
                            if(locals.driverWallet.length > 0)
                            {
                                finalBalanceForPenaltyCharge = locals.driverWallet[0].balance - penaltyCharge;
                            }
                            else
                            {
                                finalBalanceForPenaltyCharge = 0 - penaltyCharge;
                            }
                            var walletData = {
                                        booking_id : bookingId,
                                        driver_id : driverId,
                                        credit : 0,
                                        debit : penaltyCharge,
                                        remark : 'Driver Penalty',
                                        note : 'Penalty for not completing the booking after accepting it. Penalty Towards Trip id: '+bookingId,
                                        balance : finalBalanceForPenaltyCharge,
                                        created_at : dt.format('Y-m-d H:M:S')
                            };
                            console.log(walletData);
                            qb.insert(model.DriverWallet, walletData, (err, res) => {
                                if (err) return console.error(err);

                                responseCode = 1;
                                callback();
                            });
                        }
                        else 
                        {
                            //Credit Canellation Charge Per KM in Driver Wallet
                            actualDtcKm        = locals.bookingFinalDetials.actual_distance_to_customer;
                            paidToDriver       = Math.round(actualDtcKm * cancellationCharges);
                            if(locals.driverWallet.length > 0)
                            {
                                finalBalanceForPenaltyCharge = locals.driverWallet[0].balance + paidToDriver;
                            }
                            else
                            {
                                finalBalanceForPenaltyCharge = 0 + paidToDriver;
                            }
                            if(paidToDriver > 0)
                            {
                                var walletData = {
                                    booking_id : bookingId,
                                    driver_id : driverId,
                                    credit : paidToDriver,
                                    debit : 0,
                                    remark : 'Cancellation Charges',
                                    note : 'Booking cancellation charges',
                                    balance : finalBalanceForPenaltyCharge,
                                    created_at : dt.format('Y-m-d H:M:S')
                                };
                                console.log(walletData);
                                qb.insert(model.DriverWallet, walletData, (err, res) => {
                                    if (err) return console.error(err);
                                    responseCode = 1;
                                    callback();
                                });
                            }
                            callback();
                        }
                    }
                    else
                    {
                        return res.json({"success" : false, "message" : message.BOOKING_COMPLETED , "data" : {} });
                    }
                    callback();
                },
            ], callback);
        },
    ], function(err) {
        if (err) console.log(err);
        if(responseCode == 0)
        {
            return res.json({"success" : false, "message" : message.ALREADY_CANCEL , "data" : {} });
        }
        else
        {
            return res.json({"success" : true, "message" : message.DRIVER_PENELTY_SUCCESS , "data" : {} });
        }
    });

    
});


/* This function is used to upload billty image
# Request : Image and booking id
# Response : Message
# Author : Vinod Kumar
*/
router.all('/updateCancelationDistance', function (req, res) {
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

    if(Req.driver_id == undefined || Req.driver_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var driverId = Req.driver_id;
    var distanceToCustomer = Req.distance_to_customer;
    if(distanceToCustomer == undefined)
    {
        distanceToCustomer = 0;
    }
    var tripDistance = Req.trip_distance;
    if(tripDistance == undefined)
    {
        tripDistance = 0;
    }
    var distanceFree = Req.distance_free;
    if(distanceFree == undefined)
    {
        distanceFree = 0;
    }
    responseCode = 0;
    var locals = {};
    async.series([
        function(callback) {
            qb.select('*').where({id: bookingId}).order_by('id', 'desc').get(model.Booking, (err,booking) => {
                if (err || booking.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                } 
                else
                {
                    mgCode = booking[0].mg_id;
                    driverId = booking[0].driver_id;
                    vehicleId = booking[0].vehicle_id;
                    customerId = booking[0].customer_id;
                    bookingIsEdit = booking[0].updated_by;
                    locals.bookingFinalDetials = booking[0];
                    dataObj = {
                                distance_to_customer : distanceToCustomer/1000,
                                actual_trip_distance : tripDistance/1000
                            };
                    qb.update(model.Booking, dataObj, {id: bookingId}, (err, result) => {
                        if (err) console.log(err);
                        responseCode = 1;
                        callback();

                    });
                }
            });
        },
    ], function(err) {
        if (err) console.log(err);

        if(responseCode == 0)
        {
            return res.json({"success" : false, "message" : message.ALREADY_CANCEL , "data" : {} });
        }
        else
        {
            return res.json({"success" : true, "message" : message.DRIVER_PENELTY_SUCCESS , "data" : {} });
        }
    });
});


module.exports = router;