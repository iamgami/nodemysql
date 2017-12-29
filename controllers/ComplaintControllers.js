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
router.all('/getDriverComplaintCategory', function (req, res) {
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
    var locals = {};
    var complainTypeIdsArray = [];
    var driverSubComplainArray = [];
    var subComplainTypeIdArray = [];
    async.series([
        //Load Booking
        function(callback) {
            qb.select('id,complaint_type,complaint_type_hindi,image_required').order_by('priority', 'ASC').get(model.DriverComplaintType, (err,complainTypeDetials) => {
                if (err) return callback(err);
                
                for (var i = 0; i < complainTypeDetials.length; i++) {
                    complainTypeIdsArray.push(complainTypeDetials[i].id);
                }
                locals.complainTypeDetials = complainTypeDetials;
                callback();
            });
        },
        function(callback) {
            async.parallel([
                
                function(callback) {
                    qb.select('id,complaint_type_id,sub_complaint,description_text,help_text,sub_complaint_hindi,description_text_hindi,help_text_hindi,image_required').where_in('complaint_type_id',complainTypeIdsArray).order_by('priority', 'ASC').get(model.DriverSubComplaint, (err,driverSubComplain) => {
                        if (err) return callback(err);

                        var driverSubComplainArray = {};
                        
                        for (var i = 0; i < driverSubComplain.length; i++) {

                            if(driverSubComplain[i].image_required == 1){
                                driverSubComplain[i].image_required = true;
                            } else {
                                driverSubComplain[i].image_required = false;
                            }
                            subComplainTypeIdArray.push(driverSubComplain[i].complaint_type_id);
                            if(driverSubComplain[i].complaint_type_id != undefined)
                            {
                                driverSubComplainArray[i] = driverSubComplain[i];
                            }
                        }
                        locals.driverSubComplainArray = driverSubComplainArray;
                        callback();
                    });
                }
            ], callback);
        },
    ], function(err) {
        if (err) console.log(err);
        var complainTypeDetials = locals.complainTypeDetials;
        var driverSubComplainArray = locals.driverSubComplainArray;
        var subIssueArray =[];
        var mainResultArray = []; 
        for (var i = 0; i < complainTypeDetials.length; i++) 
        {
            var sub_issue = [];
            for( var k in driverSubComplainArray )
            { 
                if(complainTypeDetials[i].id == driverSubComplainArray[k].complaint_type_id)
                {
                    sub_issue.push(driverSubComplainArray[k]);
                }
            }
            complainTypeDetials[i].sub_issue = sub_issue;
            mainResultArray.push(complainTypeDetials[i]);
        }
        return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : mainResultArray });
    });
});

/* This function is used to get driver  details
# Request : device Id 
# Response : Json respose with data and messages
*/
router.all('/addDriverComplaint', function (req, res) {
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
    if(Req.device_id == undefined || Req.device_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    if(Req.complaint_type_id == undefined || Req.complaint_type_id == '')
    {
        return res.json({"success" : false, "message" : message.REQUIRED , "data" : {}});
    }
    
    var bookingId = Req.booking_id;
    var deviceId = Req.device_id;
    var complaintTypeId = Req.complaint_type_id;
    var subComplaintTypeId = Req.sub_complaint_type_id;
    var reason = Req.reason;
    if(reason == undefined || reason)
    {
        reason = 'NA';
    }
    var locals = {};
    var driverId;
    var responseCode = 0;
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id : deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length == 0)
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                    callback();
                } 
                else
                {
                    driverId = driver[0].id;
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId, complaint_type_id : complaintTypeId, sub_complaint_type_id : subComplaintTypeId, trip_id : bookingId}).order_by('id', 'desc').get(model.DriverComplaint, (err,driverComplaint) => {
                        if (err || driverComplaint.length == 0)
                        {
                            var complaintData = {
                                    driver_id : driverId,
                                    trip_id : bookingId,
                                    complaint_type_id : complaintTypeId,
                                    sub_complaint_type_id : subComplaintTypeId,
                                    reason : reason
                            };
                            qb.insert(model.DriverComplaint, complaintData, (err, res) => {
                                if (err) return console.error(err);
                                callback();
                            });

                        } 
                        else
                        {
                            return res.json({"success" : false, "message" : "Complaint Alrady added" , "data" : {} });
                            callback();
                        }
                    });
                },
                
            ], callback);
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId, complaint_type_id : complaintTypeId, sub_complaint_type_id : subComplaintTypeId, trip_id : bookingId}).order_by('id', 'desc').get(model.DriverComplaint, (err,driverComplaint) => {
                        if (err || driverComplaint.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        } 
                        else
                        {
                            locals.driverComplaint = driverComplaint;
                            callback();
                        }
                    });
                },
                
            ], callback);
        },
        
    ], function(err) {
        if (err) console.log(err);
        var respose = locals.driverComplaint;
        if(locals.driverComplaint.length == 0)
        {
            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
        }
        else
        {
            return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : respose });
        }
    });
});

/* This function is used to set driver login details
# Request : device Id ,lat , lng, status, device_info
# Response : 
*/
router.all('/getDriverRegisteredComplaintList', function (req, res) {
    
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
    
    async.series([
        function(callback) {
            qb.select('*').where({driver_device_id: deviceId}).order_by('id', 'desc').get(model.Driver, (err,driver) => {
                if (err || driver.length != 0)
                {
                    driverId = driver[0].id;
                    locals.driver = driver[0];
                    callback();
                } 
                else
                {
                    return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                    callback();
                }
            });
        },
        function(callback) {
            async.parallel([
                function(callback) {
                    qb.select('*').where({driver_id: driverId}).order_by('id', 'desc').get(model.DriverComplaint, (err,driverPendingComplaints) => {
                        if (err || driverPendingComplaints.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        } 
                        else
                        {
                            locals.driverPendingComplaints = driverPendingComplaints;
                            callback();
                        }
                    });
                },
                function(callback) {
                    qb.select('*').order_by('id', 'desc').get(model.DriverComplaintType, (err,driverComplaintType) => {
                        if (err || driverComplaintType.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        } 
                        else
                        {
                            var driverComplaintTypeObj = {};
                            for (var i = 0; i < driverComplaintType.length; i++) 
                            {
                                driverComplaintTypeObj[driverComplaintType[i].id] = driverComplaintType[i];
                            }
                            locals.complaintTypes = driverComplaintTypeObj;
                            callback();
                        }
                    });
                },
                function(callback) {
                    qb.select('*').order_by('id', 'desc').get(model.DriverSubComplaint, (err,driverSubComplaint) => {
                        if (err || driverSubComplaint.length == 0)
                        {
                            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });
                            callback();
                        } 
                        else
                        {
                            var driverSubComplaintObj = {};
                            for (var i = 0; i < driverSubComplaint.length; i++) 
                            {
                                driverSubComplaintObj[driverSubComplaint[i].id] = driverSubComplaint[i];
                            }
                            locals.subComplaints = driverSubComplaintObj;
                            callback();
                        }
                    });
                },
            ], callback);
        },
        
    ], function(err) {
        if (err) console.log(err);

        if(locals.driverPendingComplaints.length > 0)
        {
            var resultArray              = [];
            var timeAllowed = new Date(new Date().toLocaleString("en-In",{timeZone:'Asia/Calcutta'})); 
            timeAllowed.setDate(timeAllowed.getDate() - 600);
            var lastThreeDate = timeAllowed.getTime();
            console.log(lastThreeDate);
            for (var i = 0; i < locals.driverPendingComplaints.length; i++) 
            {
                var value = locals.driverPendingComplaints[i];
                var mainResultArray          = {};
                var bookingId                = value.trip_id;
                mainResultArray.booking_id   = bookingId;
                mainResultArray.complaint_id = value.id;
                if(locals.subComplaints[value.sub_complaint_type_id] !== undefined)
                {
                    mainResultArray.complaint_sub_type = locals.subComplaints[value.sub_complaint_type_id].sub_complaint_hindi;
                }
                else
                {
                    mainResultArray.complaint_sub_type = "NA";    
                }

                if(locals.complaintTypes[value.complaint_type_id] !== undefined)
                {
                    mainResultArray.complaint_type = locals.complaintTypes[value.complaint_type_id].complaint_type_hindi;
                }
                else
                {
                    mainResultArray.complaint_type = "NA";    
                }
                
                mainResultArray.solution = value.feedback_hindi;    
                
                mainResultArray.title         = "शिकायत पत्र";    
                mainResultArray.raised_date   = value.created_at;    
                mainResultArray.resolved_date = value.feedback_date;    
                mainResultArray.complaint     = value.reason;   
                var createdAt = new Date(value.created_at);
                var checkCreated = createdAt.getTime();
                if(value.status == 0)
                {
                    mainResultArray.resolved = false;    
                    var msgString                  = "आपकी बुकिंग आईडी "+bookingId+" से सम्बन्थित शिकायत दर्ज हो चुकी है, इसका समाधान मालगाड़ी द्वारा जल्द किया जायेगा |";
                    mainResultArray.message = msgString;    
                    resultArray.push(mainResultArray);
                }
                else if(value.status == 1)
                {
                    if(checkCreated > lastThreeDate)
                    {
                        mainResultArray.resolved = true;  
                        var issueTypeId = value.complaint_type_id;  
                        var subIssueTypeId = value.sub_complaint_type_id;  
                        if(issueTypeId == 47)
                        {
                            var msgString = 'आपकी बुकिंग आईडी ' +bookingId+ ' से सम्बंधित ओवरलोडिंग शिकायत का समाधान हो चुका है |';
                        }
                        else if (issueTypeId == 48) 
                        {
                            var msgString = 'आपकी बुकिंग आईडी ' +bookingId+ ' से सम्बंधित चालान शिकायत का समाधान हो चुका है |';
                        }
                        else if (issueTypeId == 49) 
                        {
                            var msgString = 'आपकी बुकिंग आईडी ' +bookingId+ ' से सम्बंधित टोल शिकायत का समाधान हो चुका है |';
                        }
                        else
                        {
                            var msgString = 'आपकी बुकिंग आईडी ' +bookingId+ ' से सम्बंधित शिकायत का समाधान हो चुका है |';
                        }
                        
                        mainResultArray.message       = msgString;    
                        resultArray.push(mainResultArray);
                    }
                }
            }
            return res.json({"success" : true, "message" : message.RECORD_FOUND , "data" : resultArray });   
        }
        else
        {
            return res.json({"success" : false, "message" : message.NO_RECORD , "data" : {} });   
        }
        
        
    });
});

/* This function is used to set driver logout details
# Request : Token
# Response : Json Messages and data
*/
router.all('/addOverloadingComplaint', function (req, res) {
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
        const message = require('../lang/messages_en.json');
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



module.exports = router;