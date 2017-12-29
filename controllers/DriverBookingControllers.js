var express = require('express');
var router = express.Router();
var _ = require('underscore');
const settings = require('../config/db.json');
const message = require('../lang/messages_hi.json');
const model = require('../models/model.json');
const qb = require('node-querybuilder').QueryBuilder(settings, 'mysql', 'single');
var datetime = require('node-datetime');
var dt = datetime.create();
var async      = require('async');
var FCM = require('fcm-node');
var serverKey = 'AIzaSyD3ZGOuuW3NDUNLPcJoBkAR0kpjP2dT4lA'; //put your server key here
var fcm = new FCM(serverKey);

/* This function is used to set driver login details
# Request : device Id
# Response : json response with booking count of the day.
# author : Vinod Kumar 
*/
router.all('/getDriverBooking', function (req, res, callback) {
    if(req.method == 'POST')
    {
        var Req = req.body;
    }
    else
    {
        var Req = req.query;
    }
    if(Req.device_id == undefined || Req.device_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    var response = {};
    var canceBookingCount = 0;
    var driverRating = 0;
    var cancelBookingEarning = 0;
    var completeBookingEarning = 0;
    var completeBookingCount = 0;
    qb.select('*').where({driver_device_id: Req.device_id}).get(model.Driver, (err,rows) => {
        if (err || rows.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {}});
        }
        else
        {
            response.is_prime = rows[0].is_prime;
            async.parallel([
               function(cancel_booking) {
                    var created_at = dt.format('Y-m-d')+' 00:00:00';
                    qb.select('*').from('booking_driver_details')
                    .join('dashboard_notification','dashboard_notification.booking_id = booking_driver_details.booking_id')
                    .where({'dashboard_notification.driver_id': rows[0].id , 'dashboard_notification.created_at >' :created_at }).get((err,rejectBookingData) => {
                        var bookingIdsArray = [1];
                        if(rejectBookingData.length > 0)
                        {
                            for (var i = 0; i < rejectBookingData.length; i++) 
                            {
                                bookingIdsArray.push(rejectBookingData[i]['booking_id']);
                                canceBookingCount = canceBookingCount + 1;
                                cancelBookingEarning = cancelBookingEarning + rejectBookingData[i].trip_charge + rejectBookingData[i].loading_charge + rejectBookingData[i].unloading_charge + rejectBookingData[i].drop_points_charge + rejectBookingData[i].estimate_driver_surge_charge + rejectBookingData[i].tip_charge;
                                
                            }
                        }
                        response.cancel_booking_count = canceBookingCount;
                        response.cancel_booking_earning = cancelBookingEarning;
                        cancel_booking();
                    });
               },
               function(complete_booking) {
                   var created_at = dt.format('Y-m-d')+' 00:00:00';
                    qb.select('*').from('booking_driver_details')
                    .join('booking','booking.id = booking_driver_details.booking_id')
                    .where({'booking.driver_id': rows[0].id , 'booking.created_at >' :created_at }).get((err,completeBookingData) => {
                        var bookingIdsArray = [1];
                        if(completeBookingData.length > 0)
                        {
                            for (var i = 0; i < completeBookingData.length; i++) 
                            {
                                bookingIdsArray.push(completeBookingData[i]['booking_id']);
                                completeBookingCount = completeBookingCount + 1;
                                completeBookingEarning = cancelBookingEarning + completeBookingData[i].trip_charge + completeBookingData[i].loading_charge + completeBookingData[i].unloading_charge + completeBookingData[i].drop_points_charge + completeBookingData[i].estimate_driver_surge_charge + completeBookingData[i].tip_charge;
                                
                            }
                        }
                        response.booking_count = completeBookingCount;
                        response.total_earning = completeBookingEarning;
                        complete_booking();
                    });
               },
               function(driver_rating) {
                    qb.select('*').where({driver_id: rows[0].id , 'rate_date' :dt.format('Y-m-d') }).order_by('id', 'desc').get(model.DriverRating, (err,driverRatingData) => {
                        
                        if(driverRatingData.length > 0)
                        {
                            driverRating = driverRatingData[0].rate;
                        }
                        response.driver_rating = driverRating;
                        driver_rating();
                    });
               }
            ], function(err) {
                 if (err) console.log(err);
                 return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response});
            });
        }
    });
});

/* This function is used to get Booking details
# Request : Driver Id and Booking Id 
# author : Vinod Kumar 
# Response : Json respose with Booking data and messages
*/
router.all('/getNewBookingDetails', function (req, res) {
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
    
    var bookingId = Req.booking_id;
    var driverId = Req.driver_id;
    var locals = {};
    var customerId;
    var vehicleId;
    var cityId;
    var goodsId;
    var billingId;
    var userId = 1;
    var origins;
    var destinations;
    async.series([
        //Load Booking
        function(callback) {
            getBookingByID(bookingId, function(err, booking) {
                if (err) return callback(err);
                if(booking == undefined)
                {
                    return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                }
                customerId = booking.customer_id;
                vehicleId = booking.vehicle_id;
                cityId = booking.city_id;
                goodsId = booking.goods_id;
                billingId = booking.customer_pricing_id;
                locals.booking = booking;
                callback();
            });
        },
        function(callback) {
            async.parallel([
                //Load Customer
                function(callback) {
                    getCustomerByID(customerId, function(err, customer) {
                        if (err) return callback(err);
                        locals.customer = customer;
                        callback();
                    });
                },
                //Load Driver
                function(callback) {
                    getDriverByID(driverId, function(err, driver) {
                        if (err) return callback(err);
                        locals.driver = driver;
                        callback();
                    });
                },
                // Load Vehicle
                function(callback) {
                    getVehicleByID(vehicleId, function(err, vehicle) {
                        if (err) return callback(err);
                        locals.vehicle = vehicle;
                        callback();
                    });
                },
                function(callback) {
                    getBillingType(billingId, function(err, billingType) {
                        if (err) return callback(err);
                        locals.billingType = billingType;
                        callback();
                    });
                },

                function(callback) {
                    qb.select('*').where({customer_id: customerId}).order_by('id', 'desc').get(model.CustomerLedger, (err,customerWallet) => {
                        if (err) return callback(err);
                        locals.customerWallet = customerWallet[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverWallet, (err,driverWallet) => {
                        if (err) return callback(err);
                        locals.driverWallet = driverWallet[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({customer_id: customerId}).order_by('id', 'desc').get(model.CreditLimit, (err,creditLimit) => {
                        if (err) return callback(err);
                        locals.creditLimit = creditLimit[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({customer_id: customerId}).order_by('id', 'desc').get(model.CustomerSetting, (err,customerSetting) => {
                        if (err) return callback(err);
                        locals.customerSetting = customerSetting[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).get(model.BookingCustomerDetails, (err,bookingCustomerDetails) => {
                        if(bookingCustomerDetails.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.bookingCustomerDetails = bookingCustomerDetails[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).get(model.BookingDriverDetails, (err,bookingDriverDetails) => {
                        if(bookingDriverDetails.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.bookingDriverDetails = bookingDriverDetails[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).get(model.BookingStatus, (err,bookingStatus) => {
                        if(bookingStatus.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.bookingStatus = bookingStatus[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.MaalgaadiSettings, (err,maalgaadiSettings) => {
                        if(maalgaadiSettings.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.maalgaadiSettings = maalgaadiSettings[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.DriverPrimeSetting, (err,driverPrimeSetting) => {
                        if(driverPrimeSetting.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.driverPrimeSetting = driverPrimeSetting[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({id: goodsId}).get(model.GoodsType, (err,goodsType) => {
                        if(goodsType.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.goodsType = goodsType[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({id: userId}).get(model.User, (err,user) => {
                        if(user.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        locals.user = user[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).order_by('id', 'desc').get(model.FavoriteLocation, (err,favoriteLocation) => {
                        if(favoriteLocation.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        var originsString  = favoriteLocation[0].pickup_lat +","+ favoriteLocation[0].pickup_lng;
                        origins = [originsString];
                        locals.favoriteLocation = favoriteLocation[0];
                        callback();
                    });
                },
                // load Driver Reguler 
                function(callback) {
                    qb.select('lat,lng').where({driver_id: driverId}).get(model.DriverRegular, (err,driverRegular) => {
                        if(driverRegular.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
                        }
                        var destination  = driverRegular[0].lat +","+ driverRegular[0].lng;
                        destinations = [destination];
                        locals.driverRegular = driverRegular[0];
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).get(model.CustomerDropPoints, (err,customerDropPoints) => {
                        locals.customerDropPoints = customerDropPoints;
                        callback();
                    });
                }
                
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    getDistance(origins,destinations, function(err, distance) {
                        if (err) return callback(err);
                        locals.distance = distance;
                        callback();
                    });
                }
         ], callback);
        },

    ], function(err) {
        if (err)
        {
            return res.json({"success" : false, "message" : message.BOOKING_ID_NOT_EXIT , "data" : {}});
        }
        var podStatus = false;
        var navigation = false;
        var customerPhone = locals.customer.cust_number;
        var phoneNumber = "+919111012142";
        var driverBalance = 0;
        if(locals.booking.phy_pod_required != 0 || locals.booking.e_pod_required != 0)
        {
            var podStatus = true;
        }
        if(locals.booking.navigation_required == 1)
        {
            var navigation = true;
        }
        if(locals.favoriteLocation.pickup_number != '' )
        {
            customerPhone = locals.favoriteLocation.pickup_number;
        }
        if(locals.user.phone != '')
        {
            phoneNumber = locals.user.phone;
        }
        if(locals.driverWallet.balance != '')
        {
            driverBalance = locals.driverWallet.balance;
        }
        var distanceMeter = 0;
        var dis = 0;
        var timeTake = 0;
        var timeText = '';
        var etaTimeInMin = 0;
        var maxDTC = 0;
        var dtcKm = 0;
        var etaTime = 15;
        if(locals.distance != '')
        {
            distanceMeter = locals.distance.rows[0].elements[0].distance.value; 
            dis      = locals.distance.rows[0].elements[0].distance.text; 
            timeTake = locals.distance.rows[0].elements[0].duration.value; 
            timeText = locals.distance.rows[0].elements[0].duration.text; 
            var dis  = dis/1000;
            var dis  = dis.toFixed(2);
            var etaTimeInMin = timeTake/60;
        }
        
        if(locals.vehicle != "")
        {
            
            var maxDtcBufferPercentage = locals.vehicle.max_dtc_buffer_percentage;
            var lowerLimit = locals.vehicle.lower_limit;
            var upperLimit = locals.vehicle.upper_limit;
            var dtcCharges = locals.vehicle.dtc_rate;
 
            var dtcKm = ((distanceMeter/1000) + (((distanceMeter/1000) * maxDtcBufferPercentage) / 100));
            if(dtcKm <= upperLimit && dtcKm >= lowerLimit)
            {
                maxDTC = (dtcKm - lowerLimit) * dtcCharges;
            }
            var etaBufferPercentage = locals.vehicle.eta_buffer_percentage;
            var etaTime      = etaTimeInMin + ((etaTimeInMin*etaBufferPercentage)/100);
        }
        var bookScheduleTime = Date.parse(locals.booking.requirement_time);
        var bookScheduleTime = bookScheduleTime/1000;
        var CurrentTimeInseconds = new Date().getTime() / 1000;
        var timeToCustomer    = ((bookScheduleTime - CurrentTimeInseconds) / 60);
        var wayPointsArray = [];
        var count = 0;
        if(locals.favoriteLocation.pickup_landmark != '')
        {
            wayPointsArray[count] = {};
            wayPointsArray[count].is_drop = false;
            wayPointsArray[count].is_pickup = true;
            wayPointsArray[count].landmark =  locals.favoriteLocation.pickup_landmark;
            wayPointsArray[count].latitude = locals.favoriteLocation.pickup_lat;
            wayPointsArray[count].longitude = locals.favoriteLocation.pickup_lng;
            count = count + 1;
        }
        if(locals.customerDropPoints != '')
        {
            for (var i = 0; i < locals.customerDropPoints.length; i++) 
            {
                wayPointsArray[count] = {};
                wayPointsArray[count].is_drop = false;
                wayPointsArray[count].is_pickup = false;
                wayPointsArray[count].landmark  = locals.customerDropPoints[i].drop_landmark;
                wayPointsArray[count].latitude  = locals.customerDropPoints[i].drop_lat;
                wayPointsArray[count].longitude = locals.customerDropPoints[i].drop_lng;
                count++;
            }
        }

        if(locals.favoriteLocation.drop_landmark != '')
        {
            wayPointsArray[count] = {};
            wayPointsArray[count].is_drop = true;
            wayPointsArray[count].is_pickup = false;
            wayPointsArray[count].landmark = locals.favoriteLocation.drop_landmark;
            wayPointsArray[count].latitude = locals.favoriteLocation.drop_lat;
            wayPointsArray[count].longitude = locals.favoriteLocation.drop_lng;
            count = count + 1;
        }
        if(locals.bookingDriverDetails.length > 0)
        {
            var amount = locals.bookingDriverDetails.trip_charge + locals.bookingDriverDetails.loading_charge + locals.bookingDriverDetails.unloading_charge + locals.bookingDriverDetails.drop_points_charge + locals.bookingDriverDetails.estimate_driver_surge_charge;
        }
        
        
        var screen_parameters = [];
        var k = 0;
        if(locals.billingType.type)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'बुकिंग टाइप';
            screen_parameters[k].value = locals.billingType.type;
            k++;
        }
        if(locals.booking.upper_trip_distance)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'ट्रिप दुरी';
            screen_parameters[k].value = locals.booking.upper_trip_distance +' कि. मी.';
            k++;
        }
        if(amount)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'राशि';
            screen_parameters[k].value = '₹ '+ amount.toFixed(2);
            k++;
        }
        if(locals.goodsType.goods_name)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'सामान';
            screen_parameters[k].value = locals.goodsType.goods_name;
            k++;
        }
        if(locals.booking.drop_points)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'ड्राप बिंदु';
            screen_parameters[k].value = locals.booking.drop_points;
            k++;
        }
        if(locals.vehicle.vehicle_name_hindi)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'वर्ग';
            screen_parameters[k].value = locals.vehicle.vehicle_name_hindi; 
            k++;
        }
        if(dtcKm)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'दुरी ( पिकउप पॉइंट )';
            screen_parameters[k].value = dtcKm.toFixed(2) +' कि. मी.';
            k++;
        }
        if(maxDTC)
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'अधिकतम (डीटीसी)';
            screen_parameters[k].value = maxDTC.toFixed(2) +' कि. मी.';
            k++;
        }
        var mgBonus = 0;
        var mgBonusPercentage = 0;
        if(locals.driverPrimeSetting.prime_allow_surge == 1 && locals.driver.is_prime == 1)
        {
            mgBonus = locals.bookingDriverDetails.estimate_driver_surge_charge + locals.bookingDriverDetails.tip_charge;
            mgBonusPercentage = locals.bookingDriverDetails.estimate_driver_surge_percentage;
        }
        if(mgBonus != 0 )
        {
            screen_parameters[k] = {};
            screen_parameters[k].lable = 'बोनस';
            screen_parameters[k].value = '₹ '+ mgBonus;
            k++;
        }
        
        var bookingArray   = {
                            "booking_id"      : bookingId,
                            "landmark_list"   : wayPointsArray,
                            "screen_parameters" : screen_parameters,
                            "loading_status"  : locals.booking.loading_required == 1 ? true : false,
                            "unloading_status": locals.booking.unloading_required == 1 ? true : false,
                            "pickup_location" : locals.favoriteLocation.pickup_landmark,
                            "pickup_lat"      : locals.favoriteLocation.pickup_lat,
                            "pickup_lng"      : locals.favoriteLocation.pickup_lng,
                            "drop_location"   : locals.favoriteLocation.drop_landmark,
                            "drop_lat"        : locals.favoriteLocation.drop_lat,
                            "drop_lng"        : locals.favoriteLocation.drop_lng,
                            "goods"           : locals.goodsType.goods_name,
                            "other_goods"     : locals.booking.other_goods_text,
                            "drop_point"      : locals.booking.drop_points,
                            "amount"          : amount,
                            "estimated_trip_charge"     : locals.bookingDriverDetails.trip_charge,
                            "lower_trip_charge"     : locals.bookingDriverDetails.lower_trip_charge + locals.bookingDriverDetails.loading_charge + locals.bookingDriverDetails.unloading_charge + locals.bookingDriverDetails.drop_points_charge,
                            "pod"             : podStatus,
                            "higher_trip_distance" : locals.booking.upper_trip_distance,
                            "lower_trip_distance" : locals.booking.lower_trip_distance,
                            "booking_time"    : locals.booking.requirement_time,
                            "customer_mobile" : customerPhone,
                            "employee_id"     : locals.user.id,
                            "customer_care_mobile" : phoneNumber,
                            "driver_balance"  : driverBalance,
                            "distance_to_cutomer" : dtcKm*1000,
                            "max_distance_to_customer" : dtcKm,
                            "max_dtc_charge"  : maxDTC.toFixed(2),
                            "time_to_customer": timeToCustomer,
                            "loading_charge"  : locals.bookingDriverDetails.loading_charge,
                            "unloading_charge": locals.bookingDriverDetails.unloading_charge,
                            "payment_type"    : locals.booking.payment_option,
                            "booking_type"    : locals.billingType.type,
                            "customer_id"     : customerId,
                            "navigation"      :  navigation,
                            "oth_reference_text" : locals.customerSetting.oth_reference_text !=  '' ? locals.customerSetting.oth_reference_text : 1,
                            "oth_trip_code_allow" : locals.customerSetting.oth_trip_code_allow !=  '' ? locals.customerSetting.oth_trip_code_allow : 0,
                            "mg_bonus" : mgBonus,
                            "mg_bonus_percentage" : mgBonusPercentage,
                            "eta" : etaTime
                            };
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : bookingArray});
    });
    
});

function getBookingByID(bookingId, callback) {
    qb.select('*').where({id: bookingId}).get(model.Booking, (err,booking) => {
        if (err) return callback(err);
        booking = booking[0];
        callback(null, booking);
    });
}

function getCustomerByID(customerId, callback) {
     qb.select('*').where({id: customerId}).get(model.Customer, (err,customer) => {
        if (err) return callback(err);
        customer = customer[0];
        callback(null, customer);
    });
}

function getDriverByID(driverId, callback) {
     qb.select('*').where({id: driverId}).get(model.Driver, (err,driver) => {
        if (err) return callback(err);
        driver = driver[0];
        callback(null, driver);
    });
}

function getVehicleByID(vehicleId, callback) {
     qb.select('*').where({id: vehicleId}).get(model.VehicleCategory, (err,vehicle) => {
        if (err) return callback(err);
        vehicle = vehicle[0];
        callback(null, vehicle);
    });
}

function getBillingType(billingId, callback) {
     qb.select('*').where({id: billingId}).get(model.BillingType, (err,billingType) => {
        if (err) return callback(err);
        billingType = billingType[0];
        callback(null, billingType);
    });
}

function getDistance(origins,destinations, callback) {
    var google = require('../config/google.json');
    var distance = require('google-distance-matrix');
    distance.key(google.APIKEY);
    distance.units('imperial');
    distance.mode('driving');

    distance.matrix(origins, destinations, function (err, distances) {
        if (err) {
            return console.log(err);
        }
        callback(null, distances);
    });
}

/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/acceptBooking', function (req, res) {
    
    if(req.method == 'POST')
    {
        var Req = req.body;
    }
    else
    {
        var Req = req.query;
    }

    if(Req.booking_id == undefined || Req.booking_id == '')
    {
        return res.json({"success" : false, "message" : message.Booking_ID_REQUIRED , "data" : {}});
    }


    if(Req.device_id == undefined || Req.device_id == '')
    {
        return res.json({"success" : false, "message" : message.DEVICE_ID_REQUIRED , "data" : {}});
    }


    if(Req.employee_id == undefined || Req.employee_id == '')
    {
        return res.json({"success" : false, "message" : message.EMPLOYEE_ID_REQUIRED , "data" : {}});
    }
    var bookingId = Req.booking_id;
    var deviceId = Req.device_id;
    var empId = Req.employee_id;

    var maxDtcCharge = 0;
    if(Req.max_dtc_charge)
    {
        maxDtcCharge = Req.max_dtc_charge;
    }

    var dtcKm = 0;
    if(Req.max_dtc)
    {
        dtcKm = Req.max_dtc;
    }

    var eta = 15;
    if(Req.eta)
    {
        eta = Req.eta;
    }
    var time = '';
    if(Req.time)
    {
        time = Req.time;
    }
    var screen = "";
    if(Req.screen_name == undefined || Req.screen_name == '')
    {
        screen = "TO_CUSTOMER_SCREEN";
    }
    else
    {
        screen = Req.screen_name;
    }
    var driverId;
    var dashboardNotificationInfo;
    var bookingInfo;
    var locals = {};
    var vehicleId;
    var customerId;
    var messageString;
    var vehicleName;
    var vehicleRegNum;
    var driverName;
    var driverNumber;
    var customerMobileNo;
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD, "data" : 'vinod' });
                }
                else
                {
                    locals.driverDetails = driver[0];
                    driverId =  driver[0].id;
                    vehicleId = driver[0].vehicle_category_id;
                    vehicleRegNum = driver[0].vehicle_reg_no;
                    driverName = driver[0].driver_name
                    driverNumber = driver[0].driver_number
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({id: bookingId}).get(model.Booking, (err,booking) => {
                        if(booking.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.INVALID_BOOKING, "data" : {}});
                            callback();
                        }
                        
                        if((driverId == 0) && (driverId != -1) && (driverId != booking[0].driver_id))
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_ALLOTED_OTHER_DRIVER, "data" : {} });
                            callback();
                        }
                        else if(driverId == "-1")
                        {
                            return res.json({"success" : false, "message" : message.BOOKING_CANCELLED_BY_CUSTOMER, "data" : {}});
                            callback();
                        }
                        else
                        {
                            locals.booking = booking[0];
                            customerId = booking[0].customer_id;
                            callback();
                        }
                        
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var bookingUpdateData = {
                                        driver_id: driverId,
                                        current_status: 'to-customer',
                                        distance_to_customer: dtcKm,
                                        allotment_by: empId,
                                        updated_at:dt.format('Y-m-d H:M:S')
                                    }
                    qb.update(model.Booking, bookingUpdateData, {id: bookingId}, (err, result) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    var etaData = {
                                        booking_id: bookingId,
                                        driver_id: driverId,
                                        estimate_eta: eta + 15,
                                        actual_eta: eta,
                                        created_at: dt.format('Y-m-d H:M:S'),
                                        updated_at:dt.format('Y-m-d H:M:S')
                                    };
                    qb.insert(model.BookingEta, etaData, (err, res) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    var date = dt.format('Y-m-d H:M:S', time);
                    var bookingData = {to_customer_time: date}
                    qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
                        if (err) return console.error(err);
                        callback();
                    });
                },
                function(callback) {
                    editEmployeeAllotment(bookingId,'running', function(err, result) {
                        if (err) return callback(err);
                        callback();
                    });
                },
                function(callback) {
                    updateTripStatus(driverId, bookingId,'accepted', screen, function(err, result) {
                        if (err) return callback(err);
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({booking_id: bookingId}).get(model.DashboardNotification, (err,dashboardNotification) => {
                        if (err) return callback(err);
                        locals.dashboardNotificationInfo = dashboardNotification; 
                        callback();
                    });
                },
                function(callback){
                    qb.select('*').where({booking_id: bookingId,'driver_id !=' : driverId}).get(model.AllotedBooking, (err,allotedBooking) => {
                        if (err) return callback(err);
                        locals.allotedBooking = allotedBooking;
                        callback();
                    });
                },
                function(callback){
                    qb.select('vehicle_name').where({id: vehicleId}).get(model.VehicleCategory, (err,vehicleCategory) => {
                        if (err) return callback(err);
                        if(vehicleCategory.length > 0)
                        {
                            locals.vehicleCategory = vehicleCategory[0];
                            vehicleName = locals.vehicleCategory.vehicle_name;
                        }
                        
                        callback();
                    });
                },
                function(callback){
                    qb.select('*').where({id: customerId}).get(model.Customer, (err,customer) => {
                        if(customer.length > 0)
                        {
                            customerMobileNo = customer[0].cust_number;
                            locals.customer = customer[0];
                        }
                        

                        callback();
                    });
                },
            ], callback);
        },

        function(callback) {
            async.parallel([
                function(callback) {
                    
                    var allotedBooking = locals.allotedBooking;
                    var dashboardNotificationInfo = locals.dashboardNotificationInfo;
                    console.log(allotedBooking);
                    // if(allotedBooking.length > 0 && dashboardNotificationInfo.length == 0)
                    // {
                    //     allotedBooking.forEach(function(allotment) {
                    //         if(allotment.driver_id != driverId && allotment.booking_id != ''){
                    //             qb.select('fcm_token').where({id : driverId}).get(model.Driver, (err,driverFcmToken) => {
                    //                 locals.driverFcmToken = driverFcmToken;
                    //                 callback();
                    //             });
                    //         }
                    //         else
                    //         {
                    //             callback();
                    //         }
                            
                    //     });
                    // }
                    // else
                    // {
                    //     callback();
                    // }
                    callback();
                },
                function(callback) {
                    
                    var messageString = "Trip Id  "+bookingId+" Your MaalGaadi "+vehicleName+"  "+vehicleRegNum+" With "+driverName+" "+driverNumber+"  has been booked for "+dt.format('d-m-Y H:M:S')+". Hope you have an awesome experience. Call 8305-771-771 for any assistance.";
                    const apiSetting = require('../config/msg91.json');
                    var msg91 = require("msg91")(apiSetting.API_KEY, apiSetting.SENDER_ID, apiSetting.ROUTE_NO );
                    msg91.send(customerMobileNo, messageString, function(err, response){
                        callback();
                    });
                    
                },
                function(callback) {
                    var messageString = "Trip Id  "+bookingId+" Your MaalGaadi "+vehicleName+"  "+vehicleRegNum+" With "+driverName+" "+driverNumber+"  has been booked for "+dt.format('d-m-Y H:M:S')+". Hope you have an awesome experience. Call 8305-771-771 for any assistance.";
                    sendCustomerBookingNotification(customerId, messageString, 'to-customer', 'Customer', bookingId, function(err, result) {
                        if (err) return callback(err);
                        callback();
                    });
                },


            ], callback);
        },
        ], function(err) {
             
             return res.json({"success" : true, "message" : message.BOOKING_ACCEPTED , "data" : {} });
        });
});

/* This function is used to set driver login details
# Request : device Id ,lat , lng, status, device_info
# Response : 
*/
router.all('/updateBookingStatus', function (req, res) {
    
    if(req.query.device_id == undefined || req.query.device_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    
    qb.select('id')
        .where({driver_device_id: req.query.device_id})
        .get('drivers', (err,rows) => {
            if (err || rows.length == 0)
            {
                var Response = { days : 15, verification_flag : true};
                return res.json({"success" : false, "message" : message.NO_RECORD, "data" : {}});
            }
            else
            {
                _.each(rows, function(record) {
                    var token = tokenGenerate();
                    qb.update('driver_login_token', {token: token}, {driver_id:record.id}, (err, result) => {
                        if (err) return console.error(err);
                    });
                    var insertData         = {};
                    insertData.driver_id   = record.id;
                    insertData.logout_time = dt.format('Y-m-d H:M:S');
                    insertData.created_at  = dt.format('Y-m-d H:M:S');
                    insertData.updated_at  = dt.format('Y-m-d H:M:S');
                    if(req.query.l_ul_status != undefined && req.query.l_ul_status == 1) 
                    {
                        insertData.loading_unloading_status = "yes";
                    }
                    else if(req.query.l_ul_status != undefined && req.query.l_ul_status == 0) 
                    {
                        insertData.loading_unloading_status = "no";
                    }
                    
                    if(req.query.helper_status != undefined && req.query.helper_status == 1 ) 
                    {
                        insertData.helper_status = "yes";
                    }
                    else if(req.query.helper_status != undefined && req.query.helper_status == 0 ) 
                    {
                        insertData.helper_status = "no";
                    }

                    if(req.query.covered_status != undefined && req.query.covered_status != '')
                    {
                        if(req.query.covered_status == 1)
                        {
                            insertData.covered_status = 'yes';
                        }
                        else if(req.query.covered_status == 0)
                        {
                            insertData.covered_status = 'no';
                        }
                    }
                    qb.insert('driver_login_detail', insertData, (err, res) => {
                        if (err) return console.error(err);
                    });
                    var rating = 5;
                    var response = {token : token , mg_id : record.mg_id, rating : rating, is_prime : record.is_prime};
                    return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : response});

                });
                
            }
        }
    );
});

router.all('/rejectBooking', function (req, res) {
    
    if(req.query.token == undefined || req.query.token == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {} });
    }
    
    qb.select('id').where({token: req.query.token}).get('driver_login_token', (err,rows) => {
        if (err || rows.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD, "data" : {}});
        }
        else
        {
            _.each(rows, function(record) {
                
                qb.update('driver_login_token', {token: ''}, {driver_id:record.driver_id}, (err, result) => {
                    if (err) return console.error(err);
                });

                qb.update('driver_login_detail', {logout_time: dt.format('Y-m-d H:M:S')}, {driver_id:record.driver_id}, (err, result) => {
                    if (err) return console.error(err);
                });

                qb.delete('driver_regular_data', {driver_id: record.driver_id}, (err, res) => {
                    if (err) return console.error(err);
                });
                
                return res.json({"success" : true, "message" : message.LOGOUT_SUCCESS , "data" : {} });
            });
        }
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


/* # Function : This function is used update booking time according to status
   # Request :  booking id,status, time
   # Autor : Rahul Patidar 
*/
function setBookingStatus(bookingId, status, time, callback) {
    var date = dt.format('Y-m-d H:M:S', time);
    if(status == "booked")
    {
        qb.select('*')
            .where({booking_id: bookingId})
            .get(model.BookingStatus, (err,bookingStatusDetails) => {
                var bookingData = {booking_id: bookingId, booking_time: date}
                if (err || bookingStatusDetails.length == 0)
                {
                    qb.insert(model.BookingStatus, bookingData, (err, res) => {
                        if (err) return console.error(err);
                    });
                }
                else
                {
                    qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
                        if (err) return console.error(err);
                    });
                }
            }
        );
    }
    else if (status == "to-customer")
    {
        var bookingData = {to_customer_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "billing")
    {
        var bookingData = {billing_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "completed")
    {
        var bookingData = {complete: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "loading")
    {
         var bookingData = {loading_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "on-trip")
    {
         var bookingData = {start_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "rating")
    {
         var bookingData = {rating: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "unloading")
    {
         var bookingData = {stop_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    else if (status == "uploading-pod")
    {
        var bookingData = {pod_time: date}
        qb.update(model.BookingStatus, bookingData, {booking_id:bookingId}, (err, result) => {
            if (err) return console.error(err);
        });
    }
    callback();
}

/* # Function : This function is used update employee allotment status
   # Request :  booking id,status
   # Autor : Rahul Patidar 
*/
function editEmployeeAllotment(bookingId, status, callback) {

    qb.select('*').where({booking_id: bookingId}).get(model.EmployeeAllotment, (err,employeeAllotmentDetails) => {
        var allotmentData = {updated_at: dt.format('Y-m-d H:M:S'), booking_status: status}
        if (employeeAllotmentDetails.length > 0)
        {
            qb.update(model.EmployeeAllotment, allotmentData, {booking_id:bookingId}, (err, result) => {
                if (err) return console.error(err);
                callback();
            });
        }
        else
        {
            callback();
        }
        
    });
}

/* # Function : This function is used update trip status status
   # Request :  driver id, booking id,status, screen
   # Autor : Rahul Patidar 
*/
function updateTripStatus(driverId, bookingId, status, screen, callback) {
   
    if(status == "completed")
    {
        qb.delete(model.DriverIncompleteTrip , {driver_id: driverId}, (err, res) => {
            callback();
        });
    }
    else
    {
        qb.select('*').where({driver_id: driverId, booking_id : bookingId}).get(model.DriverIncompleteTrip, (err,driverIncompleteInfo) => {
            if (err || driverIncompleteInfo.length == 0)
            { 
                var driverData = {booking_id: bookingId,driver_id: driverId,screen_name: screen, booking_status: status,created_at: dt.format('Y-m-d H:M:S'),'updated_at':dt.format('Y-m-d H:M:S')}
                qb.insert(model.DriverIncompleteTrip, driverData, (err, res) => {
                    if (err) return console.error(err);
                    callback();
                });
            }
            else
            {
                var driverData = {screen_name: screen, booking_status: status,updated_at : dt.format('Y-m-d H:M:S')}
                qb.update(model.DriverIncompleteTrip, driverData, {booking_id:bookingId,  booking_id : bookingId}, (err, result) => {
                    if (err) return console.error(err);
                    callback();
                });

            }
        });
    }
    
}

/* # Function : This function is used update trip status status
   # Request :  driver id, booking id,status, screen
   # Autor : Rahul Patidar 
*/
function sendCustomerBookingNotification(customerId, text, statusType, sendTo, bookingId,callback) {
    // var array = array();
    var locals = {};
    var tokenArray = [];
    async.series([
        function(callback) {
            qb.select('*').where({customer_id: customerId}).order_by('id', 'desc').get(model.CustomerSetting, (err,customerSetting) => {
                locals.customerSetting = customerSetting[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({customer_id: customerId}).order_by('id', 'desc').get(model.CustomerInfo, (err,customerInfo) => {
                if(customerInfo.length > 0)
                {
                    for (var i = 0; i < customerInfo.length; i++) {
                        tokenArray.push(customerInfo[i].device_token);
                    }
                }
                callback();
            });
        },

    ], function(err) {
        if (err)  console.log(err);
        var checkNotificationEnable = locals.customerSetting;
        var FCM = require('fcm-node');
        var google = require('../config/google.json');
        var serverKey = google.FCMAPIKEY; 
        var fcm = new FCM(serverKey);
        var messageData = { 
            to: tokenArray, 
            collapse_key: 'your_collapse_key',
            notification: {
                title: message.NOTIFICATION_CANCEL_TITLE, 
                body: message.NOTIFICATION_CANCEL_BODY 
            },
            data: {  
                title : 'MaalGaadi',
                message : text,
                customer_id: customerId,
                type : 'booking_notification'
            }
        };
        if (statusType == 'to-customer') 
        {
            if (checkNotificationEnable.noti_on_vehicle_allotment == 1) 
            {
                fcm.send(messageData, function(err, response){
                    callback();
                });
            }
            else
            {
                callback();
            }
        }
        else if (statusType == 'loading') 
        {
            if (checkNotificationEnable.noti_on_reaching_pickup_point == 1) 
            {
                fcm.send(messageData, function(err, response){
                    callback();
                });
            }
            else
            {
               callback(); 
            }
        }
        else
        {
            callback();
        }
        
    });

    
    // if (sendTo == 'Customer') 
    // {
    //     qb.select('id').where({cust_number: phone}).get(model.Customer, (err,customer) => {
    //         if (customer.length > 0)
    //         {
    //            var customerInfo = customer[0];
    //            qb.select('*').where({customer_id: customerInfo.id}).get(model.CustomerSetting, (err,customerSeting) => {
    //                 if (customerSeting.length > 0)
    //                 {
    //                     var customerSeting = customerSeting[0];
    //                     if(customerInfo && customerSeting)
    //                     {
    //                         getCustomerDeviceToken(customerInfo.id, function(err, customerDeviceToken) {
    //                             if(customerDeviceToken.length > 0)
    //                             {
    //                                 var bodyText = 'Trip Notification';
    //                                 if(statusType == 'to-customer')
    //                                 {
    //                                     if(customerSeting.noti_on_vehicle_allotment == 1)
    //                                     {
    //                                         var message = {'title':'MaalGaadi', 'type' : 'booking_notification', 'message': text, 'customer_id' : customerInfo.id};
    //                                         //$sendNotification = $this->sendNotification($tokensArray, $message, $bodyText);
    //                                         var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
    //                                                 to: customerDeviceToken[0], 
    //                                                 collapse_key: 'your_collapse_key',
                                                    
    //                                                 notification: {
    //                                                     title: 'Title of your push notification', 
    //                                                     body: 'Body of your push notification' 
    //                                                 },
                                                    
    //                                                 data: {  //you can send only notification or only data(or include both)
    //                                                     my_key: 'cancel',
    //                                                     my_another_key: 'cancel'
    //                                                 }
    //                                             };
    //                                             sendNotification(message, function(err, res) {
    //                                                 // callback();
    //                                             });
    //                                         if(bookingId != '')
    //                                         {
    //                                              qb.select('*').where({customer_id: customerInfo.id, booking_id: bookingId}).get(model.CustomerTripNotification, (err,tripNotification) => {
    //                                                 if(tripNotification.length == 0){
    //                                                     var notificationData = {customer_id: customerInfo.id,booking_id: bookingId, allotment_notification: text,allotment_status: "1"}
    //                                                     qb.insert(model.CustomerTripNotification, notificationData, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                                 else{
    //                                                     var notificationData = {allotment_notification: text,allotment_status: "1"}
    //                                                     qb.update(model.CustomerTripNotification, notificationData, {booking_id:bookingId, customer_id:customerId}, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                             });
                                                
    //                                         }
    //                                     }
    //                                 }
    //                                 if(statusType == 'loading')
    //                                 {
    //                                     if(customerSeting.noti_on_reaching_pickup_point == 1)
    //                                     {
    //                                         var message = {'title':'MaalGaadi', 'type' : 'booking_notification', 'message': text, 'customer_id' : customerInfo.id};
    //                                         //$sendNotification = $this->sendNotification($tokensArray, $message, $bodyText);
    //                                         if(bookingId != '')
    //                                         {
    //                                              qb.select('*').where({customer_id: customerInfo.id, booking_id: bookingId}).get(model.CustomerTripNotification, (err,tripNotification) => {
    //                                                 if(tripNotification.length == 0){
    //                                                     var notificationData = {customer_id: customerInfo.id,booking_id: bookingId, loading_notification: text,loading_status: "1"}
    //                                                     qb.insert(model.CustomerTripNotification, notificationData, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                                 else{
    //                                                     var notificationData = { loading_notification: text,loading_status: "1"}
    //                                                     qb.update(model.CustomerTripNotification, notificationData, {booking_id:bookingId, customer_id:customerId}, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                             });
    //                                         }
    //                                     }
    //                                     else
    //                                     {
    //                                         return res.json({"success" : false, "message" : message.ALLOTMENT_NOTIFICATION_DISABLED , "data" : {}});
    //                                     }
    //                                 }

    //                                 if(statusType == 'unloading')
    //                                 {
    //                                     if(customerSeting.noti_on_reaching_destination == 1)
    //                                     {
    //                                         var message = {'title':'MaalGaadi', 'type' : 'booking_notification', 'message': text, 'customer_id' : customerInfo.id};
    //                                         //$sendNotification = $this->sendNotification($tokensArray, $message, $bodyText);
    //                                         if(bookingId != '')
    //                                         {
    //                                              qb.select('*').where({customer_id: customerInfo.id, booking_id: bookingId}).get(model.CustomerTripNotification, (err,tripNotification) => {
    //                                                 if(tripNotification.length == 0){
    //                                                     var notificationData = {customer_id: customerInfo.id,booking_id: bookingId, unloading_notification: text,unloading_status: "1"}
    //                                                      qb.insert(model.CustomerTripNotification, notificationData, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                                 else{
    //                                                     var notificationData = { unloading_notification: text,unloading_status: "1"}
    //                                                     qb.update(model.CustomerTripNotification, notificationData, {booking_id:bookingId, customer_id:customerId}, (err, result) => {
    //                                                         if (err) return console.error(err);
    //                                                     });
    //                                                 }
    //                                                 callback();
    //                                             });
    //                                         }
    //                                     }
    //                                     else
    //                                     {
    //                                         return res.json({"success" : false, "message" : message.ALLOTMENT_NOTIFICATION_DISABLED , "data" : {}});
    //                                     }
    //                                 }

    //                                 if(statusType == 'billing' && customerSeting.noti_on_billing == 1)
    //                                 {
    //                                     var message = {'title':'MaalGaadi', 'type' : 'booking_notification', 'message': text, 'customer_id' : customerInfo.id};
    //                                     //$sendNotification = $this->sendNotification($tokensArray, $message, $bodyText);
    //                                     if(bookingId != '')
    //                                     {
    //                                          qb.select('*').where({customer_id: customerInfo.id, booking_id: bookingId}).get(model.CustomerTripNotification, (err,tripNotification) => {
    //                                             if(tripNotification.length == 0){
    //                                                 var notificationData = {customer_id: customerInfo.id,booking_id: bookingId, billing_notification: text,billing_status: "1"}
    //                                                  qb.insert(model.CustomerTripNotification, notificationData, (err, result) => {
    //                                                     if (err) return console.error(err);
    //                                                 });
    //                                             }
    //                                             else{
    //                                                 var notificationData = { billing_notification: text,billing_status: "1"}
    //                                                 qb.update(model.CustomerTripNotification, notificationData, {booking_id:bookingId, customer_id:customerId}, (err, result) => {
    //                                                     if (err) return console.error(err);
    //                                                 });
    //                                             }
    //                                         });
    //                                     }
    //                                 }
    //                                 else
    //                                 {
    //                                     return res.json({"success" : false, "message" : message.ALLOTMENT_NOTIFICATION_DISABLED , "data" : {}});
    //                                 }
    //                             }
    //                         });
                            
    //                     }
                       
    //                 }
                       
    //             });
    //         }
           
    //     });
    // }
}

function getCustomerDeviceToken(customerId,callback) {
    var tokenArray = [];
    qb.select('*')
        .where({customer_id: customerId})
        .order_by('id','DESC')
        .limit(50)
        .get(model.CustomerInfo, (err,deviceToken) => {
            // console.log(deviceToken);
            var deviceTokenData = [];
            deviceToken.forEach(function(result) {
                if(result.logout_time == null && result.device_token != null){
                    deviceTokenData.push(result.device_token);
                }
            });
            callback(null, deviceTokenData);
        }
    );
}

function sendNotification(message, callback){

    fcm.send(message, function(err, response){
        if (err) {
            console.log("Something has gone wrong!");
        } else {
            console.log("Successfully sent with response: ", response);
        }
        // callback();
    });
}


/* This function is used to Get Pending Bookings
# Request : Image and booking id
# Response : Message
# Author : Vinod Kumar
*/
router.all('/getPendingBookingList', function (req, res) {
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
    if(Req.lat == undefined || Req.lat == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.lng == undefined || Req.lng == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }

    var deviceId          = Req.device_id;
    var driverId;
    var lat               = Req.lat;
    var lng               = Req.lng;
    var startTime         = dt.format('Y-m-d H:M:S')
    var endTime           = dt.format('Y-m-d H:M:S')
    var employeeId        = 0;
    var distanceMeter     = 0; 
    var distance          = 0; 
    var time              = 0; 
    var timeText          = 0; 
    var bookingType       = "normal";
    var dtcKm             = 0;
    var maxDTC            = 0;
    var locals            = {};
    var cityId;
    var couverStatus      = 0;
    var timeAllowed       = -5;
    var afterTime;
    var timeAllowedForPrimeDriver = 3;
    var allowVehicleCategory = 0;;
    var driverVehicle;
    var bookingIdArray   = [0];
    var customerIdArray  = [0];
    var vehicleIdArray   = [0];
    var origins = [];
    var destinations;
    var bookingArray = [];
    async.series([
        //Load Booking
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).get(model.Driver, (err,driver) => {    
                if (err) return callback(err);
                locals.getDriverDetails = driver[0];
                cityId = driver[0].city_id;
                driverVehicle = driver[0].vehicle_category_id;
                driverId = driver[0].id;
                callback();
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.DriverPrimeSetting, (err,driverPrimeSetting) => {
                        if (err) return callback(err);
                        locals.driverPrimeSetting = driverPrimeSetting[0];
                        timeAllowedForPrimeDriver  = driverPrimeSetting[0].prime_allow_fav_driver;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.MaalgaadiSettings, (err,maalgaadiSettings) => {
                        if (err) return callback(err);
                        locals.maalgaadiSettings = maalgaadiSettings[0];
                        allowVehicleCategory = maalgaadiSettings[0].allow_vehicle_category;

                        callback();
                    });
                },
                function(callback) {
                    qb.select('covered_status').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverDetials, (err,driverDetials) => {
                        if (err) return callback(err);
                        locals.driverDetials = driverDetials[0];
                        if(driverDetials[0].covered_status == 'yes')
                        {
                            couverStatus =  1;
                        }
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').get(model.GoodsType, (err,goodsType) => {
                        if (err) return callback(err);
                        var goodObj = {};
                        for (var i = 0; i < goodsType.length; i++) {
                            goodObj[goodsType[i].id] = goodsType[i];
                        }
                        locals.goodsType = goodObj;
                        callback();
                    });
                },
                function(callback) {
                    qb.select('*').where({city_id: cityId}).get(model.VehicleCategory, (err,vehicleCategoryDetail) => {
                        if (err) return callback(err);
                        var vehicleObj = {};
                        for (var i = 0; i < vehicleCategoryDetail.length; i++) {
                            vehicleObj[vehicleCategoryDetail[i].id] = vehicleCategoryDetail[i];
                        }
                        locals.vehicleCategoryDetail = vehicleObj;
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    if(locals.getDriverDetails.is_prime == 1)
                    {
                        var timeAllowed = new Date(new Date().toLocaleString("en-In",{timeZone:'Asia/Calcutta'})); 
                        timeAllowed.setMinutes(-timeAllowedForPrimeDriver);
                        var dd = timeAllowed.getDate();
                        var mm = timeAllowed.getMonth()+1; 
                        var yyyy = timeAllowed.getFullYear();
                        var H = timeAllowed.getHours();
                        var i = timeAllowed.getMinutes();
                        var s = timeAllowed.getSeconds();
                        var afterTime = yyyy+'-'+mm+'-'+dd +' '+H+':'+i+':'+s;
                    }
                    else if(locals.maalgaadiSettings != undefined && locals.getDriverDetails.is_prime == 0)
                    {
                        
                        var driverBookingBufferTime  = locals.maalgaadiSettings.driver_booking_buffer_time; 
                        var timeAllowed = new Date(new Date().toLocaleString("en-In",{timeZone:'Asia/Calcutta'})); 
                        timeAllowed.setMinutes(-driverBookingBufferTime);
                        var dd = timeAllowed.getDate();
                        var mm = timeAllowed.getMonth()+1; 
                        var yyyy = timeAllowed.getFullYear();
                        var H = timeAllowed.getHours();
                        var i = timeAllowed.getMinutes();
                        var s = timeAllowed.getSeconds();
                        var afterTime = yyyy+'-'+mm+'-'+dd +' '+H+':'+i+':'+s;
                    }
                    else
                    {
                        var timeAllowed = new Date(new Date().toLocaleString("en-In",{timeZone:'Asia/Calcutta'})); 
                        var dd = timeAllowed.getDate();
                        var mm = timeAllowed.getMonth()+1; 
                        var yyyy = timeAllowed.getFullYear();
                        var H = timeAllowed.getHours();
                        var i = timeAllowed.getMinutes();
                        var s = timeAllowed.getSeconds();
                        var afterTime = yyyy+'-'+mm+'-'+dd +' '+H+':'+i+':'+s;
                    }
                    var reqTimeAllowed = new Date(new Date().toLocaleString("en-In",{timeZone:'Asia/Calcutta'})); 
                    reqTimeAllowed.setMinutes(30);
                    var dd = reqTimeAllowed.getDate();
                    var mm = reqTimeAllowed.getMonth()+1; 
                    var yyyy = reqTimeAllowed.getFullYear();
                    var H = reqTimeAllowed.getHours();
                    var i = reqTimeAllowed.getMinutes();
                    var s = reqTimeAllowed.getSeconds();
                    var endTime = yyyy+'-'+mm+'-'+dd +' '+H+':'+i+':'+s;
                      
                   // var bookingWhere = {driver_id: 0, allotment_type: 0,covered_required : couverStatus, vehicle_id : driverVehicle , 'created_at <=' : afterTime , 'requirement_time <=' : endTime};
                    var bookingWhere = {driver_id: 0, allotment_type: 0,covered_required : couverStatus, vehicle_id : driverVehicle , 'created_at <=' : afterTime };
                    qb.select('*').where(bookingWhere).get(model.Booking, (err,booking) => {

                        if(booking.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_PENDING_BOOKING , "data" : [] });
                        }
                        locals.booking = booking;
                        for (var i = 0; i < booking.length; i++) {
                            bookingIdArray.push(booking[i].id);
                            customerIdArray.push(booking[i].customer_id);
                            vehicleIdArray.push(booking[i].vehicle_id);
                        }
                        callback();
                    });
                }
         ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    var favouriteDrivergWhere = {driver_id : driverId , status : 'Active'};
                    qb.select('*').where_in('customer_id',customerIdArray).where(favouriteDrivergWhere).get(model.FavouriteDriver, (err,favouriteDriver) => {
                        if (err) return callback(err);
                        var favouriteDriverObj = {};
                        for (var i = 0; i < favouriteDriver.length; i++) 
                        {
                            favouriteDriverObj[favouriteDriver[i].customer_id] = favouriteDriver[i];
                        }
                        locals.favDrivers = favouriteDriverObj;
                        callback();
                    });
                },
                function(callback) {
                    
                    qb.select('*').where_in('booking_id',bookingIdArray).get(model.BookingDriverDetails, (err,bookingDriverDetails) => {
                        if (err) return callback(err);
                        var bookingDriverDetailsObj = {};
                        for (var i = 0; i < bookingDriverDetails.length; i++) 
                        {
                            bookingDriverDetailsObj[bookingDriverDetails[i].booking_id] = bookingDriverDetails[i];
                        }
                        locals.bookingDriverDetails = bookingDriverDetailsObj;
                        callback();
                    });
                },
                function(callback) {
                     qb.select('*').where_in('booking_id',bookingIdArray).order_by('id', 'desc').get(model.FavoriteLocation, (err,favoriteLocation) => {
                        if (err) return callback(err);
                            if(favoriteLocation.length == 0)
                            {
                                return res.json({"success" : false, "message" : message.NO_PENDING_BOOKING , "data" : [] });
                            }
                            var favouriteLocationObj = {};
                            for (var i = 0; i < favoriteLocation.length; i++) 
                            {
                                favouriteLocationObj[favoriteLocation[i].booking_id] = favoriteLocation[i];
                                var originsString = favoriteLocation[i].pickup_lat+','+favoriteLocation[i].pickup_lng; 
                                origins.push(originsString);
                            }
                            locals.favouriteLocation = favouriteLocationObj;
                            callback();
                    });
                },
                function(callback) {
                    qb.select('lat,lng').where({driver_id: driverId}).get(model.DriverRegular, (err,driverRegular) => {
                        if (err) return callback(err);
                        
                        if(driverRegular.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_PENDING_BOOKING , "data" : [] });
                        }

                        var destination  = driverRegular[0].lat +","+ driverRegular[0].lng;
                        destinations = [destination];
                        locals.driverRegular = driverRegular[0];
                        callback();
                    });
                },
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    getDistance(origins,destinations, function(err, distance) {
                        if (err) return callback(err);
                        locals.distance = distance;
                        callback();
                    });
                }
            ], callback);
        },

    ], function(err) {
        if (err) {
            console.log("Something has gone wrong!");
        }
        var distanceData = locals.distance;
        if(locals.booking.length > 0)
        {
            for (var i = 0; i < locals.booking.length; i++) 
            {
                var distanceMeter = 0;
                var maxDTC = 0;
                var dtcKm = 0;
                var actualDtcKm = 0;
                if(distanceData.rows[i].elements[0].distance.value !== undefined)
                {
                    var distanceMeter = distanceData.rows[i].elements[0].distance.value;
                } 
                
                if(locals.vehicleCategoryDetail[vehicleCategoryId] !== undefined)
                {
                    var vehicleCategoryId = locals.getDriverDetails.vehicle_category_id;
                    var maxDtcBufferPercentage = locals.vehicleCategoryDetail[vehicleCategoryId].max_dtc_buffer_percentage;
                    var lowerLimit = locals.vehicleCategoryDetail[vehicleCategoryId].lower_limit;
                    var upperLimit = locals.vehicleCategoryDetail[vehicleCategoryId].upper_limit;
                    var dtcCharges = locals.vehicleCategoryDetail[vehicleCategoryId].dtc_rate;
                }
                else
                {   var vehicleCategoryId = locals.getDriverDetails.vehicle_category_id;
                    var maxDtcBufferPercentage = 0;
                    var lowerLimit = 0;
                    var upperLimit = 0;
                    var dtcCharges = 0;
                }

                if(maxDtcBufferPercentage > 0) 
                {
                    var actualDtcKm = (distanceMeter/1000);
                    var dtcKm = Math.round(actualDtcKm + ((actualDtcKm * maxDtcBufferPercentage)/100));

                    if(dtcKm > lowerLimit && upperLimit > dtcKm) 
                    {
                        var maxDTC = Math.round((dtcKm - lowerLimit) * dtcCharges);
                    } 
                    else if(upperLimit < dtcKm) 
                    {
                        var maxDTC = Math.round(upperLimit * dtcCharges);
                    }
                    if(dtcKm > upperLimit)
                    {
                        var maxDTC = 0;
                    }
                }
                if(distanceData.rows[i].elements[0].distance.text != undefined)
                {
                    var distance      = distanceData.rows[i].elements[0].distance.text; 
                    var time          = distanceData.rows[i].elements[0].duration.value; 
                    var timeText      = distanceData.rows[i].elements[0].duration.text; 
                    var distance      = (distanceMeter/1000);
                } 
                else 
                {
                    var distance      =  0;
                    var time          =  0;
                    var timeText      =  NUll;
                    var distance      =  0;
                }
                      
                var bookingType = "सामान्य बुकिंग";
                if(locals.booking[i].driver_pricing_id == "2")
                {
                    bookingType = "प्रति घंटा";
                } 
                else if(locals.booking[i].driver_pricing_id == "3")
                {
                    bookingType = "फिक्स्ड बुकिंग";
                } 
                else
                {
                    bookingType = "सामान्य बुकिंग";
                }
                
                
                var goodsHindi = "अन्य";
                if(locals.booking[i].type_of_goods != undefined) 
                {
                    var goodId = locals.booking[i].type_of_goods;
                    var goodsEng = locals.goodsType[goodId].goods_name;
                    var goodsHindi = locals.goodsType[goodId].good_name_hindi;
                    if(goodsEng == 'Others')
                    {
                        goodsHindi = locals.booking[i].other_good_text;
                    }
                }
                if(goodsHindi == '')
                {
                    goodsHindi = "अन्य";
                }
                var loadingStatus        = 0;
                var unloadingStatus      = 0;
                var amount               = 0;
                var distancePickupToDrop = 0;
                
                var loading_status     = locals.booking[i].loading_required;
                if(loading_status == 1)
                {
                   loadingStatus =  "हां";
                } 
                else
                {
                    loadingStatus =  "नहीं";
                }
                var unloading_status   = locals.booking[i].unloading_required;
                if(unloading_status == 1)
                {
                   unloadingStatus =  "हां";
                } 
                else 
                {
                    unloadingStatus =  "नहीं";
                }
                var bonus = 0;
                
                if(  locals.bookingDriverDetails[locals.booking[i].id] != undefined)
                {
                    var bookingDriverDetails = locals.bookingDriverDetails[locals.booking[i].id];
                    amount = bookingDriverDetails.trip_charge + bookingDriverDetails.loading_charge + bookingDriverDetails.unloading_charge + bookingDriverDetails.drop_points_charge;
                    bonus = bookingDriverDetails.tip_charge + bookingDriverDetails.estimate_driver_surge_charge;
                }
                

                var distancePickupToDrop = locals.booking[i].upper_trip_distance;

                if(locals.booking[i].favourite_driver_required == 1)
                {
                    isFavDriver = true;
                }
                else
                {
                    isFavDriver = false;
                }
                
                if(locals.booking[i].favourite_driver_required == 1 && isFavDriver == false )
                {
                    
                }
                else
                {
                    var today = new Date();
                    var bt = new Date(locals.booking[i].requirement_time);
                    var ampm = (today.getTime()<bt.getTime())?'AM':'PM';
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
                    var monthName = month[bt.getMonth()];
                    if(maxDTC == undefined)
                    {
                        maxDTC = 0;
                    }
                    var bookingTime =  ("0" + bt.getDay()).slice(-2) +' '+ monthName +' '+ bt.getFullYear()+' '+ bt.getHours()+':'+bt.getMinutes(); 
                    var k = 0;
                    var screen_parameters = [];
                    if(amount)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'यात्रा शुल्क';
                        screen_parameters[k].value = '₹ '+amount;
                        k++;
                    }
                    if(distancePickupToDrop)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'दुरी (कि. मी.)';
                        screen_parameters[k].value = distancePickupToDrop+' km';
                        k++;
                    }
                    if(distancePickupToDrop)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'DTC (कि. मी.)';
                        screen_parameters[k].value = dtcKm+' km';
                        k++;
                    }
                    if(distancePickupToDrop)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'DTC शुल्क';
                        screen_parameters[k].value = '₹ '+maxDTC;
                        k++;
                    }
                    if(bonus)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'बोनस';
                        screen_parameters[k].value = '₹ '+bonus;
                        k++;
                    }
                    if(loading_status == 1 || unloading_status == 1)
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'लोडिंग एवं अनलोडिंग के साथ';
                        screen_parameters[k].value = true;
                        k++;
                    }
                    else
                    {
                        screen_parameters[k] = {};
                        screen_parameters[k].lable = 'लोडिंग एवं अनलोडिंग के साथ';
                        screen_parameters[k].value = false;
                        k++;
                    }

                    
                    var bookingObj   = {
                                        booking_id : locals.booking[i].id,
                                        booking_type : bookingType,
                                        booking_time : bookingTime,
                                        amount : amount,
                                        distance : distancePickupToDrop,
                                        distance_to_customer : dtcKm,
                                        dtc_charge : maxDTC,
                                        loading_status : loadingStatus,
                                        unloading_status : unloadingStatus,
                                        goods : goodsHindi,
                                        is_fav_driver : isFavDriver,
                                        employee_id : 49,
                                        screen_parameters : screen_parameters
                                        };
                    bookingArray.push(bookingObj);
                }
            }
        }
        
        if(bookingArray.length > 0)
        {
            return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : bookingArray});
        }        
        else
        {
            return res.json({"success" : false, "message" : message.NO_PENDING_BOOKING , "data" : [] });
        }
    });
});

/* This function is used to Get Pending Bookings
# Request : Image and booking id
# Response : Message
# Author : Vinod Kumar
*/
router.all('/getDriverBookingInvoice', function (req, res) {
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
    

    var bookingId          = Req.booking_id;
    var locals             = {};
    var driverId;
    var bookingArray = [];
    var remarkArray1        = ['DTC Charges', 'Distance to Customer'];
    var remarkArray2        = ['Commission'];
    async.series([
        //Load Booking
        function(callback) {
            qb.select('*').where({id: bookingId}).get(model.Booking, (err,booking) => {
                if (err) return callback(err);
                locals.booking = booking[0];
                driverId       = booking[0].driver_id;
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({booking_id: bookingId}).get(model.BookingDriverDetails, (err,bookingFinalDetials) => {
                if (err) return callback(err);
                locals.bookingFinalDetials = bookingFinalDetials[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({booking_id: bookingId}).get(model.FavoriteLocation, (err,favoriteLocation) => {
                if (err) return callback(err);
                locals.favoriteLocation = favoriteLocation[0];
                callback();
            });
        },
        function(callback) {
            qb.select('routes').where({booking_id: bookingId}).get(model.TripRoute, (err,tripRoutesDetials) => {
                if (err) return callback(err);
                locals.tripRoutesDetials = tripRoutesDetials[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({booking_id: bookingId}).where_in('remark',remarkArray1).get(model.DriverWallet, (err,walletDTCDetials) => {
                if (err) return callback(err);
                locals.walletDTCDetials = walletDTCDetials[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({booking_id: bookingId}).where_in('remark',remarkArray2).get(model.DriverWallet, (err,walletCommisionDetials) => {
                if (err) return callback(err);
                locals.walletCommisionDetials = walletCommisionDetials[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({booking_id: bookingId}).get(model.CustomerDropPoints, (err,customerDropPoints) => {
                if (err) return callback(err);
                locals.customerDropPoints = customerDropPoints;
                callback();
            });
        },
    ], function(err) {
        if (err) {
            console.log("Something has gone wrong!");
        }
        
        var distanceData = locals.distance;
        if(locals.booking != undefined)
        {
            var wayPointsArray = [];
            var count = 0;
            if(locals.favoriteLocation.pickup_landmark != '')
            {
                wayPointsArray[count] = {};
                wayPointsArray[count].is_drop = false;
                wayPointsArray[count].is_pickup = true;
                wayPointsArray[count].landmark =  locals.favoriteLocation.pickup_landmark;
                wayPointsArray[count].latitude = locals.favoriteLocation.pickup_lat;
                wayPointsArray[count].longitude = locals.favoriteLocation.pickup_lng;
                count = count + 1;
            }
            if(locals.customerDropPoints != '')
            {
                for (var i = 0; i < locals.customerDropPoints.length; i++) 
                {
                    wayPointsArray[count] = {};
                    wayPointsArray[count].is_drop = false;
                    wayPointsArray[count].is_pickup = false;
                    wayPointsArray[count].landmark  = locals.customerDropPoints[i].drop_landmark;
                    wayPointsArray[count].latitude  = locals.customerDropPoints[i].drop_lat;
                    wayPointsArray[count].longitude = locals.customerDropPoints[i].drop_lng;
                    count++;
                }
            }

            if(locals.favoriteLocation.drop_landmark != '')
            {
                wayPointsArray[count] = {};
                wayPointsArray[count].is_drop = true;
                wayPointsArray[count].is_pickup = false;
                wayPointsArray[count].landmark = locals.favoriteLocation.drop_landmark;
                wayPointsArray[count].latitude = locals.favoriteLocation.drop_lat;
                wayPointsArray[count].longitude = locals.favoriteLocation.drop_lng;
                count = count + 1;
            }
            
            var amount = 0;
            var driverEarning = 0;
            var bonus = 0;
            if(  locals.bookingFinalDetials != undefined)
            {
                bonus = locals.bookingFinalDetials.tip_charge + locals.bookingFinalDetials.actual_driver_surge_charge + locals.bookingFinalDetials.driver_waiting_charge;
                amount = bonus + locals.bookingFinalDetials.trip_charge + locals.bookingFinalDetials.drop_points_charge + locals.bookingFinalDetials.loading_charge + locals.bookingFinalDetials.unloading_charge;
                driverEarning = amount + locals.walletDTCDetials.credit - locals.walletCommisionDetials.debit;
            }
            
            var today = new Date();
            var bt = new Date(locals.booking.requirement_time);
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
            var monthName = month[bt.getMonth()];
            
            var bookingTime =  ("0" + bt.getDay()).slice(-2) +' '+ monthName +' '+ bt.getFullYear()+' '+ bt.getHours()+':'+bt.getMinutes(); 
            var k = 0;
            var screen_parameters = [];
            if(locals.bookingFinalDetials.trip_charge)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.TRIP_CHARGE;
                screen_parameters[k].value = '₹ '+locals.bookingFinalDetials.trip_charge;
                k++;
            }
            if(locals.bookingFinalDetials.drop_points_charge)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.DROP_POINT_CHARGE;
                screen_parameters[k].value = '₹ '+locals.bookingFinalDetials.drop_points_charge;
                k++;
            }
            if(locals.bookingFinalDetials.loading_charge)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.LOADING_CHARGE;
                screen_parameters[k].value = '₹ '+locals.bookingFinalDetials.loading_charge;
                k++;
            }
            if(locals.bookingFinalDetials.unloading_charge)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.UNLOADING_CHARGE;
                screen_parameters[k].value = '₹ '+locals.bookingFinalDetials.unloading_charge;
                k++;
            }
            if(locals.bookingFinalDetials.driver_waiting_charge)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.WAITING_CHARGE;
                screen_parameters[k].value = '₹ '+locals.bookingFinalDetials.driver_waiting_charge;
                k++;
            }
            else
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.WAITING_CHARGE;
                screen_parameters[k].value = '-';
                k++;
            }
            
            if(locals.walletDTCDetials)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.DTC_CHARGE;
                screen_parameters[k].value = '₹ '+locals.walletDTCDetials.credit;
                k++;
            }
            else
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.DTC_CHARGE;
                screen_parameters[k].value = '-';
                k++;
            }
            if(locals.walletCommisionDetials)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.COMMISION;
                screen_parameters[k].value = '₹ '+locals.walletCommisionDetials.debit;
                k++;
            }
            else
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.COMMISION;
                screen_parameters[k].value = '-';
                k++;
            }
            if(driverEarning)
            {
                screen_parameters[k] = {};
                screen_parameters[k].lable = message.TOTAL_EARNING;
                screen_parameters[k].value = '₹ '+driverEarning;
                k++;
            }
            
            var bookingArray   = {
                                    booking_id : locals.booking.id,
                                    booking_time : bookingTime,
                                    wayPointsArray : wayPointsArray,
                                    screen_parameters : screen_parameters,
                                    routes : JSON.parse(locals.tripRoutesDetials.routes) 
                                };
        }
        if(bookingArray)
        {
            return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : bookingArray});
        }        
        else
        {
            return res.json({"success" : false, "message" : message.NO_PENDING_BOOKING , "data" : {} });
        }
    });
});

/* This function is Send Booking BY FCM Token
# Request :  booking id , driver id and employee id
# Response : Message
# Author : Vinod Kumar
*/
router.all('/sendBookingToDriver', function (req, res) {
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
    if(Req.driver_id == undefined || Req.driver_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }

    var bookingId          = Req.booking_id;
    var empId              = Req.emp_id;
    if(Req.emp_id == undefined || Req.emp_id == '')
    {
        empId = 49;
    }
    var driverId           = Req.driver_id;
    var FCM = require('fcm-node');
    var google = require('../config/google.json');
    var serverKey = google.FCMAPIKEY; 
    var locals = {};
    async.series([
        function(callback) {
            qb.select('fcm_token').where({id: driverId}).get(model.Driver, (err,driver) => {
                if (err) return callback(err);
                locals.driver = driver[0];
                callback();
            });
        },
        function(callback) {
            qb.select('*').where({id: bookingId }).get(model.Booking, (err,booking) => {
                if (booking.length > 0)
                {
                    if(booking[0].driver_id != 0)
                    {
                        return res.json({"success" : false, "message" : message.BOOKING_ALLOTED_OTHER_DRIVER , "data" : {} });
                    }
                    else if(booking[0].driver_id == '-1')
                    {
                        return res.json({"success" : false, "message" : message.BOOKING_CANCELLED_BY_CUSTOMER , "data" : {} });
                    }
                    else
                    {
                        locals.booking = booking[0];
                        callback();
                    }
                }
                else
                {
                    return res.json({"success" : false, "message" : message.BOOKING_CANCELLED_BY_CUSTOMER , "data" : {} });
                }
            });
        },
    ], function(err) {
        var deviceToken   = locals.driver.fcm_token;
        var fcm = new FCM(serverKey);
        var messageData = { 
            to: deviceToken, 
            collapse_key: 'your_collapse_key',
            notification: {
                title: message.NOTIFICATION_CANCEL_TITLE, 
                body: message.NOTIFICATION_CANCEL_BODY 
            },
            data: {  
                booking_id: bookingId,
                driver_id : driverId,
                emp_id : empId,
                type : 'bookingInfo'
            }
        };
        fcm.send(messageData, function(err, response){
            if (err)
            {
                return res.json({"success" : false, "message" : message.BOOKING_NOT_SENT_SUCCESS , "data" : {} });
            } 
            else
            {
               return res.json({"success" : true, "message" : message.BOOKING_SENT_SUCCESS , "data" : {} });
            }
        });
    });
});
module.exports = router;

