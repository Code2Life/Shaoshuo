/****************************
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 ****************************/

/**
 * api example
 * 
 * shaoshuo.init({
 *  appKey: 'xxxx',
 *  page: 'xxxx',
 *  element: 'xxxx',
 * })
 */

$(document).ready(function () {
  var CommentOrder = {
    latest : "sequence DESC",
    earliest: "sequence ASC",
    hotest: "upCount DESC"
  };

  var CommentConfig = {
    cloudAppId: "A6948718224019",
    cloudAppKey: "C3D6CB6F-AB49-A1E4-1094-18DD7480111B",
    cdnStorage: "http://op44al5jk.bkt.clouddn.com/"
  };

  var CommentItem = function (opt) {  
    this.id = opt.id;
    this.ip = opt.ip;
    this.content = opt.content;
    this.region = opt.region;
    this.username = opt.username;
    this.upCount = opt.upCount;
    this.createAt = opt.createAt; //todo format date
    this.sequence = opt.sequence;
    this.subItems = {};
  };

  var Comment = function () {
    loadResources();
    this.client = new Resource(CommentConfig.cloudAppId, CommentConfig.cloudAppKey);
    this.appModel = client.Factory("app");
    this.commentModel = client.Factory("comment");
    this.opt = {};
    this.editor = null;
    this.replyEditor = null;
    this.contentEle = null;
    this.comments = null;
    this.commentsDict = null;
    this.alertFunc = window.alert;
    this.order = CommentOrder.earliest;
    this.currentUser = localStorage.getItem('comment-user-name');
    this.noname = false;
  };

  Comment.prototype.init = function (opt) { 
    //validate param
    if(!opt.appKey || !opt.page || !opt.element) {
      console.error('init param error!');
      return false;
    }
    if($("#" + opt.element).length == 0 ) {
      console.error('comment element does not exist in dom!');
      return false;
    }
    this.opt = opt;
    opt.alertFunc && typeof opt.alertFunc == 'function' && (this.alertFunc = opt.alertFunc);
    this.contentEle = $("#" + opt.element);
    var that = this;
    //validate appKey
    that.appModel.query({
      filter:{
        where:{
          "appKey": opt.appKey
        }
      }
    },function (ret,err) {
        if(err) {
          console.error('init error, service unavailable!');
          return false;
        }
        if(!!ret && ret.length > 0) {
          //构建评论区
          that.buildAllComments(that.buildEditor);
        } else {
          console.error('init error, invalid app key!');
          return false;
        }
    });
  };

  Comment.prototype.buildAllComments = function (callback) {
    var that = this;
    that.comments = {};
    that.commentsDict = {};
    that.queryComment(function (ret,err) {
         if(err) {
           var msg = 'init error, service unavailable!';
           console.error(msg);
           callback.call(that, "msg");
         } else {
           for(var i = 0;i< ret.length;i++) {
             var deepSeq = ret[i].sequence.split('.');
             setTreePos(that.comments, deepSeq, ret[i]);
           }
           that.buildCommentDict(that.comments);
           that.buildComment();
           callback && callback.call(that);
         }
    });
  };

  Comment.prototype.changeOrder = function (order) {  
    this.order = CommentOrder[order];
    buildAllComments();
  };

  Comment.prototype.queryComment = function (callback) {  
    this.commentModel.query({
      filter:{
        where: {
          "appKey": this.opt.appKey
        },
        order: that.order
      }
    }, callback);
  };

  Comment.prototype.commentPage = function () {  
    var content = that.editor.getContent().trim();
    this.commentRequest(content, "");
  };

  Comment.prototype.commentReply = function (id) {  
    var content = that.replyEditor.getContent().trim();
    this.commentRequest(content, commentsDict[id].sequence);
  };

  Comment.prototype.commentRequest = function (content, basicSeq) {  
    var that = this;
    if(!content || content == '') {
      that.alertFunc('评论不能为空!');
    } else {
      that.buildAllComments(function (errMsg) { 
        if(errMsg) {
          that.alertFunc('评论服务器开小差了:(');
          return;
        }
        //新建评论
        that.commentModel.save({
          appKey: that.opt.appKey,
          pageKey: that.opt.page,
          ip: returnCitySN.cip,
          region: returnCitySN.cname,
          content: content,
          sequence: (basicSeq ? basicSeq + ".": "") + new Date().valueOf(),
          username: that.getCommentUser(),
          upCount: 0
        }, function (ret, err) { 
          if(err) {
            that.alertFunc('评论服务器开小差了:(');
          }
        });
      });
    }
  }
  Comment.prototype.getCommentUser = function () {  
    if(!this.currentUser || this.noname) {
      var ipSeq = returnCitySN.cip.split('.');
      if(ip.length == 4)
        return ":)游客" + ipSeq[2] + ipSeq[3];
      else
        return ":)神秘游客";
    }
    return this.currentUser;
  }
  
  Comment.prototype.buildComment = function () {  
    var ele = this.contentEle;
    var commentArea = ele.find('#shaoshuoCommentArea');
    var html = genCommentHtml(this.comments);
    if(commentArea.length() == 0) {
      commentArea.append('<div id="shaoshuoCommentArea">' + html +'</div');
    } else {
      commentArea.empty().append(html);
    }
  };

  Comment.prototype.upComment = function (id) { 
    var that = this;
    var commentIns = that.commentsDict[id];
    that.commentMode.get({_id: id}, function (ret, err) {
      commentIns.upCount = ret.upCount + 1;
      that.commentModel.save({_id: id}, {upCount: commentIns.upCount}, function (ret, err) {
        if(err || !ret) {
          that.alertFunc('')
        }
        $("#comment-up-" + id).text(commentIns.upCount);
      });
    });
  };

  Comment.prototype.buildEditor = function (errMsg) {
    if(errMsg) return;
    var ele = this.contentEle;
    ele.append('<div id="commentTextArea"><script type="text/plain" id="commentEditor" style="width:1000px;height:240px;">\
    <p style="color:#777">说点什么吧.</p></script></div>');
    that.editor = UM.getEditor('commentEditor');

    var textArea = $("#commentTextArea");
    textArea.append('<button class="comment-publish-btn" onclick="shaoshuo.commentPage()"></button>');
  };

  Comment.prototype.buildReplyEditor = function (id) {
    var that = this;
    var commentIns = that.commentsDict[id];
    var ele = $('#comment-'+ commentIns.id);
    if($("#replyCommentTextArea").length > 0) {
      UM.getEditor('commentReplyEditor').destroy();
      $("#replyCommentTextArea").remove();
    }
    ele.append('<div id="replyCommentTextArea"><script type="text/plain" id="commentReplyEditor" style="width:1000px;height:240px;"></script></div>');
    that.replyEditor = UM.getEditor('commentReplyEditor');
    
    var textArea = $("#replyCommentTextArea");
    var checkInfo = that.noname ? 'checked="checked"' : "";
    textArea.append('<div class="comment-publish-area">\
    <div><input ' + checkInfo + ' type="checkbox" onchange="shaoshuo.noname=!shaoshuo.noname"  />匿名评论</div>\
    <div>用户名:<input type="text" id="replyCommentTextUser" placeholder="输入你的昵称" /></div>\
    <button class="comment-publish-reply-btn" onclick="shaoshuo.commentReply(\''+ id +'\')"></button></div>')
  };

  Comment.prototype.buildCommentDict = function (root) {  
    for(var i in root) {
      this.commentsDict[root[i].id] = root[i];
      buildCommentDict(root[i].subItems);
    }
  };

  function setTreePos(root, seqArr, item) {  
    var currentSeq = seqArr.shift();
    if(seqArr.length == 0) {
      root[currentSeq] = new CommentItem(item);
    } else {
      if(typeof root[currentSeq] === 'undefined') {
        console.error('got error sequence from server.' + currentSeq);
        return;
      }
      setTreePos(root[currentSeq].subItems, seqArr, item);
    }
  }

  function genCommentHtml(comments) {  
    var html = '<div class="comment-area">';
    html += '<div> <span class="comment-operation-area-text">评论区</span>\
    <div class="comment-operation-area"> <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'latest\')" >最新</a> </div>\
    <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'earliest\')" >最早</a>\
    <a href="javascript:void(0)" onclick="shaoshuo.changeOrder(\'hotest\')" >最热</a> </div>\
    </div>';
    html += '<div class="comment-content-area"><ul class="comment-content-list">';
    for(var commentItem in comments) {
      html += genCommentContent();
    }
    html+='</ul></div></div>';
    return html;
  }

  function genCommentContent(commentItem) {  
    var html = '';
    html += '<li id="comment-'+ commentItem.id +'" class="comment-item-li"><div class="comment-item-div">';
    html += '<img src="default-icon.jpg" />';
    html += '<div class="comment-item-header">\
    <div class="comment-header-info">' + 
    (!!commentItem.username ? commentItem.username : ('神秘游客&nbsp;' + commentItem.region))
    + '&nbsp;'+ commentItem.createAt + '</div><div class="comment-header-operation">\
    <a href="javascript:void(0)" class="comment-header-up" onclick="shaoshuo.upComment(\'' + commentItem.id +'\')">\
    <span class="comment-header-up-icon"></span>顶(<span id="comment-up-' + commentItem.id +'">0</span>)</a>\
    <a href="javascript:void(0)" class="comment-header-reply" onclick="shaoshuo.buildReplyEditor(\'' + commentItem.id +'\')">\
    <span class="comment-header-reply-icon"></span>回复</a>\
    </div></div>';
    html += '<div class="comment-content-text">' + commentItem.content + '</div>';
    html += '</div><div class="comment-reply-div">';
    for(var subItem in commentItem.subItems) {
      html += genCommentContent(subItem);
    }
    html += '</div></li>';
    return html;
  }

  function loadResources() {  
    $("#body").append('<link href="'+ CommentConfig.cdnStorage +'umeditor/css/umeditor.min.css" type="text/css" rel="stylesheet">');
    $("#body").append('<script src="'+ CommentConfig.cdnStorage +'cloudapi.js"></script>');
    $("#body").append('<script src="'+ CommentConfig.cdnStorage +'umeditor/umeditor.config.js"></script>');
    $("#body").append('<script src="'+ CommentConfig.cdnStorage +'umeditor/umeditor.min.js"></script>');
    $("#body").append('<script src="'+ CommentConfig.cdnStorage +'umeditor/zh-cn.js"></script>');
    $("#body").append('<script scr="http://pv.sohu.com/cityjson?ie=utf-8"></script>');
  }

  window.shaoshuo = new Comment();
});



