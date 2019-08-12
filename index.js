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

//"127.0.0.1", 5278);
const osc = new OSC({ plugin: new OSC.DatagramPlugin, udpClient: { port: 5278 } })
osc.open()

var database = firebase.database();
var table = database.ref("players")

var players = {}

table.on('child_changed', function(snapshot) 
{
    console.log(snapshot.val)

    var key = snapshot.key;
    var msg = snapshot.val();

    if(msg != null) {

      key = key.replace("_", ".")

      players[key] = msg

      const message = new OSC.Message(key, msg.progress)

      osc.send( message, { host : "127.0.0.1", port: 5278 } )

    }
});

rl.on('line', (line) => {
    
    const command = line.toLowerCase().trim()

    switch(command) 
    {
      case 'print':
      
        print();
        break;
    
      default:
        break;
    }
  
  });


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
  //rl.on("p" , (line) => {
    //console.log(`Received: ${line}`);
  //});

//firebase.database().ref('users/' + userId).set({
  //  username: name,
    //email: email,
   // profile_picture : imageUrl
 // });
