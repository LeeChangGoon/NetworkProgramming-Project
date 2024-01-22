var mysql = require('mysql');

var connection = mysql.createConnection({
    host : 'localhost',
    user : 'user333',
    password : 'password333',
    database : 'madang'

});

//연결 시작
connection.connect();
console.log('Here ...........(1)');

var query1 = 'Select * From Book';
connection.query(query1, function(error, results){
    if(error) throw error;
    console.dir(results);
});

//연결 종료
connection.end();