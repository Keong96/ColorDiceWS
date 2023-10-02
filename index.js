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
  
      switch(dataJSON.type)
      {
        case "PlayerLogin":
            PlayerLogin(client, dataJSON.data);
            break;
        case "PlayerBet":
            PlayerBet(dataJSON.sender, dataJSON.matchId, dataJson.amount, dataJSON.option);
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
                }, 35000);
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
    var winNum = Math.floor(Math.random() * 6);

    client.query("UPDATE colordice_matches SET winNum = "+winNum+" WHERE id ="+matchId)
          .then((result) =>
          {
              client.query("SELECT * FROM colordice_bet_history WHERE match_id ="+matchId)
                    .then((result2) =>
                    {
                        var totalBet = 0;
                        var totalWin = 0;

                        for(var i = 0; i < result2.rows.length; i++)
                        {
                            totalBet += result2.rows[i].amount;

                            if(result.rows[i].option == winNum)
                            {
                                totalWin += result2.rows[i].amount;
                            }
                        }

                        client.query("UPDATE colordice_matches SET totalIn = "+totalBet+", totalOut = "+totalWin+" WHERE id ="+matchId)

                        for(var j = 0; j < result2.rows.length; j++)
                        {
                            var winAmount = 0;

                            if(result2.rows[j].option == winNum)
                            {
                                winAmount = (totalBet / totalWin) * result2.rows[j].amount;
                            }

                            SendWinInfo(result2.rows[j].uid, matchId, winNum, winAmount);
                            client.query("UPDATE colordice_bet_history SET winAmount = "+winAmount+" WHERE id ="+result2.rows[j].id)
                        }

                        setTimeout(function(){ 
                            CreateMatch();
                        }, 5000);

                    });
          });

}

function SendWinInfo(uid, matchId, winNum, winAmount)
{
    for(var i = 0; i < allClient.length; i++)
    {
       if(allClient[i].id == uid)
       {
            var clientData = `{
                "type": "WinInfo",
                "sender": "Server",
                "matchId": "${matchId}",
                "winNum": "${winNum}",
                "winAmount": "${winAmount}",
            }`;
        
            allClient[i].send(clientData);
            break;
       }
    }
}

function SendBetHistory()
{
    client.query("SELECT winNum from colordice_matches ORDER BY id DESC LIMIT 100")
          .then((result) =>
          {
            for(var i = 0; i < allClient.length; i++)
            {
                if(allClient[i].id == uid)
                {
                        var clientData = `{
                            "type": "BetHistory",
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
  console.log("Player Joined, ID:"+uid);
}

function PlayerBet(sender, matchId, amount, option)
{
  client.query("INSERT INTO colordice_bet_history (uid, match_id, amount, option) VALUES ("+sender+", "+matchId+", "+amount+", "+option+")");
}