const OSC = require("osc-js");
const firebase = require("firebase");
const read = require('readline');

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

table.on('child_changed', function(snapshot) 
{
    var key = snapshot.key;
    var msg = snapshot.val();

    if(msg != null) {

      key = key.replace("_", ".")

      let player = players[key]

      let previousProgress = null
      
      if(player != null)
      {
        previousProgress = player.progress
      }

      players[key] = msg

      let progress = msg.progress

      if(progress != null && previousProgress != progress)
      {
        const message = new OSC.Message(key, msg.progress)
        osc.send( message, { host : "127.0.0.1", port: 5278 } )
      }
      
    }
});

console.log("zendoscd started.")
console.log("commands: print | reset | exit <return>.")

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
    
      default:
        break;
    }
  
  });

  function reset()
  {

    var database = firebase.database();
    var table = database.ref("players")

    table.remove()
        .then(function() {
          console.log("reset succeeded.")
          players = {}
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

        console.log(key);
      }
    }
  }

  function donate()
  {
    const RippleAPI = require('ripple-lib').RippleAPI;

    const api = new RippleAPI ({
        server: 'wss://s1.ripple.com' // Public rippled server
      });

      const sender = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
      const secret = "a";
      const destination = "rUCzEr6jrEyMpjhs4wSdQdz4g8Y382NxfM";
      const tag = 0

    api.connect().then(() => 
    {
      async function doPrepare() 
      {
        

        const preparedTx = await api.prepareTransaction(
        {
            "TransactionType": "Payment",
            "Account": sender,
            "Amount": api.xrpToDrops("22"), // Same as "Amount": "22000000"
            "Destination": destination
          }, 
          {
            // Expire this transaction if it doesn't execute within ~5 minutes:
            "maxLedgerVersionOffset": 75
          }
        )

        const maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
      
        console.log("Prepared transaction instructions:", preparedTx.txJSON)
        console.log("Transaction cost:", preparedTx.instructions.fee, "XRP")
        console.log("Transaction expires after ledger:", maxLedgerVersion)
        
        return preparedTx.txJSON

    }

    return doPrepare();

    }).then(info =>   
    {
      console.log(info);

      const response = api.sign(info, secret)

      const txID = response.id

      console.log("Identifying hash:", txID)

      const txBlob = response.signedTransaction

      console.log("Signed blob:", txBlob)

      async function doSubmit(txBlob) 
      {

        const latestLedgerVersion = await api.getLedgerVersion()

        const result = await api.submit(txBlob)

        console.log("Tentative result code:", result.resultCode)
        console.log("Tentative result message:", result.resultMessage)

        // Return the earliest ledger index this transaction could appear in
        // as a result of this submission, which is the first one after the
        // validated ledger at time of submission.
        return latestLedgerVersion + 1
      }

      api.on('ledger', ledger => {
        console.log("Ledger version", ledger.ledgerVersion, "was just validated.")
        if (ledger.ledgerVersion > maxLedgerVersion) {
          console.log("If the transaction hasn't succeeded by now, it's expired")
        }
      })

    return doSubmit(txBlob)

    }).then((earliestLedgerVersion) => 
    {
        async function checkTx() 
        {
          try 
          {
            tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})
            console.log("Transaction result:", tx.outcome.result)
            console.log("Balance changes:", JSON.stringify(tx.outcome.balanceChanges))
          } 
          catch(error) 
          {
            console.log("Couldn't get transaction outcome:", error)
          }
        }

        checkTx();

        return api.disconnect();

    }).then(() => 
    {
      console.log('donated');
    }).catch(console.error);

  }


  
