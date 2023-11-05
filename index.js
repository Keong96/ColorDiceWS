const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8082;
require('dotenv').config();

const config = {
    connectionString:
      "postgres://gameportal_db_user:TnJdfCS9gNV1j1P19fsGp2H14t6qkf1N@dpg-cjrcte61208c73bkhro0-a.singapore-postgres.render.com/gameportal_db?ssl=true",
  };
  
const { Client } = require('pg');
const client = new Client(config);
client.connect();

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port:PORT }, () => {
console.log('server started')
})

allClient = [];

wss.on('connection', function connection(client){

    client.on('close', () => {  
      for(var i = 0; i < allClient.length; i++)
      {              
          if (allClient[i].id === client.id)
          { 
              allClient.splice(i, 1);
              break;
          }
      }
    })
  
    client.on('message', (data) => {
      var dataJSON = JSON.parse(data);
      
      console.log("dataJSON = "+JSON.stringify(dataJSON));

      switch(dataJSON.type)
      {
        case "PlayerLogin":
            PlayerLogin(client, dataJSON.data);
            break;
        case "PlayerBet":
            PlayerBet(dataJSON.sender, dataJSON.matchId, dataJSON.amount, dataJSON.option);
            break;
      }
    });
});

function CreateMatch()
{
    if(allClient.length > 0)
    {
        client.query("INSERT INTO colordice_matches (created_on) VALUES (NOW()) RETURNING id")
              .then((result) =>
              {
                for(var i = 0; i < allClient.length; i++)
                {
                    var clientData = `{
                        "type": "StartMatch",
                        "sender": "Server",
                        "matchId": "${result.rows[0].id}"
                      }`;
    
                    allClient[i].send(clientData);
                }

                setTimeout(function(){ 
                    EndMatch(result.rows[0].id);
                }, 30000);
              });
    }
    else
    {
        setTimeout(function(){ 
            CreateMatch();
        }, 5000);
    }
}

function EndMatch(matchId)
{
    //decide the wining number
    client.query("SELECT * from colordice_bet_history WHERE match_id ="+matchId)
    .then((result) =>
    {
        var winNum = -1;
        var totalBet = 0;
        var option = [0, 0, 0, 0, 0, 0];

        for(i = 0; i < result.rows.length; i++)
        {
            totalBet += result.rows[i].total_amount;

            option[result.rows[i].option] += result.rows[i].amount;
        }

        const diceResult = option.reduce((acc, current, index) => {
        if (current < acc.min) {
            return { min: current, index };
        }
            return acc;
        }, { min: option[0], index: 0 });
        
        if(option[diceResult.index] < totalBet / 10 )
        {
            winNum = 6;
        }
        else
        {
            winNum = diceResult.index;
        }

        client.query("UPDATE colordice_matches SET winNum = "+winNum+" WHERE id ="+matchId)

        for(var i = 0; i < allClient.length; i++)
        {
            var clientData = `{
                "type": "MatchInfo",
                "sender": "Server",
                "matchId": "${matchId}",
                "winNum": "${winNum}"
            }`;
    
            allClient[i].send(clientData);
            SendWinAmount(allClient[i].uid);
        }

        setTimeout(function(){ 
            CreateMatch();
        }, 5000);
    });
}

function SendWinAmount(matchId)
{
    var totalBet = 0;

    client.query("SELECT sum(amount) FROM colordice_bet_history WHERE match_id ="+matchId)
    .then((result) =>
    {
        totalBet = result.rows[0];

        client.query("SELECT * FROM colordice_bet_history WHERE match_id ="+matchId+" AND option = "+winNum)
            .then((result2) =>
            {
                var winAmount = totalBet / result2.rows[i].amount;

                for(var i = 0; i < allClient.length; i++)
                {
                    if(allClient[i].id == uid)
                    {
                        var clientData = `{
                            "type": "WinAmount",
                            "sender": "Server",
                            "matchId": "${matchId}",
                            "winAmount": "${winAmount}"
                        }`;
                
                        allClient[i].send(clientData);
                        break;
                    }
                }
            });
    });
}

function SendRoadMap()
{
    client.query("SELECT winNum from colordice_matches ORDER BY id DESC LIMIT 100")
          .then((result) =>
          {
            for(var i = 0; i < allClient.length; i++)
            {
                if(allClient[i].id == uid)
                {
                        var clientData = `{
                            "type": "RoadMap",
                            "sender": "Server",
                            "result": "${result.rows}",
                        }`;
                    
                        allClient[i].send(clientData);
                        break;
                }
            }
          });
}

CreateMatch();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function PlayerLogin(client, uid)
{
  client.id = uid;

  allClient.push(client);
}

function PlayerBet(sender, matchId, amount, option)
{
    var secretKey = "***!@#!**huas998kaS9*Y*&Y";
                var process = "debitmini";
                var username = "test002";
                var ref = matchId +" - "+sender+" - "+option; // M004
                var amt = amount.toString();
                
                var i =  crypto.createHash('md5').update((process + username + ref + amount +secretKey).toString()).digest("hex");

                var url = "https://api.globalaffiliate.vip/process.aspx?process="+process+"&username="+username+"&ref="+ref+"&amt="+amt+"&i="+i;

                axios.get(url, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        }
                    })
                    .then(response => {
                        client.query("INSERT INTO colordice_bet_history (uid, match_id, amount, option) VALUES ("+sender+", "+matchId+", "+amount+", "+option+")");
                    })
                    .catch(error => {
                        console.log(error);
                    });

    
}