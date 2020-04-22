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

  var players = {}
  var donationsEnabled = false;

  var database = firebase.database();
  var table = database.ref("players")

table.on('child_changed', function(snapshot) 
{
    var key = snapshot.key;
    var msg = snapshot.val();

    if(msg != null) 
    {

      if(key.includes("_"))
      {
        key = key.replace("_", ".")

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

        if (progress.includes("true")) 
        {
          if (donationsEnabled) { donate(); }
        } 

        const message = new OSC.Message(key, progress)
        osc.send( message, { host : "127.0.0.1", port: 5278 } ) 
      }

      print()
      
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
      
        print();
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


  function update_osc(id, msg)
  {
    const message = new OSC.Message(id, msg);
    osc.send( message, { host : "127.0.0.1", port: 5278 } );
  }

  function update()
  {
    for (const key in players) 
    {
      if (players.hasOwnProperty(key)) 
      {
        const element = players[key];

        console.log("updating " + key + ":" + element);

        update_osc(key, element);
      }
    }
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

  function donate()
  {
    donationsEnabled = true;
    
    donateXpringSdk();
  }

  const sender = "";
  const secret = "";

  //loc(21) -> ~80% less code!!! (+all languages 😎)
  async function donateXpringSdk()
  {
    
    const { Wallet, XRPClient, XRPLNetwork, Utils, TransactionStatus, PayIDClient } = require("xpring-js");

    const payIDClient = new PayIDClient("xrpl-mainnet");

    const XDestination = await payIDClient.addressForPayID("GiveDirectly$payid.charity")

    const grpcURL = "main.xrp.xpring.io:50051"

    const amount = BigInt(166666);

    const wallet = Wallet.generateWalletFromSeed(secret);

    const xrpClient = new XRPClient(grpcURL, true)

    xrpClient.network = XRPLNetwork.mainet

    const xSender = Utils.encodeXAddress(sender)

    console.log(xSender)

    const balance = await xrpClient.getBalance(xSender);

    console.log("Sender balance: " + balance)

    console.log(XDestination)

    const destinationBalance = await xrpClient.getBalance(XDestination);

    console.log("Destination balance: " + destinationBalance)
    
    const result = await xrpClient.send(amount, XDestination, wallet)

    console.log("Result: "  + result)

    const status = await xrpClient.getPaymentStatus(result)

    console.log("Status: " + status)

    const success = status == TransactionStatus.Succeeded

    console.log("Sent: " + success)
    
  }