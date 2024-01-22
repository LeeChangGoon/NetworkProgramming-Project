var express = require('express');
var http = require('http');
var static = require('serve-static');
var app = express();
var path = require('path');
var bcrypt = require('bcrypt');
var saltRounds = 10;
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');

app.set('port', process.env.PORT || 3000);
app.set('views',__dirname + '/views');
app.set('view engine', 'ejs');
console.log('뷰 엔진 ejs로 설정');
app.use(static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.use(cookieParser());

app.use(expressSession({
    secret:'my key',
    resave:true,
    saveUninitialized:true

}));

var mysql = require('mysql');

//mysql 데이터베이스 연결 설정
var pool = mysql.createPool({
    connectionLimit : 10,
    host : 'localhost',
    user : 'user333',
    password : 'password333',
    database : 'DB14',
    debug : false
})

app.set('port', process.env.PORT || 3000);

app.use('/public', static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

var router = express.Router();

//로그인
router.route('/process/login/').post(function (req, res) {
  console.log('/process/login/ 라우팅 함수에서 받음.');

  var paramId = req.body.id || req.query.id;
  var paramPassword = req.body.password || req.query.password;

  if (pool) {
    authUser(paramId, paramPassword, function (err, rows) {
      if (err) {
        console.error('사용자 로그인 중 오류 발생 : ' + err.stack);
        return;
      }

      if (rows) {
        console.log('로그인 성공');
        var username = rows.name;
        var userage = rows.age;
        req.session.user = {
          username: username,
          userage: userage
        };
        res.writeHead(302, { 'Location': '/public/lchmain.html' });
        res.end();
      } else {
        console.log('로그인 실패');
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h1>로그인 실패</h1>');
        res.write('<div><p>아이디와 패스워드를 다시 확인하십시오.</p></div>');
        res.write("<br><a href='/public/lchhome.html'>로그인화면으로</a>");
        res.end();
      }
    });
  } else {
    console.log('데이터베이스 연결 실패');
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
    res.write('<h1>데이터베이스 연결 실패</h1>');
    res.write('<div><p>데이터베이스에 연결하지 못했습니다.</p></div>');
    res.end();
  }
});

//비밀번호 해싱
function hashPassword(password) {
    var salt = bcrypt.genSaltSync(saltRounds);
    var hash = bcrypt.hashSync(password, salt);

    return hash;
}

//비밀번호 같은지 비교
var comparePasswords = function comparePasswords(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
};

// 사용자를 인증하는 함수
var authUser = function (id, password, callback) {
    console.log('authUser 호출됨.');
  
    // 커넥션 풀에서 연결 객체를 가져옵니다.
    pool.getConnection(function (err, conn) {
      if (err) {
        if (conn) {
          conn.release();
        }
        callback(err, null);
        return;
      }
      console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);
  
      var columns = ['id', 'name', 'age', 'Salt', 'hashedPassword'];
      var tablename = 'users_bcrypt';
  
      // SQL문을 실행합니다.
      var exec = conn.query("select ?? from ?? where id = ?", [columns, tablename, id], function (err, rows) {
        conn.release();
        console.log('실행 대상 SQL : ' + exec.sql);
  
        if (err) {
          console.error('SQL 실행 시 오류 발생함.');
          console.dir(err);
          callback(err, null);
          return;
        }
  
        if (rows.length > 0) {
          console.log('아이디 [%s]에 해당하는 사용자 찾음.', id);
  
          var user = rows[0];
  
          // 비밀번호 비교
          if (comparePasswords(password, user.hashedPassword)) {
            console.log('패스워드 일치');
            callback(null, user);
          } else {
            console.log('패스워드 불일치');
            callback(null, false); // 인증 실패 시 false
          }
        } else {
          console.log("일치하는 사용자를 찾지 못함.");
          callback(null, false); // 사용자 없어도 false
        }
      });
    });
};

app.use('/',router);

//로그아웃 라우팅 함수 - 로그아웃 후 세션 삭제
router.route('/process/logout').post(function(req,res){
    console.log('/process/logout 라우팅 함수 호출됨.');

    if(req.session.user){
        //로그인된 상태
        console.log('로그아웃합니다.');

        req.session.destroy(function(err){
            if (err) {
                console.log('세션 삭제 시 에러 발생');
                return;
            }
            console.log('세션을 삭제하고 로그아웃되었습니다.');
            res.redirect('/public/lchhome.html');
        });
    }else {
        console.log('로그인되어 있지 않습니다.');
        res.redirect('/public/lchhome.html');
    }
});

//상품 정보 테이블에서 가져오는 함수
router.route('/process/showproduct').get(function(req, res) {
    console.log('/process/showproduct 호출됨');

    var tableName = req.query.tableName; // 콤보박스에서 선택된 테이블 이름

    if (!tableName) {
        res.writeHead(200, {'Content-Type': 'text/html;charset=utf8'});
        res.write('<h2>조회할 테이블 이름이 없습니다.</h2>');
        res.end();
        return;
    }

    // 커넥션 풀에서 연결 객체를 가져옵니다.
    pool.getConnection(function(err, conn) {
        if (err) {
            if (conn) {
                conn.release();
            }
            console.error('데이터베이스 연결 오류: ' + err.stack);
            res.writeHead(200, {'Content-Type': 'text/html;charset=utf8'});
            res.write('<h2>데이터베이스 연결 오류</h2>');
            res.end();
            return;
        }

        console.log('데이터베이스 연결 스레드 아이디: ' + conn.threadId);

        // SQL문을 실행합니다.
        var exec = conn.query('SELECT * FROM ??', [tableName], function(err, rows) {
            conn.release();
            console.log('실행 대상 SQL: ' + exec.sql);

            if (err) {
                console.error('상품 정보 조회 중 오류 발생: ' + err.stack);
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf8'});
                res.write('<h2>상품 정보 조회 중 오류 발생</h2>');
                res.end();
                return;
            }

            if (rows.length > 0) {
                console.log('상품 정보를 찾았습니다.');
                console.dir(rows);
                res.render('product', { data: rows }); // product.ejs에 데이터 전달
            } else {
                console.log('일치하는 상품 정보를 찾지 못했습니다.');
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf8'});
                res.write('<h2>일치하는 상품 정보를 찾지 못했습니다.</h2>');
                res.end();
            }
        });
    });
});

//상품정보 출력
var showProduct = function(tableName, callback) {
    console.log("상품 정보 호출됨.");

    // 커넥션 풀에서 연결 객체를 가져옵니다.
    pool.getConnection(function(err, conn) {
        if (err) {
            if (conn) {
                conn.release();
            }
            callback(err, null);
            return;
        }

        console.log('데이터베이스 연결 스레드 아이디: ' + conn.threadId);

        // SQL문을 실행합니다.
        var exec = conn.query('SELECT * FROM ??', [tableName], function(err, rows) {
            conn.release();
            console.log('실행 대상 SQL: ' + exec.sql);

            if (err) {
                console.log('SQL 실행 시 오류 발생함.');
                console.dir(err);
                callback(err, null);
                return;
            }

            if (rows.length > 0) {
                console.log('상품 정보를 찾았습니다.');
                callback(null, rows);
            } else {
                console.log('일치하는 상품 정보를 찾지 못했습니다.');
                callback(null, null);
            }
        });
    });
};

var addUser = function(id, name, age, password, callback) {
    console.log('addUser 호출됨.');

    // 커넥션 풀에서 연결 객체를 가져옵니다.
    pool.getConnection(function(err, conn) {
        if (err) {
            if (conn) {
                conn.release();
            }
            callback(err, null);
            return;
        }
        console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);

        // 비밀번호 해싱
        var salt = bcrypt.genSaltSync(saltRounds);
        var hashedPassword = bcrypt.hashSync(password, salt);

        var data = {
            id: id,
            name: name,
            age: age,
            salt: salt,
            hashedPassword: hashedPassword
        };

        // SQL문을 실행합니다.
        var exec = conn.query('insert into users_bcrypt set ?', data, function(err, result) {
            conn.release();
            console.log('실행 대상 SQL : ' + exec.sql);

            if (err) {
                console.log('SQL 실행 시 오류 발생함.');
                console.dir(err);
                callback(err, null);
                return;
            }

            callback(null, result);
        });
    });
}

//회원가입
router.route('/process/adduser').post(function(req,res) { 
    console.log('/process/adduser 호출됨');

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
    var paramAge = req.body.age || req.query.age;

    console.log('요청 파라미터 : ' + paramId + ', '+ paramPassword + ', ' + paramName + ', ' + paramAge);

    //pool 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
    if(pool) {
        addUser(paramId, paramName, paramAge, paramPassword, function(err, addedUser) {
            //동일한 id로 추가할 때 오류 발생 - 클라이언트로 오류 전송
            if(err) {
                console.error('사용자 추가 중 오류 발생 : ' + err.stack);
                
                res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 중 오류 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
                res.end();

                return;
            }

            if(addedUser) {
                console.dir(addedUser);

                console.log('inserted ' + addedUser.affectedRows + ' rows');

                var insertId = addedUser.insertId;
                console.log('추가한 레코드의 아이디 : ' + insertId);

                res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 성공</h2>');
                res.write('<button onclick="location.href=\'/public/lchhome.html\'">홈으로</button>');
                res.end();
            } else {
                res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 실패</h2>');
                res.end();
            }
        });
    }else { //데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
        res.writeHead(200, {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>데이터베이스 연결 실패</h2>');
        res.end();
    }
});

var server = http.createServer(app).listen(app.get('port'), function()
{
    console.log('익스프레스로 웹 서버를 실행함 : ', app.get('port'));

});

var expressErrorHandler = require('express-error-handler');

var errorHandler = expressErrorHandler({
    static: {
        '404': './public/404.html'
    }
});

app.use( expressErrorHandler.httpError(404) );
app.use( errorHandler );