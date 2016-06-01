var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var parser = require('./parser');


app.use(bodyParser.urlencoded({
  extended: true
}));

/**
 * 传入的参数
 */
// 文字个数
var wordCount = 4;
// 秘钥
var challenge = 'a55692e7ab2a205b318036ef1dd24714';
// 文字坐标
var coord = '181,117;123,91;76,124;66,162';
// 请求验证码图片的时间，需传入
var startTime = new Date();

app.get('/api', function(req, res) {
  var wordCount = req.query.wordCount || req.body.wordCount || 4;
  var challenge = req.query.challenge || req.body.challenge;
  var coord = req.query.coord || req.body.coord;
  var startTime = req.query.startTime || req.body.startTime || +new Date();
  var config = {
    wordCount: wordCount,
    challenge: challenge,
    coord: coord,
    startTime: startTime
  };

  if (!challenge || !coord) {
    res.send({
      err_no: 100,
      err_msg: '请传入challenge及coord参数',
      config: config,
      results: ''
    });
  } else if (coord.split(';').length != wordCount) {
    res.send({
      err_no: 110,
      err_msg: '传入 coord 不正确，需要' + wordCount + '组坐标！',
      config: config,
      results: ''
    });
  } else {
    res.send({
      err_no: 0,
      err_msg: '',
      config: config,
      results: parser(config)
    });
  }
});

app.use(express.static('test'));

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});
