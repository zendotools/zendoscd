  const OSC = require("osc-js");
  const firebase = require("firebase");
  const read = require('readline');
  //const xrpApi = require("../xrp-api") //#todo: how do we make this an http server too?

  const rl = read.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  var config = 
  {
      apiKey: "AIzaSyC9ctnmbntIyud9b2LrjZGEoDBlCOX_BiA",
      authDomain: "zendo-v1.firebaseapp.com",
      databaseURL: "https://zendo-v1.firebaseio.com",
      projectId: "zendo-v1",
      storageBucket: "zendo-v1.appspot.com",
      messagingSenderId: "1050567670060",
      appId: "1:1050567670060:web:9f392d667834c056"
    };

  firebase.initializeApp(config);

  const osc = new OSC({ plugin: new OSC.DatagramPlugin, udpClient: { port: 5278 } })
  osc.open()

  var database = firebase.database();
  var table = database.ref("players")
  var players = {}
  var donationsEnabled = false;

table.on('child_changed', function(snapshot) 
{
    var key = snapshot.key;
    var msg = snapshot.val();

    if(msg != null) 
    {

      if(key.includes("_"))
      {
        key = key.replace("_", ".")

        if(donationsEnabled) { donate(); }
      }

      let player = players[key]

      let previousProgress = null
      
      if(player != null)
      {
        previousProgress = player.progress
      }

      let progress = msg.progress

      players[key] = progress

      if(progress != null && previousProgress != progress)
      {
        const message = new OSC.Message(key, msg.progress)
        osc.send( message, { host : "127.0.0.1", port: 5278 } ) 
      }
      
    }
});

  table.on('child_added', function(snapshot) 
  {
      var key = snapshot.key;
      var msg = snapshot.val();

      if(msg != null) 
      {
        key = key.replace("_", ".")

        const player = players[key];

        if(player == null) 
        {
          players[key] = msg.progress

          const message = new OSC.Message(key, msg.progress)
        
          osc.send( message, { host : "127.0.0.1", port: 5278 } )
        }
      
      }
  });

console.log("zendoscd started.")
console.log("commands: print | donate | reset | update | exit <return>.")

rl.on('line', (line) => {
    
    const command = line.toLowerCase().trim()

    switch(command) 
    {
      case 'print':
      
        print();
        break;

      case 'exit':
        process.exit(0);
        break;

      case 'reset':
        
        reset(); 
        break;

      case 'donate':
        donate();
        break;

        case 'update':
          update();
          break;
    
      default:
        break;
    }
  
  });

  function update()
  {

  }
  function reset()
  {

    var database = firebase.database();
    var table = database.ref("players")

    table.remove()
        .then(function() {
          console.log("reset succeeded.")
          players = {}
          donationsEnabled = false
        })
        .catch(function(error) {
          console.log("reset failed: " + error.message)
        });
  }

  function print() 
  {
    for (const key in players) 
    {
      if (players.hasOwnProperty(key)) 
      {
        const element = players[key];

        console.log(key + ":" + element);
      }
    }
  }

  const sender = "rnizuhJE84YuvAS82Rhmdg5pXQb3DirFzR";
  const secret = "shc11XNQiPymAJ3qc1WzKx6dhghmZ";
  const destination = "rsEFXRNVBZZM2gnNp7ombogbGWZUS33T6b";
  const tag = 0

  function donate()
  {
    donationsEnabled = true;

    donateRippleLib();
    donateXrpApi();
    donateXrpSdk();
  }

  function donateXrpApi()
  {
    const request = require('request');  
    const xrpApiServer = "http://localhost:3000/v1/payments"
    const bearerToken = "6807a92f3b52c15fd2970d9e1a8615b3"
  
    const paymentMessage = 
    {
        "payment": 
        {
          "source_address": sender,
          "source_amount": 
          {
            "value": "1",
            "currency": "XRP"
          },
          "destination_address": destination,
          "destination_amount": 
          {
            "value": "1",
            "currency": "XRP"
          }
        },
        "submit": true
      }

    const options = {
        url: xrpApiServer,
        headers: {
            Authorization: 'Bearer ' + bearerToken
        },
        body : paymentMessage,
        json : true
    };

    request.post(options, function(err, res, body) 
    {
      console.log(body);
    });

  }

  function donateXrpSdk()
  {
    
  }

  function donateRippleLib()
  {

    const testnet = 'wss://s.altnet.rippletest.net:51233';
    const mainet = 'wss://s1.ripple.com';
    const devnet = '???';

    const RippleAPI = require('ripple-lib').RippleAPI;

    const api = new RippleAPI ({
        server: testnet
      });

    api.connect().then(() => 
    {
      async function doPrepare() 
      {
        const preparedTx = await api.prepareTransaction(
          {
            "TransactionType": "Payment",
            "Account": sender,
            "Amount": api.xrpToDrops("1"),
            "Destination": destination
          }, 
          {
            // Expire this transaction if it doesn't execute within ~5 minutes:
            "maxLedgerVersionOffset": 75
          }
        )

        const maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
      
        console.log("Prepared transaction instructions:", preparedTx.txJSON)
  
        console.log("Transaction expires after ledger:", maxLedgerVersion)
        
        return preparedTx.txJSON

    }

    return doPrepare();

    }).then(tx =>   
    {
      console.log(tx);

      const response = api.sign(tx, secret)

      const txID = response.id

      console.log("txID : ", txID)

      const txBlob = response.signedTransaction

      async function doSubmit(txID, txBlob) 
      {

        const latestLedgerVersion = await api.getLedgerVersion()
        const result = await api.submit(txBlob)

        console.log("Tentative result code:", result.resultCode)
        console.log("Tentative result message:", result.resultMessage)

        return { id: txID, version: latestLedgerVersion + 1 }
      }

    return doSubmit(txID, txBlob)

    }).then((txInfo) => 
    {
        async function checkTx(txInfo) 
        {
          try 
          {
            const earliestLedgerVersion = txInfo.version
            const txID = txInfo.id

            tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})
           
            console.log("Transaction result:", tx)
           
            api.disconnect();
          } 
          catch(error) 
          {
            console.log("Couldn't get transaction outcome:", error)
          }
        }

        checkTx(txInfo);

    }).then(() => 
    {
      console.log('donated');
    }).catch(console.error);

  }


  
