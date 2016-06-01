var CryptoJS = require("crypto-js");
var request = require('request');
request = request.defaults({
  jar: true,
  encoding: null
});

/**
 * 生成随机数函数
 * @param  {Number} min 下限
 * @param  {Number} max 上限
 * @return {Number}    生成的随机数
 */
function makeRandom(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

/**
 * 根据给点的区间生成随机的 x,y 坐标
 * @param  {Object} offset 容器信息:top,left,width,height
 * @return {Object}        生成的坐标
 */
function makeRandomPositionInArea(offset) {
  return {
    x: makeRandom(offset.left, offset.left + offset.width),
    y: makeRandom(offset.top, offset.top + offset.height)
  };
}

// 相关操作的时间区间定义（在设定范围内随机生成）
var TRIGGER_DELAY = {
  // 验证码 iframe 加载时间，约100-200毫秒
  captchaLoad: {
    min: -100,
    max: -200
  },
  // 显示验证码到鼠标移动到图片上准备选择，1-5秒
  moveOnImg: {
    min: 1000,
    max: 5000,
  },

  // 选择两个文字的间隔时间，0.5秒-2秒之间
  chooseWord: {
    min: 500,
    max: 2000
  },
  // 鼠标按下到松开的时间，4-9毫秒
  mouseDown2Up: {
    min: 4,
    max: 9
  },
  // 鼠标松开到触发 click 事件的时间：0-2毫秒
  mouseUp2Click: {
    min: 0,
    max: 2
  },
  // 选择文字后鼠标移动触发点，基于上一次点击位置生成
  mouseMove: {
    min: 1000,
    max: 1500
  },

  // 点击验证按钮，最后一个字母选择完成后的1-3秒钟内
  clickSubmit: {
    min: 1000,
    max: 3000
  }
};

module.exports = function(config) {
  var wordCount = config.wordCount | 0;
  var challenge = config.challenge;
  var coord = config.coord;
  var startTime = parseFloat(config.startTime);

  // 开始请求验证码图片的时间（开始时间）
  var curTime = startTime;
  /**
   * 获取某个操作的时间
   * @param  {String} name 操作的名称
   * @param  {Boolean} isUpdateCurTime 是否更新 curTime变量
   * @return {Number}    返回操作的时间戳
   */
  function makeTriggerTime(name, isUpdateCurTime) {
    var time = curTime + makeRandom(TRIGGER_DELAY[name].min, TRIGGER_DELAY[name].max);
    if (isUpdateCurTime !== false) {
      curTime = time;
    }
    return time;
  }

  /**
   * 在验证码图标区域中随机生成坐标
   * @return {Object}   生成的点
   */
  function makeRandomPositionIn2Point() {
    var p1 = {
      x: captchaImageOffset.left,
      y: captchaImageOffset.top
    };
    var p2 = {
      x: captchaImageOffset.left + captchaImageOffset.width,
      y: captchaImageOffset.top + captchaImageOffset.height
    };

    return {
      x: makeRandom(p1.x, p2.x),
      y: makeRandom(p1.y, p2.y)
    };
  }

  var captchaImageOffset = {
    "top": 58,
    "left": 13,
    "width": 256,
    "height": 160
  };
  // 最终生成的数据对象
  var collectData = {
    triggerData: {},
    triggerButton: {},
    refreshCount: 0,
    refreshButton: {
      "left": 13,
      "top": 228,
      "width": 26,
      "height": 27
    },
    submitButton: {
      "left": 179,
      "top": 228,
      "width": 90,
      "height": 28
    },
    mousemoveData: [],
    mouseLeftClickData: [],
    mouseLeftDownData: [],
    mouseLeftUpData: [],
    mouseRightClickData: [],
    mouseRightDownData: [],
    mouseRightUpData: [],
    valuableClickData: [],
    mouseClickMaxCount: 20,
    mouseClickCount: 5,
    validateCount: 0,
    startTime: curTime,
    keydownData: [],
    captchaImage: captchaImageOffset,
    "challenge": challenge
  };

  // 触发弹出验证码的按钮
  var triggerData = {
    "height": 54,
    "width": 282,
    "left": 871, // 870.5
    "top": 263,
    "x": 0,
    "y": 0,
    "t": makeTriggerTime('captchaLoad', false)
  };
  Object.assign(triggerData, makeRandomPositionInArea(triggerData));
  collectData.triggerData = triggerData;
  collectData.triggerButton = triggerData;
  collectData.mouseLeftClickData.push(triggerData);

  // 上一次移动的时间
  var lastMoveTime = makeTriggerTime('moveOnImg');
  function addMoveData(moveTime) {
    if (!moveTime) {
      lastMoveTime += makeRandom(TRIGGER_DELAY.mouseMove.min, TRIGGER_DELAY.mouseMove.max);
      moveTime = lastMoveTime;
    }
    collectData.mousemoveData.push(Object.assign(makeRandomPositionIn2Point(), {
      t: moveTime
    }));
  }
  addMoveData(lastMoveTime);

  // 点击验证码图片的信数据
  coord.split(';').forEach(function(item, idx) {
    item = item.split(',');
    var x = item[0] | 0;
    var y = item[1] | 0;

    collectData.mouseLeftDownData.push({
      x: x,
      y: y,
      t: makeTriggerTime('chooseWord')
    });
    collectData.mouseLeftUpData.push({
      x: x,
      y: y,
      t: makeTriggerTime('mouseDown2Up')
    });

    var clickInfo = {
      x: x,
      y: y,
      t: makeTriggerTime('mouseUp2Click')
    };
    collectData.mouseLeftClickData.push(clickInfo);
    collectData.valuableClickData.push(clickInfo);
  });

  // 如果最后的点击时间比最后一次移动时间超过0.5秒，增加移动次数
  while (curTime - lastMoveTime > 500) {
    addMoveData();
  }

  // 计算出来的提交时间
  var submitTime = makeTriggerTime('clickSubmit');
  // 请求的时间（即解析完验证码的时间）
  var reqTime = Date.now() + 1500; // 提交时间设置为请求后的1.5秒后
  submitTime = Math.max(submitTime, reqTime);

  // 加入点击“验证”按钮的点击信息
  var clickSubmitInfo = Object.assign(makeRandomPositionInArea(collectData.submitButton), {
    t: submitTime
  });
  collectData.mouseLeftDownData.push(clickSubmitInfo);
  collectData.mouseLeftUpData.push(clickSubmitInfo);
  collectData.mouseLeftClickData.push(clickSubmitInfo);


  var keys = CryptoJS.enc.Utf8.parse(challenge.slice(0, 16));
  var collectibles = CryptoJS.AES.encrypt(JSON.stringify(collectData), keys, {
    iv: keys,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }).toString().replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "*");

  // console.log(collectData);

  // var timer = setInterval(function() {
  //   if (Date.now() - submitTime < 1000) return true;
  //   clearInterval(timer);
  //   console.log(new Date, new Date(submitTime), submitTime);
  //   request.post({
  //     url: 'https://passport.liepin.com/captcha/word/verify.json',
  //     form: {
  //       challenge: challenge,
  //       collectibles: collectibles,
  //       p: coord,
  //       time: startTime
  //     },
  //     headers: {
  //       Accept: 'application/json, text/javascript, */*; q=0.01',
  //       "X-Requested-With": "XMLHttpRequest",
  //       Pragma: 'no-cache',
  //       Referer: 'https://passport.liepin.com/captcha/word/iframe/',
  //       'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36'
  //     }
  //   }, function(error, response, body) {
  //     console.log(JSON.parse(body));
  //   });
  // }, 100);

  return {
    params: {
      challenge: challenge,
      collectibles: collectibles,
      p: coord,
      time: startTime
    },
    submitTime: submitTime
  };
}
