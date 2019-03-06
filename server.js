var server = require('http').createServer();
var io = require('socket.io')(server);
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "tehilla04",
  database: "socketchat"
  });
  

// var users = {};


io.sockets.on('connection', function (socket) {
    console.log('user connected with id ' +socket.id);

    

    socket.on('user',function(userId){
        console.log(userId +' connected with id ' +socket.id);
        updateSocketId(userId,socket,socket.id);      
        
    });

    socket.on('getClientOffLineMsg',function(userId){
        clientOffLineMsg(userId,socket);
        
    });

    socket.on('getOfflineMsg',(callcenter)=>{

        callcenterOfflineMsg(socket);
    });

  socket.on('replyFromCallCenter',(data)=>{
      //check if intended user is online and send msg to user
     //if not online insert into replies

     replyQuery(socket,data);

     //update message to show it has been replied to
    const updateMsgStatus = "update messages set msg_replied = ? where msg_msgid = ?";
          con.query(updateMsgStatus,['yes',data.replyMsgId],(error)=>{
              if(error){
                  throw error;
              }else{
                  console.log('reply status of message with id '+data.replyMsgId+' updated to replied')
              }
          });

      

  });  

    socket.on('newquery',(data)=>{
        // console.log(data);
        var from = data.clientId,
            msg = data.query,
            to  = 'callcenter',
            msgId = data.msgId,
            replStatus = 'no';

            //check if callcenter is online and get current socket id
            var sql = "select * from users where usr_userId = ?";
            con.query(sql,['callcenter'],(error,result)=>{
                if(error){
                    throw error;
                }else{
                var callcenterSocId = result[0]['usr_soc_id'];
                var onlineStatus = result[0]['usr_status'];
                }

                if(onlineStatus === 'online'){
                    socket.broadcast.to(callcenterSocId).emit('newQuery',data);
                    socket.emit('msgRcvd','your message has been recieved by Hq. You will get a rely shortly');
                }else{
                    var insertmsg = "insert into messages(msg_from,msg_to,msg_msg,msg_msgid,msg_replied) values(?,?,?,?,?)";
                        con.query(insertmsg,[from,to,msg,msgId,replStatus],(error)=>{
                            if(error){
                                throw error;
                            }else{
                                socket.emit('msgRcvd','your message has been queued. You will get a reply soon');
                            }
                        })
                }
                  
            });
    });

    

    socket.on('disconnect', function () {
        
        updateOnlineStatus(socket.id);
    });

});


server.listen(2020, ()=>{
  console.log('we are live on port 2020')
});


//functions


function replyQuery(socket,data){
    var intended = data.replyTo;
    //  console.log(data)
        
    //check if intended is online
    var checkUser = `select * from users where usr_userId = ${intended} limit 1`;
        con.query(checkUser,(error,result)=>{             
            if(error){
                throw error;
            }else{
                
                var userSocId = result[0]['usr_soc_id'];
                var online = result[0]['usr_status'];
                // console.log(online);

                if(online === 'online'){
                    socket.broadcast.to(userSocId).emit('replyFromCallCenter',data);
                }else{
                    var insert = "insert into reply (rep_to,rep_msg,rep_msgid,rep_query) values(?,?,?,?)";
                        con.query(insert,[data.replyTo,data.replyMsg,data.replyMsgId,data.replyQuery],(error)=>{
                            if(error) throw error;
                        });
                }
            }
        });
}


//install and use carbon in production to show client how long ago reply was recieved
function clientOffLineMsg(userId,socket){
console.log('getting offline messages for '+ userId);

const msg = `select * from reply where rep_to = ${userId} and rep_viewed = 'no'`;
con.query(msg,(error,result)=>{
    let data =[];
    // console.log(result);
    if(error){
        throw error;
    }else if(result == null){
        data = ""        
    }else{
        for(var i = 0; i < result.length; i++){
            data.push({
                query : result[i]['rep_query'],
                reply : result[i]['rep_msg'],
                replyDate : result[i]['rep_created_at']     
            })
        }
         
        socket.emit('yourOflineMsg',data);
        //update view status of message
        var updateMsg = `update reply set rep_viewed = 'yes' where rep_to = ${userId}`;
            con.query(updateMsg,['yes',],(error)=>{
                if(error){
                    throw error;
                }else{
                    console.log('view status changed to yes successfully')
                }
            });
    }
    
});
}; 

function updateSocketId(userId, socket,socketid){
    //determine if user is logging in for the first time.
    const checkId = "select * from users where usr_userId = ?";
    con.query(checkId,[userId],(error,result)=>{
        //  console.log(result);
        if(error){
            throw error;
        }else{
            if(result[0] == null){
                
                //logging for the first time, insert details
                const insert = "insert into users (usr_userId,usr_soc_id,usr_status) values (?,?,?)";
                con.query(insert,[userId,socketid,'online'],function(error){
                    if(error){
                        throw error;
                    }else{
                        socket.emit('yourNum', userId);
                    }
                });
            }else{
                // returning user
                const updatedetails = "update users set usr_soc_id = ?, usr_status = ? where usr_userId = ?";
                con.query(updatedetails,[socketid,'online',userId,],function(error){
                    if(error){
                        throw error;
                    }else{
                        socket.emit('yourNum', userId); 
                    }
                });
            }
        }
    });
};

function callcenterOfflineMsg(socket){
    const getOffLineMsg = "select * from messages where msg_to ='callcenter' and msg_replied = 'no'";
          con.query(getOffLineMsg,(error,result)=>{
              if(error){
                  throw error;
              }else{
                //  console.log(result)
                var data =[];
                for(var i = 0; i<result.length; i++){
                    data.push({
                    msgFrom : result[i]['msg_from'],
                    query : result[i]['msg_msg'],
                    msgId : result[i]['msg_msgid']
                   })

                }
              }
              socket.emit('callcenterOfflineMsg',data);
            //   console.log(data);
          });

}

function updateOnlineStatus(socketId){
const getSocket = "update users set usr_status = ? where usr_soc_id = ?";
con.query(getSocket,['offline',socketId],function(error){
    if(error){
        throw error;
    }else{
        console.log('user with socket id '+ socketId +' has gone offline');
    }
});
}
