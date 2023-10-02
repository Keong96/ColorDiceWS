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
    client.query("SELECT option, SUM(amount) AS total_amount from colordice_bet_history WHERE id ="+matchId+" GROUP BY option ORDER BY total_amount ASC LIMIT 1")
        .then((result) =>
        {
            winNum = result.rows[0];

            client.query("UPDATE colordice_matches SET winNum = "+winNum+" WHERE id ="+matchId)
            .then((result2) =>
            {
                client.query("SELECT * FROM colordice_bet_history WHERE match_id ="+matchId)
                .then((result3) =>
                {
                    var totalBet = 0;
                    var totalWin = 0;

                    for(var i = 0; i < result3.rows.length; i++)
                    {
                        totalBet += result3.rows[i].amount;

                        if(result2.rows[i].option == winNum)
                        {
                            totalWin += result3.rows[i].amount;
                        }
                    }

                    client.query("UPDATE colordice_matches SET total_in = "+parseInt(totalBet)+", total_out = "+parseInt(totalWin)+" WHERE id ="+matchId)

                    client.query("SELECT * FROM colordice_bet_history WHERE uid ="+allClient[i].uid)
                    .then((result4) =>
                    {
                        if(result4.rows[0].option == winNum)
                        {
                            winAmount = (totalBet / totalWin) * result2.rows[0].amount;
                        }

                        var clientData = `{
                            "type": "WinInfo",
                            "sender": "Server",
                            "matchId": "${matchId}",
                            "winNum": "${winNum}",
                            "winAmount": "${winAmount}"
                        }`;

                        allClient[i].send(clientData);
                    });
                });
            });

            setTimeout(function(){ 
                CreateMatch();
            }, 5000);
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
  client.query("INSERT INTO colordice_bet_history (uid, match_id, amount, option) VALUES ('"+sender+"', '"+matchId+"', '"+amount+"', '"+option+"')");
}