/* 1. get all comment data  */

/* 2. generater comment div & umeditor instance  */

/* 3. provide post interface  */
$(document).ready(function () {
  var Comment = function () {
    loadResources();
    this.client = new Resource(window.commentConfig.cloudAppId, window.commentConfig.cloudAppKey);
    this.appModel = client.Factory("app");
    this.commentModel = client.Factory("comment");
    this.opt = {};
    this.editor = null;
    this.commentBtn = null;
    this.contentEle = null;
    this.sequence = 1;
  };

  Comment.prototype.init = function (opt) { 
    //validate param
    if(!opt.appKey || !opt.page || !opt.element || !opt.element.content || !opt.element.button) {
      console.error('init param error!');
      return false;
    }
    if($("#" + opt.element.content).length == 0 || $("#" + opt.element.button).length == 0) {
      console.error('content or comment button element does not exist in dom!');
      return false;
    }
    this.opt = opt;
    this.commentBtn = $("#" + opt.element.button);
    this.contentEle = $("#" + opt.element.content);
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
          that.buildAllComments();
          //绑定评论事件
          that.bindEvents();
        } else {
          console.error('init error, invalid app key!');
          return false;
        }
    });
  };

  Comment.prototype.buildAllComments = function () {
    var that = this;
    that.commentModel.query({
      filter:{
        where: {
          "appKey": that.opt.appKey
        },
        order: "sequence ASC"
      }
    }, function (ret,err) {
         if(err) {
           console.error('init error, service unavailable!');
           return false;
         } else {
           for(var i = 0;i< ret.length;i++) {
             buildComment(that.contentEle, ret[i]);
           }
           buildEditor(that.contentEle);
         }
    })
  };

  Comment.prototype.bindEvents = function () {  
    var that = this;
    that.commentBtn.unbind('click').bind('click', function () { 
      var content = that.editor.getContent().trim();
      if(!content || content == '') {
        alert('评论不能为空!');
      } else {
        that.commentModel.save({
          appKey: that.opt.appKey,
          pageKey: that.opt.page,
          ip: returnCitySN.cip,
          region: returnCitySN.cname,
          content: content,
          sequence: that.sequence,
          upCount: 0
        }, function (ret, err) { 
          //refresh comment area and add comment content to last
        });
      }
    });
  }
  
  function buildComment(ele, data) {  
    //ele.append();
  }

  function buildEditor(ele) {
    //ele.append();
  }

  function loadResources() {  
    $("#body").append('<link href="css/umeditor.css" type="text/css" rel="stylesheet">');
    $("#body").append('<script src="comment.config.js"></script>');
    $("#body").append('<script src="cloudapi.js"></script>');
    $("#body").append('<script src="umeditor.config.js"></script>');
    $("#body").append('<script src="umeditor.min.js"></script>');
    $("#body").append('<script src="zh-cn.js"></script>');
    $("#body").append('<script scr="http://pv.sohu.com/cityjson?ie=utf-8"></script>');
  }
  window.shaoshuo = new Comment();
});




/**
 * api example
 * 
 * shaoshuo.init({
 *  appKey: 'xxxx',
 *  page: 'xxxx',
 *  element: { 
 *    content: 'xxxx',
 *    button: 'xxxx'
 * })
 */

