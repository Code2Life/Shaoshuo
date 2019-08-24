/****************************
 * Name: Shaoshuo Comment Plugin
 * Version: 1.0.0.1
 * Author: code2life
 * Date: 2017-5-30
 * Description: 
 * A simple comment plugin write by jQuery
 * With APICloud Open Mongodb (Cloud API)
 ****************************/

/**
 * comment plugin example
 * 
 * shaoshuo.init({
 *  appKey: 'xxxx',   //a unique key for a website, you can use 'CommonKey' or ask author for the unique key
 *  page: 'xxxx',     //a unique key for a page 
 *  element: 'xxxx',  //the DOM element to load comment plugin
 *  editorHeight: '200px', //comment/reply editor initial height
 *  editorMaxHeight: '300px' //comment/reply editor max height
 * });
 */

$(document).ready(function () {

  var notClick = true;

  var CommentOrder = {
    latest: "sequence DESC",
    earliest: "sequence ASC",
    hotest: "upCount DESC"
  };

  var CommentConfig = {
    cloudAppId: "A6948718224019",
    cloudAppKey: "C3D6CB6F-AB49-A1E4-1094-18DD7480111B",
    cdnStorage: (window.location.protocol.indexOf('https') != -1 ? "https:" : "http:" ) + "//filecdn.code2life.top/"
  };

  var DEFAULT_HEIGHT = "130px";
  var DEFAULT_MAX_HEIGHT = "300px";
  var DEFAULT_CONTENT = '<p style="color:#555"><br></p>';
  var PLACE_HOLDER = '<p style="color:#555"></p>';

  (function initEditorConfig() {
    wangEditor.config.mapAk = '61su9bm0PHw4gkMIZt8cZWpG'
    wangEditor.config.menuFixed = false;
  })();

  var THROTTLE_DELAY = 5000;
  
  var DEFAULT_MENU = [
    'bold','underline','italic','strikethrough','|',
    'undo','redo','eraser','|',
    'fontfamily','fontsize','forecolor','bgcolor','|',
    'link','unlink','emotion','img'
  ];
  var EXTRA_MENU = [
    'video','location','|',
    'head','unorderlist','orderlist','|',
    'insertCode','quote','table'
  ];

  /** 评论列表的每个评论, 是一个二维列表 */
  var CommentItem = function (opt) {
    this.id = opt.id;
    this.ip = opt.ip;
    this.content = opt.content;
    this.region = opt.region;
    this.username = opt.username;
    this.upCount = opt.upCount;
    this.createdAt = opt.createdAt; //todo format date
    this.sequence = opt.sequence;
    this.subItems = {};
  };

  /** 评论系统对象 */
  var Comment = function () {
    this.opt = {};
    this.editor = null;
    this.replyEditor = null;
    this.contentEle = null;
    this.comments = null;
    this.commentsDict = null;
    this.alertFunc = window.alert;
    this.order = CommentOrder.earliest;
    this.currentUser = localStorage.getItem('comment-user-name') || "";
    if(this.currentUser)
      this.noname = false;
    else 
      this.noname = true;
  };

  /** 初始化评论系统 */
  Comment.prototype.init = function (opt) {
    //validate param
    if (!opt.appKey || !opt.page || !opt.element) {
      console.error('init param error!');
      return false;
    }
    if ($("#" + opt.element).length == 0) {
      console.error('comment element does not exist in dom!');
      return false;
    }
    
    this.opt = opt;
    opt.alertFunc && typeof opt.alertFunc == 'function' && (this.alertFunc = opt.alertFunc);
    this.contentEle = $("#" + opt.element);
    var that = this;
    !opt.editorHeight && (this.opt.editorHeight = DEFAULT_HEIGHT);
    !opt.editorMaxHeight && (this.opt.editorMaxHeight = DEFAULT_MAX_HEIGHT);

    loadResources(function() {
      //validate appKey
      doRequest('app','GET',{
        filter: {
          where: {
            "appKey": opt.appKey
          }
        }
      }, function (ret, err) {
        if (err) {
          console.error('init error, service unavailable!');
          return false;
        }
        if (!!ret && ret.length > 0) {
          //构建评论区
          that.buildAllComments(that.buildEditor);
        } else {
          console.error('init error, invalid app key!');
          return false;
        }
      });
    });
  };

  /** 初始化评论DOM元素 */
  Comment.prototype.buildComment = function () {
    var ele = this.contentEle;
    var commentArea = ele.find('#shaoshuoCommentArea');
    var html = genCommentHtml(this.comments);
    if (commentArea.length == 0) {
      ele.append('<div id="shaoshuoCommentArea">' + html + '</div');
    } else {
      commentArea.empty().append(html);
    }
  };

  /** 刷新渲染评论区 */
  Comment.prototype.buildAllComments = function (callback) {
    var that = this;
    that.comments = {};
    that.commentsDict = {};
    that.queryComment(function (ret, err) {
      if (err) {
        var msg = 'init error, service unavailable!';
        console.error(msg);
        callback && callback.call(that, "msg");
      } else {
        for (var i = 0; i < ret.length; i++) {
          var deepSeq = ret[i].sequence.split('.');
          setTreePos(that.comments, deepSeq, ret[i]);
        }
        that.buildCommentDict(that.comments);
        that.buildComment();
        callback && callback.call(that);
      }
    });
  };

  /** 更改评论列表显示的顺序 */
  Comment.prototype.changeOrder = function (order) {
    this.order = CommentOrder[order];
    this.buildAllComments();
  };

  /** 获取服务端最新的评论列表 */
  Comment.prototype.queryComment = function (callback) {
    doRequest('comment','GET',{
      filter: {
        limit: 2000,
        where: {
          "appKey": this.opt.appKey,
          "pageKey": this.opt.page
        },
        order: this.order
      }
    }, callback);
  };

  /**对当前页面的评论事件响应 */
  Comment.prototype.commentPage = function () {
    var content = this.editor.$txt.html().trim();
    var plain = this.editor.$txt.text().trim();
    this.commentRequest(content, plain, "");
  };

  /**对回复的评论事件响应 */
  Comment.prototype.commentReply = function (id) {
    var content = this.replyEditor.$txt.html().trim();
    var plain = this.replyEditor.$txt.text().trim();
    this.commentRequest(content, plain, this.commentsDict[id].sequence);
  };

  /** 发送评论请求 */
  Comment.prototype.commentRequest = function (content, plain, basicSeq) {
    var that = this;
    if (!content || content == '' || plain == '' || (basicSeq == '' && notClick)) {
      that.alertFunc.call(window,'评论不能为空!');
    } else {
      that.buildAllComments(function (errMsg) {
        if (errMsg) {
          that.alertFunc.call(window,'评论服务器开小差了:(');
          return;
        }
        //新建评论
        doRequest('comment','POST', {
          appKey: that.opt.appKey,
          pageKey: that.opt.page,
          ip: returnCitySN.cip,
          region: returnCitySN.cname,
          content: content,
          sequence: (basicSeq ? basicSeq + "." : "") + new Date().valueOf(),
          username: that.getCommentUser(),
          upCount: 0
        }, function (ret, err) {
          if (err) {
            that.alertFunc.call(window,'评论服务器开小差了:(');
          } else {
            that.buildAllComments();
            that.editor.$txt.html(DEFAULT_CONTENT);
            that.replyEditor && that.replyEditor.$txt.html(DEFAULT_CONTENT);
          }
        });
      });
    }
  }

  /** 点赞事件响应 */
  Comment.prototype.upComment = throttle(THROTTLE_DELAY, function (id) {
    var that = this;
    var commentIns = that.commentsDict[id];
    doRequest('comment/' + id,'GET',{}, function (ret, err) {
      if(err || !ret) {
        that.alertFunc.call(window, '该条评论已经不存在了');
        return;
      }
      commentIns.upCount = ret.upCount + 1;
      doRequest('comment/'+ id ,'PUT',{
        upCount: commentIns.upCount
      }, function (ret, err) {
        if (err || !ret) {
          that.alertFunc.call(window, '点赞失败啦');
        } else {
          $("#comment-up-" + id).text(commentIns.upCount);
        }
      });
    });
  });

  Comment.prototype.buildEditor = function (errMsg) {
    if (errMsg) return;
    var ele = this.contentEle;
    ele.append('<div id="commentTextArea" style="margin:10px 10px 50px 10px"><textarea id="commentEditor" \
    style="height:' + this.opt.editorHeight +';max-height:' + this.opt.editorMaxHeight +'">\
    ' + PLACE_HOLDER + '</textarea></div>');

    this.editor = new wangEditor('commentEditor');
    this.editor.config.menus = DEFAULT_MENU.concat(EXTRA_MENU);
    this.editor.create();
    this.editor.$txt.css("background-color", "transparent");
    this.editor.$txt.before('<div style="height:0"><input style="border:none;padding:10px 15px" id="placeholderInput" placeholder="说点什么吧"></div>');

    $('#placeholderInput').click(function(){
      $(this).remove();
      that.editor.$txt.focus();
    });
    var that = this;
    this.editor.$txt.one('click', function () { 
      notClick = false;
      $('#placeholderInput').remove();
      //that.editor.$txt.html(DEFAULT_CONTENT);
    });

    var textArea = $("#commentTextArea");
    var checkInfo = that.noname ? 'checked="checked"' : "";
    textArea.append('<div><div class="check-box-div" style="color:#555"><input ' + checkInfo + '  class="noname-checkbox" id="check1" type="checkbox" \
    onchange="shaoshuo.noname=!shaoshuo.noname"  /><label for="check1">匿名评论</label>\
    <div  class="user-name-div"><input type="text" id="replyTextUser" class="user-name-input" value="' + that.currentUser +'" \
    onchange="shaoshuo.changeUsername(this)"  placeholder="输入您的昵称" /></div></div>\
    <button class="comment-publish-btn" onclick="shaoshuo.commentPage()">发表评论</button></div>');
  };

  Comment.prototype.buildReplyEditor = function (id) {
    var that = this;
    var commentIns = that.commentsDict[id];
    var ele = $('#comment-' + commentIns.id);
    if ($("#replyCommentTextArea").length > 0) {
      that.replyEditor.destroy();
      $("#replyCommentTextArea").remove();
    }
    ele.append('<div id="replyCommentTextArea"><textarea id="commentReplyEditor" \
    style="height:' + this.opt.editorHeight +';max-height:' + this.opt.editorMaxHeight +'"></textarea></div>');

    that.replyEditor = new wangEditor('commentReplyEditor');
    that.replyEditor.config.menus = DEFAULT_MENU;
    that.replyEditor.create();
    that.replyEditor.$txt.html(DEFAULT_CONTENT);

    var textArea = $("#replyCommentTextArea");
    var checkInfo = that.noname ? 'checked="checked"' : "";
    textArea.append('<div class="comment-publish-area">\
    <div  class="check-box-div" style="color:#555"><input ' + checkInfo + '  class="noname-checkbox" id="check2" type="checkbox" onchange="shaoshuo.noname=!shaoshuo.noname"  /><label for="check2">匿名评论</label>\
    <div class="user-name-div"><input type="text" id="replyCommentTextUser" onchange="shaoshuo.changeUsername(this)" \
     class="user-name-input" value="' + that.currentUser +'"  placeholder="输入您的昵称" /></div></div>\
    <button class="comment-publish-reply-btn" onclick="shaoshuo.commentReply(\'' + id + '\')">回复</button></div>')
  };

  Comment.prototype.buildCommentDict = function (root) {
    for (var i in root) {
      this.commentsDict[root[i].id] = root[i];
      this.buildCommentDict(root[i].subItems);
    }
  };

  /** 获取用户的IP等信息 */
  Comment.prototype.getCommentUser = function () {
    if (!this.currentUser || this.noname) {
      var ipSeq = returnCitySN.cip.split('.');
      if (ipSeq.length == 4)
        return "游客" + ipSeq[2] + ipSeq[3];
      else
        return "神秘游客";
    }
    return this.currentUser;
  }

  Comment.prototype.changeUsername = function (element) {  
    var newname = $(element).val().trim();
    var that = this;
    if(newname && newname.length <= 10) {
      $('.noname-checkbox').removeAttr('checked');
      this.noname = false;
      $('.user-name-input').each(function () {
        $(this).val(newname);
        that.currentUser = newname || '';
      });
      localStorage.setItem("comment-user-name", newname);
    } else {
      this.noname = true;
      $('.noname-checkbox').prop('checked', true);
      $('.user-name-input').val("");
      localStorage.removeItem("comment-user-name");
      that.currentUser = '';
      if(newname.length > 10) {
        that.alertFunc.call(window,'用户名长度不能超过10!');
      } 
    }
  }

  /** 递归构建评论列表的二维链表 */
  function setTreePos(root, seqArr, item) {
    var currentSeq = seqArr.shift();
    if (seqArr.length == 0) {
      root[currentSeq] = new CommentItem(item);
    } else {
      if (typeof root[currentSeq] === 'undefined') {
        console.error('got error sequence from server.' + currentSeq);
        return;
      }
      setTreePos(root[currentSeq].subItems, seqArr, item);
    }
  }

  /** 生成评论区的html */
  function genCommentHtml(comments) {
    //由于实现方式的问题(key为整数的对象v8会自动排序), 暂不支持多样化排序
    var html = '<div class="comment-area">';
    html += '<div><div style="display:none" class="comment-operation-area">\
    <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'latest\')" >最新</a>\
    <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'earliest\')" >最早</a>\
    <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'hotest\')" >最热</a>  </div></div>\
    </div>';
    html += '<div class="comment-content-area"><ul class="comment-content-list">';
    var cnt = 0;
    for (var commentItem in comments) {
      html += '<li class="comment-item-li"><span>' + (++cnt) + '楼</span>';
      html += genCommentContent(comments[commentItem], 1);
      html += '</li>';
    }
    html += '</ul></div></div>';
    return html;
  }

  /** 生成每个评论内容的html */
  function genCommentContent(commentItem, depth) {
    var notEnough = $(window).width() < 625;
    var noDisplayDate = notEnough ? "no-display" : "";
    var noDisplayReply = depth >= 3 ? "no-display" : "";
    var html = '<div id="comment-' + commentItem.id + '" class="comment-item-div">';
    html += '<img width="33px" height="33px" src="' + CommentConfig.cdnStorage + 'default-icon.png" />';
    html += '<div class="comment-item-header">\
    <div class="comment-header-info"><span class="comment-user-name">' +
      (!!commentItem.username ? commentItem.username : ('神秘游客&nbsp;' + commentItem.region)) +
      '</span><span class="comment-time ' + noDisplayDate + '">' + new Date(commentItem.createdAt).Format('yyyy-MM-dd hh:mm') + '</span><div class="comment-header-operation">\
    <a href="javascript:void(0)" class="comment-header-up" onclick="shaoshuo.upComment(\'' + commentItem.id + '\')">\
    <span class="comment-header-up-icon"></span>顶(<span id="comment-up-' + commentItem.id + '">'+ commentItem.upCount +'</span>)</a>\
    <a href="javascript:void(0)" class="comment-header-reply ' + noDisplayReply + '" onclick="shaoshuo.buildReplyEditor(\'' + commentItem.id + '\')">\
    <span class="comment-header-reply-icon"></span>回复</a>\
    </div></div></div>';
    html += '<div class="comment-content-text">' + commentItem.content + '</div>';
    html += '</div>';
    for (var subItem in commentItem.subItems) {
      html += '<div class="comment-reply-div" style="margin-left:2em" >';
      html += genCommentContent(commentItem.subItems[subItem], depth+1);
      html += '</div>';
    }
    return html;
  }

  /** 资源动态加载 */
  function loadResources(cb) {
	var protocol = window.location.protocol.indexOf('https') != -1 ? "https:" : "http:";
	  
    /** js/css动态加载工具 */
    var dynamicLoading = {
      css: function (path) {
        if (!path || path.length === 0) {
          throw new Error('argument "path" is required !');
        }
        var head = document.getElementsByTagName('head')[0];
        var link = document.createElement('link');
        link.href = path;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        head.appendChild(link);
      },
      js: function (path, callback) {
        if (!path || path.length === 0) {
          throw new Error('argument "path" is required !');
        }
        var script = document.createElement("script");
        script.type = "text/javascript";
        if (typeof (callback) != "undefined") {
          if (script.readyState) {
            script.onreadystatechange = function () {
              if (script.readyState == "loaded" || script.readyState == "complete") {
                script.onreadystatechange = null;
                callback();
              }
            };
          } else {
            script.onload = function () {
              callback();
            };
          }
        }
        script.src = path;
        document.body.appendChild(script);
      }
    }

    /** 开始加载cdn资源 */
    var loadCnt = 1;
    // 获取当前IP和地理信息
    dynamicLoading.js(protocol + '//pv.sohu.com/cityjson?ie=utf-8', checkLoaded);
    function checkLoaded() {
      if(--loadCnt == 0) {
        cb();
      }
    }
  }

  /** 服务端请求发送工具 */
  function doRequest(model, method, param, callback) {
    var now = Date.now().valueOf();
    var appKey = SHA1(CommentConfig.cloudAppId + "UZ" + CommentConfig.cloudAppKey + "UZ" + now) + "." + now;
    var ajaxConfig = {
      headers: {
        'X-APICloud-AppId': CommentConfig.cloudAppId,
        'X-APICloud-AppKey': appKey,
        'Cache-Control': 'no-cache',
        'If-Modified-Since': 0
      },
      type: method,
      timeout: 10000,
      url: 'https://d.apicloud.com/mcm/api/' + model,
      data: method == 'GET' ? param : JSON.stringify(param),
      dataType: 'json',
      contentType: 'application/json',
      success: function (data) {  
        callback(data);
      },
      error: function (req, status, err) {
        callback(null, err || status);
      }
    }
    $.ajax(ajaxConfig);
  }

  /** SHA1 工具函数 */
  function SHA1(msg) {

    function rotate_left(n, s) {
      var t4 = (n << s) | (n >>> (32 - s));
      return t4;
    };

    function lsb_hex(val) {
      var str = "";
      var i;
      var vh;
      var vl;

      for (i = 0; i <= 6; i += 2) {
        vh = (val >>> (i * 4 + 4)) & 0x0f;
        vl = (val >>> (i * 4)) & 0x0f;
        str += vh.toString(16) + vl.toString(16);
      }
      return str;
    };

    function cvt_hex(val) {
      var str = "";
      var i;
      var v;

      for (i = 7; i >= 0; i--) {
        v = (val >>> (i * 4)) & 0x0f;
        str += v.toString(16);
      }
      return str;
    };


    function Utf8Encode(string) {
      string = string.replace(/\r\n/g, "\n");
      var utftext = "";

      for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
          utftext += String.fromCharCode(c);
        }
        else if ((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }

      }

      return utftext;
    };

    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;

    msg = Utf8Encode(msg);

    var msg_len = msg.length;

    var word_array = new Array();
    for (i = 0; i < msg_len - 3; i += 4) {
      j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 |
      msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
      word_array.push(j);
    }

    switch (msg_len % 4) {
      case 0:
        i = 0x080000000;
        break;
      case 1:
        i = msg.charCodeAt(msg_len - 1) << 24 | 0x0800000;
        break;

      case 2:
        i = msg.charCodeAt(msg_len - 2) << 24 | msg.charCodeAt(msg_len - 1) << 16 | 0x08000;
        break;

      case 3:
        i = msg.charCodeAt(msg_len - 3) << 24 | msg.charCodeAt(msg_len - 2) << 16 | msg.charCodeAt(msg_len - 1) << 8 | 0x80;
        break;
    }

    word_array.push(i);

    while ((word_array.length % 16) != 14) word_array.push(0);

    word_array.push(msg_len >>> 29);
    word_array.push((msg_len << 3) & 0x0ffffffff);


    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {

      for (i = 0; i < 16; i++) W[i] = word_array[blockstart + i];
      for (i = 16; i <= 79; i++) W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

      A = H0;
      B = H1;
      C = H2;
      D = H3;
      E = H4;

      for (i = 0; i <= 19; i++) {
        temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }

      for (i = 20; i <= 39; i++) {
        temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }

      for (i = 40; i <= 59; i++) {
        temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }

      for (i = 60; i <= 79; i++) {
        temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }

      H0 = (H0 + A) & 0x0ffffffff;
      H1 = (H1 + B) & 0x0ffffffff;
      H2 = (H2 + C) & 0x0ffffffff;
      H3 = (H3 + D) & 0x0ffffffff;
      H4 = (H4 + E) & 0x0ffffffff;

    }

    var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);

    return temp.toLowerCase();

  }

  function throttle(delay, action) {
    var last = 0;
    return function(){
      var curr = +new Date();
      if (curr - last > delay){
        action.apply(this, arguments);
        last = curr;
      }
    }
  }

  Date.prototype.Format = function (fmt) {
    var o = {
        'M+': this.getMonth() + 1, //月份
        'd+': this.getDate(), //日
        'h+': this.getHours(), //小时
        'm+': this.getMinutes(), //分
        's+': this.getSeconds(), //秒
        'q+': Math.floor((this.getMonth() + 3) / 3), //季度
        'S': this.getMilliseconds()//毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp('(' + k + ')').test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
    return fmt;
  };

  window.shaoshuo = new Comment();
});
