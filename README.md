# Shaoshuo
A Portable Comment System

## Description
A simple comment plugin write by _jQuery_ With [APICloud](http://www.apicloud.com/) Open Mongodb (Cloud API)

## Usage
Shaoshuo Comment Plugin is easy to use. You can generate a simple comment system like following
>shaoshuo.init({
>     appKey: 'xxxx',   //a unique key for a website, you can use 'CommonKey' or ask author for the unique key
>      page: 'xxxx',     //a unique key for a page 
>      element: 'xxxx',  //the DOM element to load comment plugin
>      editorHeight: '200px', //comment/reply editor initial height, optional
>      editorMaxHeight: '300px' //comment/reply editor max height, optional
>     });

## Notice
1. You can customize CSS by overwrite classes in comment.css
2. If you want to use your own database, you could register a new cloud database in [APICloud](http://www.apicloud.com/) and create 2 documents
3. If you don't want to use APICloud, you could implement RESTFUL API interfaces

