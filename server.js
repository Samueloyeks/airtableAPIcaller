const express = require('express');
const Airtable = require('airtable');
const bodyParser = require('body-parser');
var cors = require('cors');
const https = require('https');
const http = require('http');
const request = require('request')
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const AIRTABLE_API_KEY= process.env.AIRTABLE_API_KEY 


const PORT = 8080

app.use(cors()); 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin: *')
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
    next();
});



var base = new Airtable({apiKey: AIRTABLE_API_KEY}).base('appfwglZM9vnbScUy');

const OFEtable = base("OFE Alert")
const pickuptable = base('Carrier Pick-Up Details')
app.get('/', (req, res) => {
    res.send('Hello World');
  });



  app.get('/getTable', (req, res) => {
    OFEtable.select({
        view: 'Shipment Tracking'
    }).eachPage(function page(records, fetchNextPage) {

        records.forEach(async function(record) {
            if(record.get('TrackingNumber') && record.get('SC_OrderNo')){
                let trackingNumber =  await (record.get('TrackingNumber')).toString().split(',')[0]

                if(trackingNumber.toString().substring(0,2) === '1Z'){
                    var orderNo = record.get('SC_OrderNo')
                    var pickupTime =  await callShipitUPS(trackingNumber)
                    var timestamp = (new Date(pickupTime)).toISOString()
                    insertIntoPickupTable(orderNo,timestamp)
                }else if(trackingNumber.toString().length == 12){
                    var orderNo = record.get('SC_OrderNo')
                    var pickupTime =  await callShipitFedex(trackingNumber)
                    var timestamp = (new Date(pickupTime)).toISOString()
                    insertIntoPickupTable(orderNo,timestamp)
                }
            }else if(record.get('SC_OrderNo')){
                var orderNo = record.get('SC_OrderNo')
                insertIntoPickupTable(orderNo,null)
            }
            
        })

    fetchNextPage();

}, function done(err) {
    if (err) { 
        res.send('error')
        res.status(500)
    }
    res.send('success')
    res.status(200)
});
  },err=>{
      res.send('error')
      res.status(404)
  });

  function callShipitFedex(TrackingNumber){
    return new Promise((resolve,reject)=>{
        request.get(`http://shipit-api.herokuapp.com/api/carriers/fedex/${TrackingNumber}`,(req,res)=>{
        if(res){
            var result = JSON.parse(res.body)
            var activities = result.activities
            var pickedup = activities.find(obj => {
              return obj['details'] == 'Picked up'
            })
  
          if(pickedup){
            resolve(pickedup.timestamp)
          }
        }
        })
    })
  }

  function callShipitUPS(TrackingNumber){
    return new Promise((resolve,reject)=>{
        request.get(`http://shipit-api.herokuapp.com/api/carriers/ups/${TrackingNumber}`,(req,res)=>{
        if(res){
            var result = JSON.parse(res.body)
            var activities = result.activities
            var originScan = activities.find(obj => {
                return obj['details'] == 'Origin scan'
              })
    
              if(originScan){
                // console.log('UPS',originScan.timestamp)
                resolve(originScan.timestamp)
              }
        }
        })
    })
}

 function insertIntoPickupTable(orderNo,timestamp){
    pickuptable.create({
        "SC_OrderNo": orderNo,
        "CarrierPickup": timestamp
      }, function(err, record) {
        if (err) {
          console.error(err);
          return;
        }
        console.log(record.getId());
      });
 }



  
  app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}/`);
  });

